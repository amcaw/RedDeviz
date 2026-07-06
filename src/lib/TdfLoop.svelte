<script lang="ts">
  import { onMount } from 'svelte';
  import maplibregl from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import geo from '../data/tdf-geo.json';
  import { STAGES, REST_DAYS, TOTAL_KM, TYPE_LABEL, TYPE_COLOR, CAT_ORDER, CAT_LABEL, fmtKm, fmtInt, fmtDate, fmtHm, type Stage, type StageType, type ClimbCat } from './tdf/stages';
  import { LIVE, stageState, riderName, riderFlag, fmtGap, fmtTime, properName, lastResult, stageFacts, type StageResult, type StageState } from './tdf/live';
  import { analyzeProfile } from './tdf/prof';

  const R = 288;
  const W = 21;
  const SEAM = 0.4;
  const GAP = 0.016;
  const RESTGAP = 0.105;
  const REST_AFTER = new Set([9, 15]);

  const P = (a: number, r: number): [number, number] => [r * Math.sin(a), -r * Math.cos(a)];
  const arc = (a0: number, a1: number, r: number) => {
    const [x0, y0] = P(a0, r);
    const [x1, y1] = P(a1, r);
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };

  interface Seg {
    s: Stage;
    a0: number;
    a1: number;
    mid: number;
    state: StageState;
    color: string;
    result: StageResult | null;
  }

  const geometry = (() => {
    const avail = 2 * Math.PI - SEAM - 18 * GAP - 2 * RESTGAP;
    const eff = STAGES.map((s) => Math.max(s.km, 60));
    const total = eff.reduce((a, b) => a + b, 0);
    const segs: Seg[] = [];
    const rests: { a: number; date: string; place: string }[] = [];
    let a = SEAM / 2;
    STAGES.forEach((s, i) => {
      const w = (avail * eff[i]) / total;
      segs.push({
        s,
        a0: a,
        a1: a + w,
        mid: a + w / 2,
        state: stageState(s),
        color: TYPE_COLOR[s.type],
        result: LIVE.stages[String(s.n)] ?? null
      });
      a += w;
      if (REST_AFTER.has(s.n)) {
        const rest = REST_DAYS[s.n === 9 ? 0 : 1];
        rests.push({ a: a + RESTGAP / 2, date: rest.date, place: rest.place });
        a += RESTGAP;
      } else if (i < STAGES.length - 1) {
        a += GAP;
      }
    });
    return { segs, rests };
  })();

  const lastDone = $derived.by(() => {
    let last: Seg | null = null;
    for (const g of geometry.segs) if (g.result) last = g;
    return last;
  });
  const todaySeg = geometry.segs.find((g) => g.state === 'today') ?? null;
  const latest = $derived(lastResult());

  const defaultSeg =
    todaySeg ?? geometry.segs.find((g) => g.state === 'future') ?? geometry.segs[geometry.segs.length - 1];
  let pinned = $state<Seg | null>(null);
  let hoverSeg = $state<Seg | null>(null);
  const sel = $derived(hoverSeg ?? pinned ?? defaultSeg);

  const routeOf = (n: number) => (geo.routes as Record<string, { path: number[][]; prof: number[] }>)[String(n)];

  const bbox = (path: number[][]): [[number, number], [number, number]] => {
    let m1 = Infinity,
      m2 = Infinity,
      M1 = -Infinity,
      M2 = -Infinity;
    for (const [ln, la] of path) {
      m1 = Math.min(m1, ln);
      M1 = Math.max(M1, ln);
      m2 = Math.min(m2, la);
      M2 = Math.max(M2, la);
    }
    return [
      [m1, m2],
      [M1, M2]
    ];
  };

  const haversine = (a: number[], b: number[]) => {
    const R = 6371;
    const dLa = ((b[1] - a[1]) * Math.PI) / 180;
    const dLn = ((b[0] - a[0]) * Math.PI) / 180;
    const s =
      Math.sin(dLa / 2) ** 2 +
      Math.cos((a[1] * Math.PI) / 180) * Math.cos((b[1] * Math.PI) / 180) * Math.sin(dLn / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  };

  const selPath = $derived.by(() => {
    const path = routeOf(sel.s.n).path;
    const cum = [0];
    for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + haversine(path[i - 1], path[i]));
    return { path, cum, total: cum[cum.length - 1] };
  });

  const pathAtKm = (km: number): [number, number] => {
    const { path, cum, total } = selPath;
    const d = Math.max(0, Math.min(total, (km / sel.s.km) * total));
    let i = 1;
    while (i < cum.length && cum[i] < d) i++;
    if (i >= path.length) return path[path.length - 1] as [number, number];
    const t = (d - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
    return [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * t, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * t];
  };

  const PW = 316;
  const PH = 176;
  const PM = { top: 26, right: 10, bottom: 22, left: 34 };

  const profGeom = (s: Stage) => {
    const prof = routeOf(s.n).prof;
    const amax = Math.max(...prof);
    const amin = Math.min(...prof);
    const base = Math.max(0, Math.floor(amin / 100) * 100);
    const span = Math.max(400, (amax - base) * 1.12);
    const xi = (i: number) => PM.left + (i / (prof.length - 1)) * (PW - PM.left - PM.right);
    const xKm = (km: number) => PM.left + (km / s.km) * (PW - PM.left - PM.right);
    const yAtKm = (km: number) => {
      const f = (km / s.km) * (prof.length - 1);
      const lo = Math.floor(f);
      const alt = prof[lo] + (prof[Math.min(lo + 1, prof.length - 1)] - prof[lo]) * (f - lo);
      return PM.top + (1 - (alt - base) / span) * (PH - PM.top - PM.bottom);
    };
    const altAtKm = (km: number) => {
      const f = (km / s.km) * (prof.length - 1);
      const lo = Math.floor(f);
      return prof[lo] + (prof[Math.min(lo + 1, prof.length - 1)] - prof[lo]) * (f - lo);
    };
    const y = (alt: number) => PM.top + (1 - (alt - base) / span) * (PH - PM.top - PM.bottom);
    const line = prof.map((alt, i) => `${i ? 'L' : 'M'} ${xi(i).toFixed(1)} ${y(alt).toFixed(1)}`).join(' ');
    const area = `${line} L ${xi(prof.length - 1).toFixed(1)} ${PH - PM.bottom} L ${PM.left} ${PH - PM.bottom} Z`;
    const yStep = span > 1600 ? 1000 : span > 700 ? 500 : 200;
    const yTicks: { v: number; y: number }[] = [];
    for (let v = base; v <= base + span; v += yStep) yTicks.push({ v, y: y(v) });
    const xStep = s.km > 120 ? 50 : s.km > 60 ? 25 : 10;
    const xTicks: { v: number; x: number }[] = [];
    const xlim = PW - PM.right - 26;
    for (let v = 0; v <= s.km; v += xStep) {
      if (xKm(v) <= xlim) xTicks.push({ v, x: xKm(v) });
    }
    const ai = prof.indexOf(amax);
    const cols = s.climbs.map((c) => {
      const km = s.km - c.kmToGo;
      let bi = Math.round((km / s.km) * (prof.length - 1));
      for (let j = Math.max(0, bi - 2); j <= Math.min(prof.length - 1, bi + 2); j++) {
        if (prof[j] > prof[bi]) bi = j;
      }
      return { cat: c.cat, name: c.name, x: xi(bi), y: y(prof[bi]), desgrange: c.desgrange };
    });
    const sprint = s.sprint ? { x: xKm(s.sprint.kmDone), y: yAtKm(s.sprint.kmDone) } : null;
    return {
      line,
      area,
      yTicks,
      xTicks,
      cols,
      sprint,
      xKm,
      yAtKm,
      altAtKm,
      apex: { x: xi(ai), y: y(amax), alt: amax, left: ai < prof.length / 2 },
      baseY: PH - PM.bottom
    };
  };

  let profCursor = $state<{ x: number; y: number; km: number; alt: number } | null>(null);
  let profSvg = $state<SVGSVGElement>();
  let restTip = $state<{ lx: number; ly: number; date: string; place: string } | null>(null);
  let hidden = $state<StageType[]>([]);
  const toggleType = (t: StageType) =>
    (hidden = hidden.includes(t) ? hidden.filter((x) => x !== t) : [...hidden, t]);
  const isHidden = (t: StageType) => hidden.includes(t);

  const onProfMove = (e: MouseEvent | Touch) => {
    const svg = profSvg;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * PW;
    const inner = PW - PM.left - PM.right;
    const f = Math.max(0, Math.min(1, (vx - PM.left) / inner));
    const km = f * sel.s.km;
    profCursor = { x: pg.xKm(km), y: pg.yAtKm(km), km, alt: pg.altAtKm(km) };
  };
  const onProfLeave = () => (profCursor = null);

  $effect(() => {
    const c = profCursor;
    if (!map || !mapReady) return;
    const src = map.getSource('cursor') as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData({
      type: 'FeatureCollection',
      features: c
        ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: pathAtKm(c.km) } }]
        : []
    } as never);
  });

  let mounted = $state(false);
  let yProg = $state(0);
  let tdfEl = $state<HTMLDivElement>();
  let wheelFitEl = $state<HTMLDivElement>();
  let wrapEl = $state<HTMLDivElement>();
  const reduceMotion =
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  $effect(() => {
    const el = tdfEl;
    if (!el || typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 880px)');
    const fit = () => {
      if (mq.matches) {
        const avail = window.innerHeight - el.getBoundingClientRect().top - 44;
        el.style.height = `${Math.max(460, Math.round(avail))}px`;
      } else {
        el.style.height = '';
      }
    };
    fit();
    window.addEventListener('resize', fit);
    mq.addEventListener('change', fit);
    return () => {
      window.removeEventListener('resize', fit);
      mq.removeEventListener('change', fit);
    };
  });

  $effect(() => {
    const fit = wheelFitEl;
    const wrap = wrapEl;
    if (!fit || !wrap || typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 880px)');
    const square = () => {
      if (mq.matches) {
        const s = Math.floor(Math.min(fit.clientWidth, fit.clientHeight));
        wrap.style.width = `${s}px`;
        wrap.style.height = `${s}px`;
      } else {
        wrap.style.width = '';
        wrap.style.height = '';
      }
    };
    square();
    const ro = new ResizeObserver(square);
    ro.observe(fit);
    mq.addEventListener('change', square);
    return () => {
      ro.disconnect();
      mq.removeEventListener('change', square);
    };
  });

  let mapEl = $state<HTMLDivElement>();
  let map: maplibregl.Map | null = null;
  let firstFit = true;
  let mapReady = $state(false);
  let zoomHint = $state<string | null>(null);
  let hintTimer = 0;
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const isTouch = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
  const ZOOM_HINT = isTouch ? 'Pincez à deux doigts pour zoomer' : `${isMac ? '⌘' : 'Ctrl'} + molette pour zoomer`;

  const outerRings = (g: { type: string; coordinates: number[][][] | number[][][][] }): number[][][] =>
    g.type === 'MultiPolygon'
      ? (g.coordinates as number[][][][]).map((poly) => poly[0])
      : [(g.coordinates as number[][][])[0]];

  const WORLD_RING: number[][] = [
    [-30, 25],
    [30, 25],
    [30, 62],
    [-30, 62],
    [-30, 25]
  ];

  const traceFC = {
    type: 'FeatureCollection',
    features: STAGES.map((s) => ({
      type: 'Feature',
      properties: { n: s.n, done: stageState(s) !== 'future', stype: s.type },
      geometry: { type: 'LineString', coordinates: routeOf(s.n).path }
    }))
  };

  const endsFC = {
    type: 'FeatureCollection',
    features: STAGES.flatMap((s) => {
      const p = routeOf(s.n).path;
      return [
        { type: 'Feature', properties: { n: s.n, kind: 'start' }, geometry: { type: 'Point', coordinates: p[0] } },
        { type: 'Feature', properties: { n: s.n, kind: 'end' }, geometry: { type: 'Point', coordinates: p[p.length - 1] } }
      ];
    })
  };

  function mapColors() {
    return {
      bg: '#000000',
      landFill: '#ffff00',
      border: 'rgba(0, 0, 0, 0.4)',
      ink: '#000000',
      caseCol: 'rgba(255, 255, 255, 0.95)',
      shadow: 'rgba(110, 78, 0, 0.6)',
      highlight: 'rgba(255, 255, 255, 0.55)',
      accentDem: 'rgba(130, 95, 0, 0.4)'
    };
  }

  let cityMarkers: maplibregl.Marker[] = [];
  let epMarkers: maplibregl.Marker[] = [];

  type Dir4 = 'up' | 'down' | 'left' | 'right';
  const DIR_ANCHOR: Record<Dir4, maplibregl.PositionAnchor> = {
    up: 'bottom',
    down: 'top',
    left: 'right',
    right: 'left'
  };

  function calloutEl(name: string, dir: Dir4, withDot: boolean) {
    const horiz = dir === 'left' || dir === 'right';
    const el = document.createElement('div');
    el.className = `callout ${dir}`;
    const conn = document.createElement('span');
    conn.className = horiz ? 'city-conn-h' : 'city-conn';
    const pill = document.createElement('span');
    pill.className = 'city-pill';
    pill.textContent = name;
    const parts: HTMLElement[] = [pill, conn];
    if (withDot) {
      const dot = document.createElement('span');
      dot.className = 'city-dot start';
      parts.push(dot);
    }
    el.append(...(dir === 'up' || dir === 'left' ? parts : parts.reverse()));
    return el;
  }

  onMount(() => {
    requestAnimationFrame(() => (mounted = true));
    if (reduceMotion) {
      yProg = 1;
    } else {
      const begin = performance.now() + 450;
      const dur = 1250;
      const ease = (t: number) => 1 - Math.pow(1 - t, 3);
      const tick = (now: number) => {
        const t = Math.max(0, Math.min(1, (now - begin) / dur));
        yProg = ease(t);
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
    if (!mapEl) return;
    const c = mapColors();
    const mask = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [WORLD_RING, ...outerRings(geo.land as never)]
      }
    };
    const MAP_BOUNDS: [[number, number], [number, number]] = [
      [-5.3, 40.85],
      [9.7, 51.2]
    ];
    const circlePad = () => Math.max(10, Math.round((mapEl?.clientWidth ?? 420) * 0.145));
    map = new maplibregl.Map({
      container: mapEl,
      interactive: true,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      cooperativeGestures: isTouch,
      locale: {
        'CooperativeGesturesHandler.MobileHelpText': 'Déplacez la carte à deux doigts',
        'CooperativeGesturesHandler.WindowsHelpText': 'Ctrl + molette pour zoomer',
        'CooperativeGesturesHandler.MacHelpText': '⌘ + molette pour zoomer'
      },
      bounds: MAP_BOUNDS,
      fitBoundsOptions: { padding: circlePad() },
      style: {
        version: 8,
        sources: {
          dem: {
            type: 'raster-dem',
            tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
            encoding: 'terrarium',
            tileSize: 256,
            maxzoom: 12,
            attribution: 'Terrain Tiles · Mapzen/AWS'
          },
          mask: { type: 'geojson', data: mask as never },
          landu: { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: geo.land } as never },
          france: { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: geo.france } as never },
          catalogne: { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: geo.catalogne } as never },
          traces: { type: 'geojson', data: traceFC as never },
          ends: { type: 'geojson', data: endsFC as never },
          cursor: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } as never }
        },
        layers: [
          { id: 'bgfill', type: 'background', paint: { 'background-color': c.bg } },
          { id: 'land', type: 'fill', source: 'landu', paint: { 'fill-color': c.landFill } },
          {
            id: 'relief',
            type: 'hillshade',
            source: 'dem',
            paint: {
              'hillshade-exaggeration': 0.6,
              'hillshade-shadow-color': c.shadow,
              'hillshade-highlight-color': c.highlight,
              'hillshade-accent-color': c.accentDem
            }
          },
          { id: 'mask', type: 'fill', source: 'mask', paint: { 'fill-color': c.bg } },
          {
            id: 'outline',
            type: 'line',
            source: 'france',
            paint: { 'line-color': c.border, 'line-width': 1 }
          },
          {
            id: 'region',
            type: 'line',
            source: 'catalogne',
            paint: { 'line-color': c.border, 'line-width': 0.8, 'line-dasharray': [2.5, 2.5] }
          },
          {
            id: 'trace',
            type: 'line',
            source: 'traces',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': c.ink,
              'line-width': ['case', ['get', 'done'], 2.2, 1.5] as never,
              'line-opacity': ['case', ['get', 'done'], 0.2, 0.13] as never
            }
          },
          {
            id: 'trace-hi-case',
            type: 'line',
            source: 'traces',
            filter: ['==', ['get', 'n'], -1],
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': c.caseCol, 'line-width': 7 }
          },
          {
            id: 'trace-hi',
            type: 'line',
            source: 'traces',
            filter: ['==', ['get', 'n'], -1],
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': c.ink, 'line-width': 3.6 }
          },
          {
            id: 'start-hi',
            type: 'circle',
            source: 'ends',
            filter: ['==', ['get', 'n'], -1],
            paint: { 'circle-radius': 4, 'circle-color': c.landFill, 'circle-stroke-width': 2.2, 'circle-stroke-color': c.ink }
          },
          {
            id: 'end-hi',
            type: 'circle',
            source: 'ends',
            filter: ['==', ['get', 'n'], -1],
            paint: { 'circle-radius': 4.5, 'circle-color': c.ink, 'circle-stroke-width': 1.6, 'circle-stroke-color': c.caseCol }
          },
          {
            id: 'cursor-dot',
            type: 'circle',
            source: 'cursor',
            paint: { 'circle-radius': 5, 'circle-color': '#fff', 'circle-stroke-width': 2, 'circle-stroke-color': '#000' }
          }
        ]
      }
    });
    map.doubleClickZoom.disable();
    map.keyboard.disable();
    map.touchZoomRotate.disableRotation();
    map.on('load', () => {
      mapReady = true;
      const cam = map!.cameraForBounds(MAP_BOUNDS, { padding: circlePad() });
      if (cam?.zoom != null) map!.setMinZoom(cam.zoom - 0.01);
    });

    const flashHint = () => {
      zoomHint = ZOOM_HINT;
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => (zoomHint = null), 1400) as unknown as number;
    };
    mapEl.addEventListener(
      'wheel',
      (e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          zoomHint = null;
        } else {
          e.stopPropagation();
          flashHint();
        }
      },
      { capture: true, passive: false }
    );

    const pickStage = (pt: maplibregl.Point) => {
      const box: [maplibregl.PointLike, maplibregl.PointLike] = [
        [pt.x - 7, pt.y - 7],
        [pt.x + 7, pt.y + 7]
      ];
      const f = map!.queryRenderedFeatures(box, { layers: ['trace-hi', 'trace'] });
      return f.length ? (f[0].properties!.n as number) : null;
    };
    map.on('click', (e) => {
      const n = pickStage(e.point);
      if (n == null) return;
      const seg = geometry.segs.find((g) => g.s.n === n);
      if (seg) {
        pinned = pinned?.s.n === n ? null : seg;
        hoverSeg = null;
      }
    });
    map.on('mousemove', (e) => {
      if (map) map.getCanvas().style.cursor = pickStage(e.point) != null ? 'pointer' : '';
    });
    for (const [name, lng, lat] of [
      ['Barcelone', 2.1734, 41.3851],
      ['Paris', 2.3522, 48.8566]
    ] as const) {
      cityMarkers.push(
        new maplibregl.Marker({ element: calloutEl(name as string, 'up', true), anchor: 'bottom' })
          .setLngLat([lng, lat])
          .addTo(map)
      );
    }
    const ro = new ResizeObserver(() => {
      if (!map || !mapEl || mapEl.clientWidth === 0) return;
      map.resize();
      map.stop();
      const pad = Math.max(16, Math.round(mapEl.clientWidth * (pinned ? 0.2 : 0.145)));
      map.fitBounds(viewBounds(), { padding: pad, duration: 0 });
    });
    ro.observe(mapEl);
    return () => {
      ro.disconnect();
      map?.remove();
      map = null;
    };
  });

  const MAP_BOUNDS_C: [[number, number], [number, number]] = [
    [-5.3, 40.85],
    [9.7, 51.2]
  ];
  const viewBounds = (): [[number, number], [number, number]] =>
    pinned ? bbox(routeOf(pinned.s.n).path) : MAP_BOUNDS_C;

  const resetView = () => {
    if (pinned) {
      pinned = null;
      hoverSeg = null;
    } else if (map && mapEl) {
      map.fitBounds(MAP_BOUNDS_C, { padding: Math.round(mapEl.clientWidth * 0.145), duration: 500 });
    }
  };

  $effect(() => {
    void pinned;
    if (!map || !mapReady || !mapEl || mapEl.clientWidth === 0) return;
    const pad = Math.max(16, Math.round(mapEl.clientWidth * (pinned ? 0.2 : 0.145)));
    map.stop();
    map.fitBounds(viewBounds(), { padding: pad, duration: firstFit || reduceMotion ? 0 : 650 });
    firstFit = false;

    for (const m of epMarkers) m.remove();
    epMarkers = [];
    for (const m of cityMarkers) m.getElement().style.display = pinned ? 'none' : '';
    if (pinned) {
      const p = routeOf(pinned.s.n).path;
      const c0 = p[0];
      const c1 = p[p.length - 1];
      const size = mapEl.clientWidth;
      const cam = map.cameraForBounds(viewBounds(), { padding: pad });
      const zoom = cam?.zoom ?? map.getZoom();
      const ctr = maplibregl.LngLat.convert((cam?.center ?? map.getCenter()) as maplibregl.LngLatLike);
      const ws = 512 * Math.pow(2, zoom);
      const mx = (lng: number) => (lng + 180) / 360;
      const my = (lat: number) => {
        const s = Math.sin((lat * Math.PI) / 180);
        return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
      };
      const toPx = (c: number[]): [number, number] => [
        (mx(c[0]) - mx(ctr.lng)) * ws + size / 2,
        (my(c[1]) - my(ctr.lat)) * ws + size / 2
      ];
      const step = Math.max(1, Math.floor(p.length / 220));
      const rpts = p.filter((_, i) => i % step === 0).map(toPx);
      const estimate = (name: string) => {
        const w = name.length * 6.4 + 14;
        return w > 100 ? { w: 100, h: 34 } : { w, h: 20 };
      };
      interface Rect {
        x: number;
        y: number;
        w: number;
        h: number;
      }
      const rectFor = (pt: [number, number], dir: Dir4, ew: number, eh: number): Rect => {
        if (dir === 'up') return { x: pt[0] - ew / 2, y: pt[1] - 15 - eh, w: ew, h: eh };
        if (dir === 'down') return { x: pt[0] - ew / 2, y: pt[1] + 15, w: ew, h: eh };
        if (dir === 'left') return { x: pt[0] - 15 - ew, y: pt[1] - eh / 2, w: ew, h: eh };
        return { x: pt[0] + 15, y: pt[1] - eh / 2, w: ew, h: eh };
      };
      const score = (r: Rect, obstacles: Rect[]) => {
        let s = 0;
        for (const q of rpts) {
          if (q[0] > r.x - 5 && q[0] < r.x + r.w + 5 && q[1] > r.y - 5 && q[1] < r.y + r.h + 5) s += 3;
        }
        const lim = size / 2 - 8;
        for (const [cx, cy] of [
          [r.x, r.y],
          [r.x + r.w, r.y],
          [r.x, r.y + r.h],
          [r.x + r.w, r.y + r.h]
        ]) {
          const d = Math.hypot(cx - size / 2, cy - size / 2);
          if (d > lim) s += (d - lim) * 2;
        }
        for (const o of obstacles) {
          const ox = Math.max(0, Math.min(r.x + r.w, o.x + o.w) - Math.max(r.x, o.x));
          const oy = Math.max(0, Math.min(r.y + r.h, o.y + o.h) - Math.max(r.y, o.y));
          s += ox * oy * 0.5;
        }
        return s;
      };
      const DIRS: Dir4[] = ['up', 'down', 'right', 'left'];
      const pick = (pt: [number, number], ew: number, eh: number, obstacles: Rect[]): Dir4 => {
        let bd: Dir4 = 'up';
        let bs = Infinity;
        for (const dir of DIRS) {
          const sc = score(rectFor(pt, dir, ew, eh), obstacles);
          if (sc < bs - 0.001) {
            bs = sc;
            bd = dir;
          }
        }
        return bd;
      };
      const p0 = toPx(c0);
      const p1 = toPx(c1);
      const e0 = estimate(pinned.s.start);
      const e1 = estimate(pinned.s.end);
      const d0 = pick(p0, e0.w, e0.h, [{ x: p1[0] - 7, y: p1[1] - 7, w: 14, h: 14 }]);
      const r0 = rectFor(p0, d0, e0.w, e0.h);
      const d1 = pick(p1, e1.w, e1.h, [r0, { x: p0[0] - 7, y: p0[1] - 7, w: 14, h: 14 }]);
      for (const [name, coord, dir] of [
        [pinned.s.start, c0, d0],
        [pinned.s.end, c1, d1]
      ] as const) {
        epMarkers.push(
          new maplibregl.Marker({ element: calloutEl(name, dir, false), anchor: DIR_ANCHOR[dir] })
            .setLngLat(coord as [number, number])
            .addTo(map!)
        );
      }
    }
  });

  $effect(() => {
    const n = sel.s.n;
    const h = [...hidden];
    if (!map || !mapReady) return;
    map.setFilter('trace-hi-case', ['==', ['get', 'n'], n]);
    map.setFilter('trace-hi', ['==', ['get', 'n'], n]);
    map.setFilter('start-hi', ['all', ['==', ['get', 'n'], n], ['==', ['get', 'kind'], 'start']]);
    map.setFilter('end-hi', ['all', ['==', ['get', 'n'], n], ['==', ['get', 'kind'], 'end']]);
    map.setPaintProperty('trace', 'line-opacity', [
      'case',
      ['in', ['get', 'stype'], ['literal', h]],
      0.03,
      ['==', ['get', 'n'], n],
      0,
      ['case', ['get', 'done'], 0.2, 0.13]
    ] as never);
  });

  const JERSEYS: { key: 'jaune' | 'vert' | 'pois' | 'blanc'; label: string }[] = [
    { key: 'jaune', label: 'Général' },
    { key: 'vert', label: 'Points' },
    { key: 'pois', label: 'Montagne' },
    { key: 'blanc', label: 'Jeune' }
  ];

  const s = $derived(sel.s);
  const pg = $derived(profGeom(sel.s));
  const facts = $derived(analyzeProfile(routeOf(sel.s.n).prof, sel.s.km));
  const winnerSpeed = $derived.by(() => {
    const t = sel.result?.top?.[0]?.timeS ?? 0;
    return t > 0 ? (sel.s.km / t) * 3600 : 0;
  });
  const dec1 = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const selIdx = $derived(geometry.segs.findIndex((g) => g.s.n === sel.s.n));
  const goto = (d: number) => {
    const i = selIdx + d;
    if (i >= 0 && i < geometry.segs.length) {
      pinned = geometry.segs[i];
      hoverSeg = null;
    }
  };

  let scrollEl = $state<HTMLDivElement>();
  let hasMore = $state(false);
  let moreOpen = $state(false);
  $effect(() => {
    moreOpen = !sel.result?.top.length;
  });
  const refreshMore = () => {
    const el = scrollEl;
    if (el) hasMore = el.scrollHeight - el.scrollTop - el.clientHeight > 2;
  };
  $effect(() => {
    void sel;
    const el = scrollEl;
    if (!el) return;
    el.scrollTop = 0;
    const update = () => {
      hasMore = el.scrollHeight - el.scrollTop - el.clientHeight > 2;
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  });

  const finalLabel = $derived.by(() => {
    const p = facts.finalPct;
    if (p >= 1.5) return `en montée, ≈ ${Math.round(p)} % de moyenne`;
    if (p <= -1.5) return `en descente, ≈ ${Math.round(Math.abs(p))} % de moyenne`;
    return 'plat';
  });
  const selFacts = $derived(sel.result ? stageFacts(sel.s.n) : []);
  const provisional = $derived(sel.state === 'today' && !!sel.result);

  const climbList = $derived.by(() => {
    const out: { cat: ClimbCat; name: string; alt: number | null; kmToGo: number; desgrange: boolean; laps: number }[] = [];
    for (const c of sel.s.climbs) {
      const prev = out.find((o) => o.name === c.name && o.cat === c.cat);
      if (prev) prev.laps++;
      else out.push({ ...c, laps: 1 });
    }
    return out.sort((a, b) => b.kmToGo - a.kmToGo);
  });

  const colSummary = $derived(
    CAT_ORDER.filter((c) => sel.s.nCat[c]).map((c) => `${sel.s.nCat[c]} ${c === 'HC' ? 'HC' : c === '1' ? 'cat. 1' : c === '2' ? 'cat. 2' : c === '3' ? 'cat. 3' : 'cat. 4'}`).join(' · ')
  );
  const desgrangeCol = $derived(sel.s.climbs.find((c) => c.desgrange) ?? null);

  const jerseyActive = $derived.by(() => {
    const upTo = geometry.segs.filter((g) => g.result && g.s.n <= sel.s.n);
    return {
      jaune: true,
      vert: upTo.some((g) => !g.result!.teamStage && g.s.type !== 'clm'),
      pois: upTo.some((g) => g.s.climbs.length > 0),
      blanc: true
    };
  });

  const deg = (a: number) => (a * 180) / Math.PI;
  const stageAria = (g: Seg) =>
    `Étape ${g.s.n}, ${g.s.start} vers ${g.s.end}, ${g.s.clmLabel ?? TYPE_LABEL[g.s.type]}, ${fmtKm(g.s.km)} kilomètres, ${fmtDate(g.s.date)}`;
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape') resetView();
    else if (e.key === 'ArrowLeft') goto(-1);
    else if (e.key === 'ArrowRight') goto(1);
  }}
/>

{#snippet typeGlyph(t: StageType)}
  <g class="tg" transform="translate(-12 -12)">
    {#if t === 'montagne'}
      <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
    {:else if t === 'accidentee'}
      <path d="M2 15a5 5 0 0 1 10 0" />
      <path d="M12 15a5 5 0 0 1 10 0" />
    {:else if t === 'clm'}
      <line x1="10" x2="14" y1="2" y2="2" />
      <line x1="12" x2="15" y1="14" y2="11" />
      <circle cx="12" cy="14" r="8" />
    {/if}
  </g>
{/snippet}

<div class="tdf" bind:this={tdfEl}>
  <div class="layout">
  <div class="wheel-col">
    <div class="topbar">
    <div class="dash">
      {#if latest}
        {@const jaune = latest.result.jerseys.jaune}
        {@const second = latest.result.gc[1]}
        <span class="d-item lead"><span class="jchip jaune"></span><b>{riderName(jaune)}</b>{#if riderFlag(jaune)}&nbsp;{riderFlag(jaune)}{/if}</span>
        {#if second}
          <span class="d-item">{fmtGap(second[1])} sur {riderName(second[0])}</span>
        {/if}
        <span class="d-item muted">après l'étape {latest.stage.n}</span>
        {#if todaySeg && !todaySeg.result}
          <span class="d-item"><span class="live-dot"></span>Aujourd'hui : ét. {todaySeg.s.n}, {todaySeg.s.start} → {todaySeg.s.end}</span>
        {/if}
      {:else if todaySeg}
        <span class="d-item lead"><span class="live-dot"></span><b>Aujourd'hui · Étape {todaySeg.s.n}</b></span>
        <span class="d-item">{todaySeg.s.start} → {todaySeg.s.end}</span>
        <span class="d-item muted">{todaySeg.s.clmLabel ?? TYPE_LABEL[todaySeg.s.type]} · résultats en soirée</span>
      {:else}
        <span class="d-item lead"><b>Grand Départ samedi 4 juillet · Barcelone</b></span>
        <span class="d-item muted">{fmtKm(TOTAL_KM)} km · 21 étapes · Paris le 26 juillet</span>
      {/if}
    </div>
    <div class="legend">
      {#each Object.entries(TYPE_LABEL) as [key, label]}
        <button
          class="lg-item"
          class:off={hidden.includes(key as StageType)}
          aria-pressed={!hidden.includes(key as StageType)}
          onclick={() => toggleType(key as StageType)}
          title="Afficher / masquer les étapes de ce type"
        >
          <svg class="lg-swatch" viewBox="-10 -7 20 14" aria-hidden="true">
            <rect x="-10" y="-7" width="20" height="14" rx="4" style:fill={TYPE_COLOR[key as keyof typeof TYPE_COLOR]} />
            <g transform="scale(0.44)">{@render typeGlyph(key as StageType)}</g>
          </svg>{label}
        </button>
      {/each}
    </div>
    </div>

    <div class="wheel-fit" bind:this={wheelFitEl}>
    <div class="wrap" bind:this={wrapEl}>
      <svg viewBox="-360 -360 720 720" class="loop" role="img" aria-label="La Grande Boucle 2026, les 21 étapes du Tour de France">
        <circle cx="0" cy="0" r={R} class="base" />

        {#if todaySeg}
          <path d={arc(todaySeg.a0, todaySeg.a1, R)} class="halo" stroke-width={W + 14} />
        {/if}

        <g class="segs">
          {#each geometry.segs as g, i}
            <g
              class="seg"
              class:in={mounted}
              class:selected={sel.s.n === g.s.n}
              class:pinned={pinned?.s.n === g.s.n}
              class:dimmed={isHidden(g.s.type)}
              style:transition-delay="{i * 32}ms"
              role="button"
              tabindex="0"
              aria-label={stageAria(g)}
              aria-pressed={pinned?.s.n === g.s.n}
              onmouseenter={() => (hoverSeg = g)}
              onmouseleave={() => (hoverSeg = null)}
              onfocus={() => (hoverSeg = g)}
              onblur={() => (hoverSeg = null)}
              onclick={() => (pinned = pinned?.s.n === g.s.n ? null : g)}
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  pinned = pinned?.s.n === g.s.n ? null : g;
                }
              }}
            >
              {#if sel.s.n === g.s.n}
                <path d={arc(g.a0, g.a1, R)} class="sel-ring" class:is-pin={pinned?.s.n === g.s.n} stroke-width={W + 9} />
              {/if}
              <path
                d={arc(g.a0, g.a1, R)}
                class="stage"
                style:stroke={g.color}
                stroke-width={W}
              />
              <text x={P(g.mid, R - W / 2 - 15)[0]} y={P(g.mid, R - W / 2 - 15)[1]} class="num" class:today={g.state === 'today'}>{g.s.n}</text>
              {#if g.s.type !== 'plat'}
                <g class="tglyph" transform="translate({P(g.mid, R)[0].toFixed(1)} {P(g.mid, R)[1].toFixed(1)}) scale(0.5)">{@render typeGlyph(g.s.type)}</g>
              {/if}
              <path d={arc(g.a0, g.a1, R)} class="hit" stroke-width={W + 16} />
            </g>
          {/each}
        </g>

        {#each geometry.rests as r}
          {@const rp = P(r.a, R)}
          <g
            class="rest"
            class:in={mounted}
            role="button"
            tabindex="-1"
            aria-label="Journée de repos, {fmtDate(r.date)}, {r.place}"
            onmouseenter={() => (restTip = { lx: ((rp[0] + 360) / 720) * 100, ly: ((rp[1] + 360) / 720) * 100, date: r.date, place: r.place })}
            onmouseleave={() => (restTip = null)}
          >
            <circle cx={rp[0]} cy={rp[1]} r="7" class="rest-hit" />
            <circle cx={rp[0]} cy={rp[1]} r="5.5" class="rest-dot" />
          </g>
        {/each}

        <g class="yellow" class:in={mounted}>
          {#if lastDone}
            {@const endA = SEAM / 2 + yProg * (lastDone.a1 - SEAM / 2)}
            {#if endA > SEAM / 2 + 0.003}
              <path d={arc(SEAM / 2, endA, R + W / 2 + 11)} class="yline" />
            {/if}
            <circle cx={P(endA, R + W / 2 + 11)[0]} cy={P(endA, R + W / 2 + 11)[1]} r="6" class="ydot" />
          {:else}
            <circle cx={P(SEAM / 2, R + W / 2 + 11)[0]} cy={P(SEAM / 2, R + W / 2 + 11)[1]} r="6" class="ydot" />
          {/if}
        </g>

        <g class="seam-labels" class:in={mounted}>
          <text x={P(SEAM / 2, R)[0] + 26} y={P(SEAM / 2, R)[1] - 42} text-anchor="start">
            <tspan class="seam-top">Grand Départ · 4 juil.</tspan>
            <tspan class="seam-city" x={P(SEAM / 2, R)[0] + 26} dy="13">Barcelone</tspan>
          </text>
          <text x={P(-SEAM / 2, R)[0] - 26} y={P(-SEAM / 2, R)[1] - 42} text-anchor="end">
            <tspan class="seam-top">Arrivée · 26 juil.</tspan>
            <tspan class="seam-city" x={P(-SEAM / 2, R)[0] - 26} dy="13">Paris</tspan>
          </text>
        </g>
      </svg>

      {#if !mapReady}
        <div class="map-skeleton" aria-hidden="true"></div>
      {/if}
      <div class="mapc" class:in={mapReady} bind:this={mapEl}></div>

      {#if zoomHint}
        <div class="zoom-hint">{zoomHint}</div>
      {/if}

      {#if restTip}
        <div class="rest-tip" style:left="{restTip.lx}%" style:top="{restTip.ly}%">
          <span class="rt-cap">Journée de repos</span>
          <span class="rt-date">{fmtDate(restTip.date)}</span>
          <span class="rt-place">{restTip.place}</span>
        </div>
      {/if}

    </div>
    <div class="zoom-buttons" class:in={mapReady}>
      <button aria-label="Zoom avant" onclick={() => map?.zoomIn()}>+</button>
      <button aria-label="Zoom arrière" onclick={() => map?.zoomOut()}>−</button>
      <button class="reset" aria-label="Réinitialiser la vue" onclick={resetView}>⟲</button>
    </div>
    <div class="shortcuts" class:in={mapReady} aria-hidden="true">
      {#if isTouch}
        <span>Touchez une étape pour zoomer sur son tracé</span>
        <span>Pincez à deux doigts pour zoomer</span>
      {:else}
        <span>Cliquez une étape pour zoomer sur son tracé</span>
        <span><b>Esc</b> pour réinitialiser</span>
        <span><b>{isMac ? '⌘' : 'Ctrl'}</b> + molette pour zoomer</span>
      {/if}
    </div>
    </div>
  </div>

  <aside class="panel" aria-live="polite">
    <div class="p-nav">
      <button class="p-arrow" aria-label="Étape précédente" disabled={selIdx === 0} onclick={() => goto(-1)}>
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"
          ><path d="M14.5 6 9 12l5.5 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg
        >
      </button>
      <span class="p-pos">Étape {s.n} / 21</span>
      <button class="p-arrow" aria-label="Étape suivante" disabled={selIdx === geometry.segs.length - 1} onclick={() => goto(1)}>
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"
          ><path d="M9.5 6 15 12l-5.5 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg
        >
      </button>
    </div>

    <div class="p-scroll" bind:this={scrollEl}>
      <div class="p-head">
        <div class="p-meta">
          <span class="type-dot" style:background={sel.color}></span>
          <span class="p-round">{s.clmLabel ?? TYPE_LABEL[s.type]}</span>
          <span class="p-sep">·</span>
          <span class="p-date">{fmtDate(s.date)}</span>
        </div>
        <h3 class="p-title">{s.start} → {s.end}</h3>
        <p class="p-facts">
          {fmtKm(s.km)} km · D+ {fmtInt(s.dplus)} m{s.alt ? ' · arrivée en altitude' : ''}
        </p>
        <p class="p-times">
          <span class="pt-item"><span class="pt-dot dep"></span>{s.departLabel} {fmtHm(s.departTime)}</span>
          <span class="pt-item"><span class="pt-dot arr"></span>{s.arriveeLabel} {fmtHm(s.arriveeTime)}</span>
        </p>
        {#if sel.state === 'today' && !sel.result}
          <p class="p-live"><span class="live-dot"></span>En course aujourd'hui · résultats en soirée</p>
        {/if}
      </div>

      <div class="p-prof">
        <svg
          viewBox="0 0 {PW} {PH}"
          class="prof"
          role="img"
          aria-label="Profil de l'étape {s.n} : de {s.start} à {s.end}, altitude maximale {fmtInt(s.altmax)} mètres"
          bind:this={profSvg}
          onmousemove={onProfMove}
          onmouseleave={onProfLeave}
          ontouchstart={(e) => onProfMove(e.touches[0])}
          ontouchmove={(e) => {
            e.preventDefault();
            onProfMove(e.touches[0]);
          }}
          ontouchend={onProfLeave}
        >
          {#each pg.yTicks as t}
            <line x1={PM.left} x2={PW - PM.right} y1={t.y} y2={t.y} class="p-grid" />
            <text x={PM.left - 4} y={t.y} class="p-ytick">{fmtInt(t.v)}</text>
          {/each}
          {#each pg.xTicks as t}
            <line x1={t.x} x2={t.x} y1={pg.baseY} y2={pg.baseY + 3} class="p-grid" />
            <text x={t.x} y={pg.baseY + 13} class="p-xtick">{t.v}</text>
          {/each}
          <text x={PW - PM.right} y={pg.baseY + 13} class="p-xunit">km</text>
          <text x={PM.left - 4} y={PM.top - 9} class="p-ytick unit">alt. (m)</text>
          <path d={pg.area} class="prof-area" />
          <path d={pg.line} class="prof-line" />
          <line x1={PM.left} x2={PW - PM.right} y1={pg.baseY} y2={pg.baseY} class="p-axis" />
          {#if pg.sprint}
            <line x1={pg.sprint.x} x2={pg.sprint.x} y1={pg.sprint.y} y2={pg.baseY} class="sprint-stem" />
            <g transform="translate({pg.sprint.x} {pg.sprint.y - 5})">
              <rect x="-5.5" y="-9" width="11" height="11" rx="2.5" class="sprint-chip" />
              <text class="sprint-txt" y="-0.5">S</text>
            </g>
          {/if}
          {#each pg.cols as c}
            <line x1={c.x} x2={c.x} y1={c.y} y2={pg.baseY} class="col-stem" class:hc={c.cat === 'HC' || c.cat === '1'} />
            <g transform="translate({c.x} {c.y - 6})">
              <rect x="-6.5" y="-10.5" width="13" height="12" rx="2.5" class="col-chip" class:strong={c.cat === 'HC' || c.cat === '1'} />
              <text class="col-txt" class:on-strong={c.cat === 'HC' || c.cat === '1'} y="-1.5">{c.cat}</text>
            </g>
          {/each}
          <circle cx={pg.apex.x} cy={pg.apex.y} r="2.6" class="apex-dot" />
          {#if profCursor}
            <line x1={profCursor.x} x2={profCursor.x} y1={PM.top - 4} y2={pg.baseY} class="cur-line" />
            <circle cx={profCursor.x} cy={profCursor.y} r="3.2" class="cur-dot" />
            <g transform="translate({Math.max(PM.left + 2, Math.min(PW - PM.right - 2, profCursor.x))} {PM.top - 8})">
              <text class="cur-lbl" text-anchor={profCursor.x > PW / 2 ? 'end' : 'start'}
                >{fmtInt(profCursor.km)} km · {fmtInt(profCursor.alt)} m</text
              >
            </g>
          {/if}
        </svg>
        <div class="p-cities">
          <span>{s.start}</span>
          <span>{s.end}</span>
        </div>
        <p class="p-src">D'après le tracé GPS officiel · altitudes lissées, pentes indicatives</p>
      </div>

      {#if sel.result?.top.length}
        <div class="p-section">
          <h4 class="p-stitle">Le résultat{#if provisional}<span class="prov-tag">provisoire</span>{/if}</h4>
          <ol class="p-top">
            {#each sel.result.top as t}
              <li class:win={t.rank === 1}>
                <span class="t-rank">{t.rank}</span>
                <span class="t-name"
                  >{sel.result.teamStage ? properName(t.name) : t.bib ? riderName(t.bib) : properName(t.name)}</span
                >
                <span class="t-time">{t.rank === 1 ? fmtTime(t.timeS) : fmtGap(t.gapS)}</span>
              </li>
            {/each}
          </ol>
        </div>
        <div class="p-section">
          <h4 class="p-stitle">Les maillots après l'étape</h4>
          <div class="p-jerseys">
            {#each JERSEYS as j}
              {@const bib = sel.result.jerseys[j.key]}
              {#if bib != null && jerseyActive[j.key]}
                <span class="jline"><span class="jchip {j.key}"></span><span class="j-name">{riderName(bib)}</span><span class="j-role">{j.label}</span></span>
              {/if}
            {/each}
          </div>
        </div>
        {#if selFacts.length}
          <div class="p-section">
            <h4 class="p-stitle">Faits marquants</h4>
            <ul class="p-facts-list">
              {#each selFacts as f}
                <li>{f}</li>
              {/each}
            </ul>
          </div>
        {/if}
      {:else if sel.state === 'future'}
        <p class="p-wait">Départ {fmtDate(s.date)} · résultats ici le soir même.</p>
      {/if}

      <details class="p-more" bind:open={moreOpen} ontoggle={() => requestAnimationFrame(refreshMore)}>
        <summary class="p-morehead">
          <span>Le parcours en détail</span>
          <svg class="m-chev" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"
            ><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg
          >
        </summary>

        {#if climbList.length}
          <div class="p-section">
            <h4 class="p-stitle">Les cols &amp; difficultés</h4>
            <ul class="p-cols">
              {#each climbList as c}
                <li>
                  <span class="cat-chip cat-{c.cat === 'HC' ? 'hc' : c.cat}">{c.cat}</span>
                  <span class="col-name"
                    >{c.name}{#if c.laps > 1}<span class="col-laps"> ×{c.laps}</span>{/if}{#if c.desgrange}<span class="desgrange" title="Souvenir Henri Desgrange, toit du Tour"> ★</span>{/if}</span
                  >
                  <span class="col-meta">{#if c.alt}{fmtInt(c.alt)} m · {/if}à {fmtKm(c.kmToGo)} km</span>
                </li>
              {/each}
            </ul>
          </div>
        {/if}

        <div class="p-section">
          <h4 class="p-stitle">Le parcours en chiffres</h4>
          <dl class="p-facts-grid">
            <div class="pf">
              <dt>Dénivelé positif</dt>
              <dd>{fmtInt(s.dplus)} m</dd>
            </div>
            <div class="pf">
              <dt>Point culminant</dt>
              <dd>{fmtInt(s.altmax)} m{#if desgrangeCol} ★{/if}</dd>
            </div>
            {#if colSummary}
              <div class="pf">
                <dt>Cols répertoriés</dt>
                <dd>{colSummary}</dd>
              </div>
            {/if}
            {#if s.sprint}
              <div class="pf wide">
                <dt>Sprint intermédiaire</dt>
                <dd>{s.sprint.name} · à {fmtKm(s.km - s.sprint.kmDone)} km</dd>
              </div>
            {/if}
            <div class="pf">
              <dt>Les {fmtKm(facts.finalKm)} derniers km</dt>
              <dd>{finalLabel}</dd>
            </div>
            {#if winnerSpeed > 0}
              <div class="pf">
                <dt>Vitesse moyenne du vainqueur</dt>
                <dd>{dec1(winnerSpeed)} km/h</dd>
              </div>
            {/if}
          </dl>
          {#if desgrangeCol}
            <p class="desgrange-note">★ {desgrangeCol.name} · point culminant du Tour 2026, Souvenir Henri Desgrange.</p>
          {/if}
        </div>
      </details>
    </div>

    <div class="p-fade" class:on={hasMore} aria-hidden="true">
      <span class="chev-badge">
        <svg class="chev" viewBox="0 0 24 24" width="18" height="18"
          ><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" /></svg
        >
      </span>
    </div>
  </aside>
  </div>
</div>

<style>
  .tdf {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .topbar {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
  }
  @media (max-width: 879.9px) {
    .topbar {
      align-items: center;
    }
    .dash,
    .legend {
      justify-content: center;
    }
  }
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
    min-height: 0;
  }
  @media (min-width: 880px) {
    .tdf {
      min-height: 460px;
    }
    .layout {
      flex: 1;
      grid-template-columns: minmax(0, 1.42fr) minmax(300px, 1fr);
      align-items: stretch;
    }
    .wheel-col {
      display: flex;
      flex-direction: column;
      min-height: 0;
      gap: 8px;
    }
    .wheel-fit {
      flex: 1;
      min-height: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .wrap {
      aspect-ratio: 1 / 1;
    }
    .loop {
      width: 100%;
      height: 100%;
    }
    .panel {
      align-self: start;
      max-height: 100%;
    }
  }
  @media (max-width: 879.9px) {
    .p-scroll {
      max-height: 480px;
    }
  }
  .wrap {
    position: relative;
  }
  .wheel-fit {
    position: relative;
  }
  .loop {
    width: 100%;
    height: auto;
    display: block;
  }
  .base {
    fill: none;
    stroke: var(--divider);
    stroke-width: 1;
  }
  .seg {
    cursor: pointer;
    outline: none;
    opacity: 0;
    transition: opacity 0.5s ease;
  }
  .seg.in {
    opacity: 1;
  }
  .stage {
    fill: none;
    stroke-opacity: 0.92;
    transition: stroke-opacity 0.15s ease;
  }
  .seg:hover .stage,
  .seg:focus-visible .stage,
  .seg.selected .stage {
    stroke-opacity: 1;
  }
  .sel-ring {
    fill: none;
    stroke: #fff;
    stroke-opacity: 0.85;
  }
  .sel-ring.is-pin {
    stroke: var(--tdf-jaune);
    stroke-opacity: 1;
  }
  .alt-mark {
    fill: var(--bg);
  }
  .hit {
    fill: none;
    stroke: transparent;
    pointer-events: stroke;
  }
  .num {
    fill: var(--text-muted);
    font: 600 12px var(--font);
    text-anchor: middle;
    dominant-baseline: middle;
    pointer-events: none;
  }
  .num.today {
    fill: var(--text);
    font-weight: 800;
  }
  .tglyph {
    pointer-events: none;
  }
  .tg {
    fill: none;
    stroke: #000;
    stroke-width: 2.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .halo {
    fill: none;
    stroke: var(--tdf-jaune);
    stroke-opacity: 0.28;
    animation: haloPulse 1.6s ease-in-out infinite;
  }
  @keyframes haloPulse {
    0%,
    100% {
      stroke-opacity: 0.14;
    }
    50% {
      stroke-opacity: 0.3;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .halo {
      animation: none;
    }
  }
  .rest {
    opacity: 0;
    transition: opacity 0.5s ease 0.8s;
  }
  .rest.in {
    opacity: 1;
  }
  .rest {
    cursor: pointer;
  }
  .rest-hit {
    fill: transparent;
  }
  .rest-dot {
    fill: #fff;
    stroke: #000;
    stroke-width: 1.5;
  }
  .rest:hover .rest-dot {
    fill: var(--tdf-jaune);
    stroke: var(--tdf-jaune);
  }
  .rest-tip {
    position: absolute;
    z-index: 8;
    transform: translate(-50%, calc(-100% - 10px));
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    padding: 7px 12px;
    border-radius: 10px;
    background: var(--surface);
    border: 1px solid var(--border);
    box-shadow: 0 8px 24px var(--backdrop);
    pointer-events: none;
    white-space: nowrap;
    text-align: center;
  }
  .rt-cap {
    font: 700 9px var(--font);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--tdf-jaune);
  }
  .rt-date {
    font: 700 12.5px var(--font);
    color: var(--text);
  }
  .rt-place {
    font: 500 11px var(--font);
    color: var(--text-muted);
  }
  .yellow {
    opacity: 0;
    transition: opacity 0.3s ease 0.35s;
  }
  .yellow.in {
    opacity: 1;
  }
  .yline {
    fill: none;
    stroke: var(--tdf-jaune);
    stroke-width: 5;
    stroke-linecap: round;
  }
  .ydot {
    fill: var(--tdf-jaune);
    stroke: var(--bg);
    stroke-width: 1.5;
  }
  .seam-labels {
    opacity: 0;
    transition: opacity 0.6s ease 0.7s;
  }
  .seam-labels.in {
    opacity: 1;
  }
  .seam-top {
    fill: var(--text-muted);
    font: 600 10.5px var(--font);
  }
  .seam-city {
    fill: var(--text);
    font: 800 13px var(--font);
  }

  .mapc {
    position: absolute;
    inset: 15.5%;
    border-radius: 50%;
    overflow: hidden;
    clip-path: circle(50%);
    pointer-events: auto;
    opacity: 0;
    transition: opacity 0.8s ease 0.35s;
  }
  .mapc.in {
    opacity: 1;
  }
  .map-skeleton {
    position: absolute;
    inset: 15.5%;
    border-radius: 50%;
    background: color-mix(in srgb, var(--text) 5%, transparent);
    animation: skel 1.4s ease-in-out infinite;
  }
  @keyframes skel {
    0%,
    100% {
      opacity: 0.4;
    }
    50% {
      opacity: 0.8;
    }
  }
  .mapc :global(.maplibregl-canvas) {
    outline: none;
  }
  .zoom-buttons {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 6;
    display: flex;
    flex-direction: column;
    gap: 6px;
    opacity: 0;
    transition: opacity 0.5s ease 0.6s;
  }
  .zoom-buttons.in {
    opacity: 1;
  }
  .zoom-buttons button {
    width: 30px;
    height: 30px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text-secondary);
    border-radius: 7px;
    font-size: 17px;
    line-height: 1;
    cursor: pointer;
    transition: all 0.12s;
  }
  .zoom-buttons button:hover {
    border-color: var(--border-strong);
    background: var(--surface-hover);
    color: var(--text);
  }
  .zoom-buttons .reset {
    font-size: 15px;
  }
  .zoom-hint {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: 7;
    padding: 7px 16px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.85);
    border: 1px solid var(--border-strong);
    color: var(--text);
    font: 600 12.5px var(--font);
    white-space: nowrap;
    pointer-events: none;
    animation: hintIn 0.15s ease;
  }
  @keyframes hintIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  .shortcuts {
    position: absolute;
    bottom: 0;
    right: 0;
    z-index: 6;
    max-width: 170px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 1px;
    text-align: right;
    font: 500 11px var(--font);
    color: var(--text-muted);
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.5s ease 0.6s;
  }
  .shortcuts.in {
    opacity: 1;
  }
  .shortcuts b {
    color: var(--text-secondary);
    font-weight: 700;
  }
  .mapc :global(.callout) {
    display: flex;
    flex-direction: column;
    align-items: center;
    pointer-events: none;
  }
  .mapc :global(.callout.left),
  .mapc :global(.callout.right) {
    flex-direction: row;
  }
  .mapc :global(.city-conn-h) {
    width: 15px;
    height: 1.5px;
    background: rgba(255, 255, 255, 0.9);
    box-shadow: 0 0 2px rgba(0, 0, 0, 0.6);
    flex: none;
  }
  .mapc :global(.city-dot) {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #000;
    border: 1.5px solid rgba(255, 255, 255, 0.9);
    flex: none;
  }
  .mapc :global(.city-dot.start) {
    background: var(--tdf-jaune);
    border-color: #000;
  }
  .mapc :global(.city-dot.end) {
    background: #000;
    border-color: #fff;
  }
  .mapc :global(.city-conn) {
    width: 1.5px;
    height: 15px;
    background: rgba(255, 255, 255, 0.9);
    box-shadow: 0 0 2px rgba(0, 0, 0, 0.6);
    flex: none;
  }
  .mapc :global(.city-pill) {
    font: 700 10px/1.3 var(--font);
    color: #000;
    background: rgba(255, 255, 255, 0.92);
    padding: 2px 6px;
    border-radius: 5px;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    white-space: normal;
    max-width: 100px;
    width: max-content;
    text-align: center;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
  }

  .dash {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 3px 14px;
    font: 400 12.5px/1.4 var(--font);
    color: var(--text-secondary);
    min-width: 0;
  }
  .d-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  }
  .d-item b {
    font-weight: 800;
    color: var(--text);
  }
  .d-item.lead {
    font-size: 14.5px;
  }
  .d-item.muted {
    color: var(--text-muted);
  }

  .live-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--accent);
    animation: haloPulse 1.4s ease-in-out infinite;
  }

  .jchip {
    width: 13px;
    height: 13px;
    border-radius: 3.5px;
    display: inline-block;
    flex: none;
    border: 1px solid rgba(0, 0, 0, 0.25);
  }
  .jchip.jaune {
    background: var(--tdf-jaune, #ffd800);
  }
  .jchip.vert {
    background: #26a04a;
  }
  .jchip.pois {
    background:
      radial-gradient(circle, #e63329 1.6px, transparent 1.9px) 0 0 / 6.5px 6.5px,
      #fff;
  }
  .jchip.blanc {
    background: #fff;
  }

  .panel {
    position: relative;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--surface);
    padding: 10px 0 0;
    font: 400 12.5px/1.4 var(--font);
    color: var(--text);
    min-width: 0;
    overflow: hidden;
  }
  .p-nav {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 10px 8px;
    border-bottom: 1px solid var(--divider);
  }
  .p-pos {
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }
  .pinbtn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border: 1px solid var(--tdf-jaune);
    border-radius: 999px;
    padding: 3px 9px;
    background: color-mix(in srgb, var(--tdf-jaune) 14%, transparent);
    color: var(--tdf-jaune);
    cursor: pointer;
  }
  .pinbtn:hover {
    background: color-mix(in srgb, var(--tdf-jaune) 22%, transparent);
  }
  .p-arrow {
    width: 26px;
    height: 26px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 999px;
    background: var(--surface-hover);
    color: var(--text-secondary);
    cursor: pointer;
  }
  .p-arrow:hover:not(:disabled) {
    color: var(--text);
  }
  .p-arrow:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .p-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 10px 14px 26px;
    scrollbar-width: thin;
  }
  .p-fade {
    position: absolute;
    left: 1px;
    right: 1px;
    bottom: 0;
    height: 52px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 7px;
    background: linear-gradient(transparent, var(--surface) 62%);
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  .p-fade.on {
    opacity: 1;
  }
  .chev-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 999px;
    background: var(--tdf-jaune);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
    animation: bob 1.4s ease-in-out infinite;
  }
  .chev {
    color: #000;
    display: block;
  }
  @keyframes bob {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(4px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .chev-badge {
      animation: none;
    }
  }
  .p-section {
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid var(--divider);
  }
  .p-stitle {
    margin: 0 0 7px;
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--text-secondary);
  }
  .prov-tag {
    margin-left: 7px;
    padding: 1px 6px;
    border-radius: 999px;
    background: var(--warn-bg);
    border: 1px solid var(--warn-border);
    color: var(--warn-text);
    font-size: 8.5px;
    letter-spacing: 0.03em;
  }
  .p-facts-list {
    margin: 0;
    padding-left: 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: var(--text-secondary);
  }
  .p-facts-list li::marker {
    color: var(--tdf-jaune);
  }
  .p-facts-grid {
    margin: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px 14px;
  }
  .pf {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }
  .pf.wide {
    grid-column: 1 / -1;
  }
  .pf dt {
    color: var(--text-muted);
    font-size: 10.5px;
  }
  .pf dd {
    margin: 0;
    font-weight: 800;
    font-size: 14px;
    font-variant-numeric: tabular-nums;
  }
  .p-head {
    padding-bottom: 10px;
  }
  .p-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    color: var(--text-muted);
    font-size: 10.5px;
  }
  .type-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    margin-right: 6px;
    flex: none;
  }
  .p-round {
    color: var(--text-secondary);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 10px;
  }
  .p-sep {
    margin: 0 5px;
  }
  .p-title {
    margin: 4px 0 0;
    font-size: 16.5px;
    font-weight: 800;
    line-height: 1.2;
  }
  .p-facts {
    margin: 2px 0 0;
    color: var(--text-muted);
    font-size: 11.5px;
  }
  .p-times {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    margin: 6px 0 0;
    font-size: 11px;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
  }
  .pt-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  }
  .pt-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex: none;
  }
  .pt-dot.dep {
    background: var(--tdf-jaune);
  }
  .pt-dot.arr {
    background: none;
    border: 1.5px solid var(--text-muted);
  }
  .p-live {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin: 7px 0 0;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .p-prof {
    border: 1px solid var(--divider);
    border-radius: 10px;
    padding: 6px 6px 4px;
    background: color-mix(in srgb, var(--text) 2.5%, transparent);
  }
  .prof {
    display: block;
    width: 100%;
    height: auto;
    font-family: var(--font);
  }
  .p-grid {
    stroke: var(--divider);
    stroke-width: 1;
  }
  .p-axis {
    stroke: var(--border-strong);
    stroke-width: 1;
  }
  .p-ytick {
    fill: var(--text-muted);
    font-size: 8.5px;
    text-anchor: end;
    dominant-baseline: middle;
    font-variant-numeric: tabular-nums;
  }
  .p-ytick.unit {
    dominant-baseline: auto;
  }
  .p-xtick {
    fill: var(--text-muted);
    font-size: 8.5px;
    text-anchor: middle;
    font-variant-numeric: tabular-nums;
  }
  .p-xunit {
    fill: var(--text-muted);
    font-size: 8.5px;
    text-anchor: end;
  }
  .prof-area {
    fill: var(--tdf-fill);
    fill-opacity: 0.92;
  }
  .prof-line {
    fill: none;
    stroke: var(--text);
    stroke-width: 1.4;
    stroke-linejoin: round;
  }
  .apex-dot {
    fill: var(--text);
    stroke: var(--surface);
    stroke-width: 1.2;
  }
  .cur-line {
    stroke: var(--tdf-jaune);
    stroke-width: 1;
    stroke-opacity: 0.7;
    pointer-events: none;
  }
  .cur-dot {
    fill: #fff;
    stroke: #000;
    stroke-width: 1.4;
    pointer-events: none;
  }
  .cur-lbl {
    fill: var(--text);
    font-size: 9px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    pointer-events: none;
  }
  .prof {
    touch-action: none;
  }
  .col-stem {
    stroke: var(--text-muted);
    stroke-width: 0.8;
    stroke-dasharray: 1.5 1.5;
  }
  .col-stem.hc {
    stroke: var(--tdf-jaune);
    stroke-opacity: 0.8;
    stroke-dasharray: none;
    stroke-width: 1;
  }
  .col-chip {
    fill: var(--surface);
    stroke: var(--border-strong);
    stroke-width: 0.8;
  }
  .col-chip.strong {
    fill: var(--tdf-jaune);
    stroke: none;
  }
  .col-txt {
    fill: var(--text);
    font-size: 7.5px;
    font-weight: 800;
    text-anchor: middle;
  }
  .col-txt.on-strong {
    fill: #000;
  }
  .sprint-stem {
    stroke: var(--text-muted);
    stroke-width: 0.8;
    stroke-dasharray: 1.5 1.5;
  }
  .sprint-chip {
    fill: var(--surface);
    stroke: var(--text-secondary);
    stroke-width: 0.8;
  }
  .sprint-txt {
    fill: var(--text-secondary);
    font-size: 7px;
    font-weight: 800;
    text-anchor: middle;
  }
  .p-cols {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .p-cols li {
    display: grid;
    grid-template-columns: 26px minmax(0, 1fr) auto;
    align-items: center;
    gap: 9px;
    padding: 3px 4px;
    border-radius: 6px;
  }
  .p-cols li:nth-child(odd) {
    background: var(--surface-hover);
  }
  .cat-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 16px;
    border-radius: 4px;
    font-size: 9.5px;
    font-weight: 800;
    color: var(--text);
    border: 1px solid var(--border-strong);
    font-variant-numeric: tabular-nums;
  }
  .cat-chip.cat-hc {
    background: var(--tdf-jaune);
    color: #000;
    border: none;
  }
  .cat-chip.cat-1 {
    border-color: var(--tdf-jaune);
    color: var(--tdf-jaune);
  }
  .col-name {
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .col-laps {
    color: var(--text-muted);
    font-weight: 700;
  }
  .desgrange {
    color: var(--tdf-jaune);
  }
  .col-meta {
    color: var(--text-muted);
    font-size: 10.5px;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .desgrange-note {
    margin: 8px 0 0;
    color: var(--text-muted);
    font-size: 10.5px;
    line-height: 1.4;
  }
  .pf.wide dd {
    white-space: normal;
  }
  .p-cities {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding: 3px 4px 2px;
    color: var(--text-secondary);
    font-size: 10px;
    font-weight: 600;
  }
  .p-cities span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .p-top {
    list-style: none;
    margin: 10px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .p-top li {
    display: grid;
    grid-template-columns: 16px minmax(0, 1fr) auto;
    gap: 7px;
    align-items: baseline;
    padding: 3px 6px;
    border-radius: 6px;
  }
  .p-top li:nth-child(odd) {
    background: var(--surface-hover);
  }
  .t-rank {
    color: var(--text-muted);
    font-size: 10.5px;
    font-weight: 700;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .t-name {
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  li.win .t-name {
    font-weight: 800;
  }
  .t-time {
    font-variant-numeric: tabular-nums;
    color: var(--text-secondary);
    font-size: 11px;
    white-space: nowrap;
  }
  li.win .t-time {
    color: var(--text);
    font-weight: 700;
  }
  .p-jerseys {
    margin-top: 10px;
    padding-top: 9px;
    border-top: 1px solid var(--divider);
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 10px;
  }
  .jline {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  .j-name {
    font-weight: 600;
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .j-role {
    color: var(--text-muted);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    flex: none;
  }
  .p-wait {
    margin: 10px 0 2px;
    color: var(--text-muted);
    font-size: 11.5px;
  }
  .p-src {
    margin: 4px 4px 1px;
    font-size: 9.5px;
    color: var(--text-muted);
  }
  .p-more {
    margin-top: 12px;
    border-top: 1px solid var(--divider);
  }
  .p-morehead {
    list-style: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 2px 0;
    cursor: pointer;
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--text-secondary);
  }
  .p-morehead::-webkit-details-marker {
    display: none;
  }
  .p-morehead:hover {
    color: var(--text);
  }
  .m-chev {
    color: var(--text-muted);
    flex: none;
    transition: transform 0.15s ease;
  }
  .p-more[open] .m-chev {
    transform: rotate(180deg);
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 5px 8px;
    margin-top: 8px;
    font: 400 11.5px var(--font);
    color: var(--text-secondary);
  }
  .lg-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    border: 1px solid var(--divider);
    border-radius: 999px;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
    transition:
      opacity 0.12s,
      border-color 0.12s;
  }
  .lg-item:hover {
    border-color: var(--border-strong);
  }
  .lg-item.off {
    opacity: 0.4;
  }
  .lg-item.off .lg-swatch {
    filter: grayscale(1);
  }
  .lg-swatch {
    width: 20px;
    height: 14px;
    display: block;
    flex: none;
  }
  .seg.dimmed {
    opacity: 0.12;
    pointer-events: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .seg,
    .rest,
    .yellow,
    .seam-labels,
    .fmap,
    .mapc,
    .shortcuts,
    .zoom-buttons,
    .stage,
    .trace,
    .m-chev,
    .lg-item {
      transition: none !important;
    }
    .halo,
    .live-dot,
    .chev-badge,
    .map-skeleton {
      animation: none !important;
    }
  }
</style>
