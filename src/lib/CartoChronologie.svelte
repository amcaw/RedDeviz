<script lang="ts">
  import { geoNaturalEarth1, geoPath } from 'd3-geo';
  import { zoom, zoomIdentity } from 'd3-zoom';
  import { select } from 'd3-selection';
  import 'd3-transition'; // augments selection with .transition()
  import * as topojson from 'topojson-client';
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import {
    RESULT_VARS,
    atlasName,
    fr,
    canonicalCountry,
    type Match
  } from './data';

  let {
    allMatches,
    filtered,
    recordHighlight = [],
    filterActive = false,
    selected = $bindable(null),
    hovered = $bindable(null),
    cityInfo = $bindable(null),
    controls = $bindable(null)
  }: {
    allMatches: Match[];
    filtered: Match[];
    recordHighlight?: string[];
    filterActive?: boolean;
    selected: Match | null;
    hovered: Match | null;
    cityInfo: {
      city: string;
      country: string;
      cityMatches: Match[];
      countryMatches: Match[];
    } | null;
    // exposes the zoom actions to the parent (for the +/−/reset buttons)
    controls: { zoomIn: () => void; zoomOut: () => void; reset: () => void } | null;
  } = $props();

  // Clicking a city dot highlights every match played there; clicking a country
  // highlights every match played in that country. Tracked locally by the city's
  // location key / the country's atlas name; a memorable-series highlight (from
  // the buttons) takes precedence when active.
  let cityKey = $state<string | null>(null);
  let countryKey = $state<string | null>(null); // atlas country name

  // Active highlight = the memorable series if one is set, else the clicked
  // city, else the clicked country.
  const highlightSet = $derived.by(() => {
    if (recordHighlight.length) return new Set(recordHighlight);
    if (cityKey) {
      const g = cityMarkers.find((m) => m.key === cityKey);
      if (g) return new Set(g.ms.map((m) => m.id));
    }
    if (countryKey) {
      return new Set(
        filtered.filter((m) => atlasName(m.hostCountry) === countryKey).map((m) => m.id)
      );
    }
    return new Set<string>();
  });
  const hasHighlight = $derived(highlightSet.size > 0);

  // A memorable series from the buttons clears any city/country highlight.
  $effect(() => {
    if (recordHighlight.length) {
      cityKey = null;
      countryKey = null;
    }
  });

  // If the stats panel is closed from outside (its × button), drop the highlight.
  $effect(() => {
    if (!cityInfo) {
      cityKey = null;
      countryKey = null;
    }
  });

  // Click a city: toggle its highlight, publish its stats, and zoom to it.
  function clickCity(g: { key: string; ms: Match[]; coords: [number, number] }) {
    if (cityKey === g.key) {
      cityKey = null;
      cityInfo = null;
      resetZoom();
      return;
    }
    selected = null; // ferme le panneau match pour éviter deux popups superposés
    countryKey = null; // a city highlight supersedes a country highlight
    cityKey = g.key;
    // Use the canonical country so historical names (e.g. E.L. Ireland /
    // Republic of Ireland) are counted as the same place.
    const country = canonicalCountry(g.ms[0].hostCountry);
    cityInfo = {
      city: g.ms[0].city,
      country,
      cityMatches: g.ms,
      countryMatches: filtered.filter((m) => canonicalCountry(m.hostCountry) === country)
    };
    // Don't yank the camera if the user already framed the map themselves.
    if (!userZoomed) zoomTo(g.coords, 8);
  }

  // Click a country on the map: toggle a highlight of every match played there
  // (grouped by atlas name, so England/Scotland/Wales all belong to the UK
  // landmass), and publish its stats. Only countries with matches react.
  function clickCountry(atlasNm: string) {
    const ms = filtered.filter((m) => atlasName(m.hostCountry) === atlasNm);
    if (!ms.length) return;
    if (countryKey === atlasNm) {
      countryKey = null;
      cityInfo = null;
      resetZoom();
      return;
    }
    selected = null;
    cityKey = null;
    countryKey = atlasNm;
    // Country label: the most frequent canonical host country among the matches
    // (exact for normal countries; picks the dominant nation for the UK landmass).
    const tally = new Map<string, number>();
    for (const m of ms) {
      const c = canonicalCountry(m.hostCountry);
      tally.set(c, (tally.get(c) ?? 0) + 1);
    }
    const country = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
    cityInfo = {
      city: '', // no specific city — the panel shows the country block only
      country,
      cityMatches: [],
      countryMatches: ms
    };
  }

  // ---- geometry ----------------------------------------------------------
  // viewBox hugs the wheel's outer radius (~398) so the disc fills the square
  // without overflowing the header above it.
  const SIZE = 806;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const MAP_R = 200;          // central map radius
  const YEAR_BAND_W = 26;     // the ring where each year's slice is coloured + labelled
  const RING_GAP = YEAR_BAND_W + 4; // map edge → first dot
  const DOT_R = 4.2;          // dot radius
  const DOT_STEP = DOT_R * 2 + 1.6;
  const YEAR_LABEL_R = MAP_R + YEAR_BAND_W / 2; // centred within the year ring

  const YEARS = $derived.by(() => {
    const ys = allMatches.map((m) => m.year);
    const min = Math.min(...ys);
    const max = Math.max(...ys);
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  });
  const Y0 = $derived(YEARS[0]);
  const YN = $derived(YEARS[YEARS.length - 1]);

  // Leave a small gap at the top so the ring reads as a clock starting near 12 o'clock.
  const GAP_DEG = 6;
  const START = -90 + GAP_DEG / 2;        // degrees
  const SWEEP = 360 - GAP_DEG;
  const PER_YEAR = $derived(SWEEP / YEARS.length); // angular width of one year slice

  function yearAngle(year: number): number {
    // centre angle (deg) of a year's slice
    return START + (year - Y0 + 0.5) * PER_YEAR;
  }
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  // Group filtered matches by year, ordered by date, so each gets a radial slot.
  const dots = $derived.by(() => {
    const byYear = new Map<number, Match[]>();
    for (const m of filtered) {
      if (!byYear.has(m.year)) byYear.set(m.year, []);
      byYear.get(m.year)!.push(m);
    }
    const out: { m: Match; x: number; y: number; cx: number; cy: number; ang: number }[] = [];
    for (const [year, ms] of byYear) {
      ms.sort((a, b) => a.date.localeCompare(b.date));
      const ang = yearAngle(year);
      const a = toRad(ang);
      ms.forEach((m, i) => {
        const r = MAP_R + RING_GAP + DOT_R + i * DOT_STEP;
        out.push({
          m,
          x: CX + r * Math.cos(a),
          y: CY + r * Math.sin(a),
          cx: Math.cos(a),
          cy: Math.sin(a),
          ang
        });
      });
    }
    return out;
  });

  // ---- per-year coloured band (density of matches that year) -------------
  // A thin annular sector per year, just outside the map. Its fill is grey when
  // the year has no (filtered) match, else an elegant red scaled from light to
  // deep by the match count — echoing the reference visualisation.
  const BAND_INNER = MAP_R + 1;
  const BAND_OUTER = MAP_R + YEAR_BAND_W;

  const yearCounts = $derived.by(() => {
    const m = new Map<number, number>();
    for (const d of filtered) m.set(d.year, (m.get(d.year) ?? 0) + 1);
    return m;
  });
  const maxYearCount = $derived(Math.max(1, ...yearCounts.values()));

  // Resolve a CSS custom property to an [r,g,b] triple (via the browser's own
  // colour parser), so the year-ring ramp follows the active light/dark theme.
  function cssRgb(varName: string, fallback: [number, number, number]): [number, number, number] {
    if (typeof window === 'undefined') return fallback;
    const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    if (!raw) return fallback;
    const probe = document.createElement('canvas').getContext('2d');
    if (!probe) return fallback;
    probe.fillStyle = '#000';
    probe.fillStyle = raw; // browser normalises any valid colour
    const m = probe.fillStyle.match(/^#([0-9a-f]{6})$/i);
    if (m) {
      const n = parseInt(m[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    const rgb = probe.fillStyle.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
    return rgb ? [+rgb[1], +rgb[2], +rgb[3]] : fallback;
  }

  // Theme colours for the year-density ring, resolved once on mount (and on team
  // remount). empty → low → high follows the current light/dark theme.
  let yearRamp = $state({
    empty: 'rgb(236 239 243)',
    low: [247, 212, 209] as [number, number, number],
    high: [192, 36, 27] as [number, number, number]
  });
  function refreshYearRamp() {
    const e = cssRgb('--year-empty', [236, 239, 243]);
    yearRamp = {
      empty: `rgb(${e[0]} ${e[1]} ${e[2]})`,
      low: cssRgb('--year-low', [247, 212, 209]),
      high: cssRgb('--year-high', [192, 36, 27])
    };
  }

  // light → deep ramp; empty colour for years with no match
  function yearFill(count: number): string {
    if (!count) return yearRamp.empty;
    const t = Math.sqrt(count / maxYearCount); // sqrt so low counts still read
    const lerp = (a: number, b: number) => Math.round(a + (b - a) * t);
    const r = lerp(yearRamp.low[0], yearRamp.high[0]);
    const g = lerp(yearRamp.low[1], yearRamp.high[1]);
    const b = lerp(yearRamp.low[2], yearRamp.high[2]);
    return `rgb(${r} ${g} ${b})`;
  }

  // Annular sector path for one year slice.
  function yearArc(year: number): string {
    const a0 = toRad(START + (year - Y0) * PER_YEAR);
    const a1 = toRad(START + (year - Y0 + 1) * PER_YEAR);
    const x0i = CX + BAND_INNER * Math.cos(a0);
    const y0i = CY + BAND_INNER * Math.sin(a0);
    const x0o = CX + BAND_OUTER * Math.cos(a0);
    const y0o = CY + BAND_OUTER * Math.sin(a0);
    const x1o = CX + BAND_OUTER * Math.cos(a1);
    const y1o = CY + BAND_OUTER * Math.sin(a1);
    const x1i = CX + BAND_INNER * Math.cos(a1);
    const y1i = CY + BAND_INNER * Math.sin(a1);
    return (
      `M${x0i.toFixed(2)},${y0i.toFixed(2)}` +
      `L${x0o.toFixed(2)},${y0o.toFixed(2)}` +
      `A${BAND_OUTER},${BAND_OUTER} 0 0 1 ${x1o.toFixed(2)},${y1o.toFixed(2)}` +
      `L${x1i.toFixed(2)},${y1i.toFixed(2)}` +
      `A${BAND_INNER},${BAND_INNER} 0 0 0 ${x0i.toFixed(2)},${y0i.toFixed(2)}Z`
    );
  }
  // The chronological index of the first dot of each year, so a year's coloured
  // slice can be revealed in step with the intro animation (same clock as dots).
  const yearFirstDot = $derived.by(() => {
    const m = new Map<number, number>();
    dots.forEach((d, i) => {
      if (!m.has(d.m.year)) m.set(d.m.year, i);
    });
    return m;
  });
  const yearBands = $derived(
    YEARS.map((y, i) => ({
      y,
      d: yearArc(y),
      fill: yearFill(yearCounts.get(y) ?? 0),
      // when a series is highlighted, grey out the years it doesn't touch
      faded: yearFocus && !highlightYears.has(y),
      // reveal in step with the dots; empty years (no dot) fall back to their
      // chronological position mapped onto the dot count so they appear in order
      threshold:
        yearFirstDot.get(y) ?? Math.round((i / (YEARS.length - 1 || 1)) * dots.length)
    }))
  );

  // ---- intro reveal animation --------------------------------------------
  // Dots appear in chronological order, driven by a single smooth ease-in-out
  // curve. We reveal `N × smootherstep(t)` over time: smootherstep
  // (6t⁵−15t⁴+10t³) has zero slope at both ends, so the cadence accelerates
  // from a standstill, peaks in the middle, then eases back to a standstill —
  // a continuous accelerate/decelerate with no abrupt start or stop.
  let revealCount = $state(0);
  let introDone = $state(false);
  onMount(() => {
    const N = dots.length;
    if (!N) {
      introDone = true;
      return;
    }
    const TARGET = 4200; // ms of reveal
    const HOLD = 350; // initial suspense beat
    const smootherstep = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);
    let start = 0;
    let raf = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const x = Math.min(1, Math.max(0, (now - start - HOLD) / TARGET));
      revealCount = Math.round(smootherstep(x) * N);
      if (x < 1) raf = requestAnimationFrame(tick);
      else {
        revealCount = N;
        introDone = true;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });

  // A focus is active when a series/city is highlighted OR a single match is
  // hovered/selected — in all cases the off-years are greyed out.
  const yearFocus = $derived(hasHighlight || !!activeMatch);
  // Years to keep lit: those of the highlighted set, plus the active match's year.
  const highlightYears = $derived.by(() => {
    const ys = new Set<number>();
    if (hasHighlight) for (const m of filtered) if (highlightSet.has(m.id)) ys.add(m.year);
    if (activeMatch) ys.add(activeMatch.year);
    return ys;
  });

  // Which years get a written label: decades + endpoints + any focused year, and
  // — when a filter is active — every year that still has a (filtered) match,
  // so the chronology reads precisely on the reduced set.
  function isLabelled(y: number): boolean {
    if (y % 10 === 0 || y === Y0 || y === YN || highlightYears.has(y)) return true;
    if (filterActive && (yearCounts.get(y) ?? 0) > 0) return true;
    return false;
  }
  const yearTicks = $derived(
    YEARS.filter(isLabelled).map((y) => {
      const ang = yearAngle(y);
      const a = toRad(ang);
      const lower = ang > 90 && ang < 270; // bottom half → flip 180° to stay upright
      const i = y - Y0;
      return {
        y,
        highlighted: highlightYears.has(y),
        x: CX + YEAR_LABEL_R * Math.cos(a),
        y2: CY + YEAR_LABEL_R * Math.sin(a),
        rot: ang + (lower ? 180 : 0), // tangential, kept upright
        // same reveal threshold as the year's slice, so label & slice appear together
        threshold:
          yearFirstDot.get(y) ?? Math.round((i / (YEARS.length - 1 || 1)) * dots.length)
      };
    })
  );

  // ---- map ----------------------------------------------------------------
  let countries: any[] = $state([]);
  let pathFn: any = $state(null);

  // Fit the whole world inside the square that inscribes the disc. The disc has
  // radius MAP_R; a square of side MAP_R*2 bounds it, but the world is wider than
  // tall, so fitting to that square leaves the poles inside the circle while the
  // full longitude range spans the diameter.
  const projection = geoNaturalEarth1();
  projection.fitExtent(
    [
      [CX - MAP_R, CY - MAP_R],
      [CX + MAP_R, CY + MAP_R]
    ],
    { type: 'Sphere' }
  );

  // Host countries (atlas names) present in the current filter -> highlight fill.
  const hostSet = $derived(new Set(filtered.map((m) => atlasName(m.hostCountry))));

  const activeMatch = $derived(hovered ?? selected);

  // ---- city markers: one dot per match city, sized by match count --------
  const cityMarkers = $derived.by(() => {
    const groups = new Map<string, { key: string; coords: [number, number]; ms: Match[] }>();
    for (const m of filtered) {
      if (!m.coords) continue;
      const key = `${m.coords[0]},${m.coords[1]}`; // group by exact location
      if (!groups.has(key)) groups.set(key, { key, coords: m.coords, ms: [] });
      groups.get(key)!.ms.push(m);
    }
    return [...groups.values()]
      .map((g) => {
        const p = projection(g.coords) as [number, number] | null;
        return p ? { ...g, x: p[0], y: p[1], count: g.ms.length } : null;
      })
      .filter((g): g is NonNullable<typeof g> => !!g)
      .sort((a, b) => b.count - a.count); // big ones first so small sit on top
  });
  // Marker radius scales with the square root of the match count (area ∝ count).
  const maxCount = $derived(Math.max(1, ...cityMarkers.map((g) => g.count)));
  function markerR(count: number): number {
    const min = 1.6, max = 9;
    return min + (max - min) * Math.sqrt(count / maxCount);
  }
  const cityLabel = (g: { ms: Match[] }) => g.ms[0].city || g.ms[0].hostCountry;

  // ---- interactive zoom & pan (d3-zoom) ----------------------------------
  // The map is freely zoomable with the wheel and pannable by dragging, exactly
  // like the reference viz. d3-zoom owns the transform; we mirror its state into
  // `mapTransform` (applied to the map group) and `zoomK` (to counter-scale
  // marker sizes). Clicking a location can also zoom there programmatically.
  let mapTransform = $state('translate(0 0) scale(1)');
  let zoomK = $state(1);
  // Counter-scale markers so they don't grow with zoom, but cap it so they stay
  // visible at very high zoom instead of shrinking to nothing.
  const markerScale = $derived(Math.min(zoomK, 16));

  let svgEl: SVGSVGElement;
  let zoomBehavior: any;
  let userZoomed = false; // true once the user pans/zooms the map by hand

  // Hint shown when the user scrolls over the map without the zoom modifier.
  let hintVisible = $state(false);
  let hintTimer: ReturnType<typeof setTimeout> | undefined;
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  // Touch device -> pinch; otherwise wheel + the Ctrl/⌘ modifier.
  const isTouch =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(pointer: coarse)').matches;
  const ZOOM_HINT = isTouch
    ? 'Pincez à deux doigts pour zoomer'
    : `${isMac ? '⌘' : 'Ctrl'} + molette pour zoomer`;
  function flashHint() {
    hintVisible = true;
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => (hintVisible = false), 1400);
  }
  // d3-zoom works in screen px; our viewBox is SIZE×SIZE, so convert the wheel
  // delta against the rendered size. translateExtent keeps the disc from being
  // dragged completely away.
  const zoomBehaviorFactory = () =>
    zoom()
      .scaleExtent([1, 400])
      .translateExtent([
        [CX - MAP_R, CY - MAP_R],
        [CX + MAP_R, CY + MAP_R]
      ])
      .extent([
        [CX - MAP_R, CY - MAP_R],
        [CX + MAP_R, CY + MAP_R]
      ])
      .filter((event: any) => {
        // Wheel zoom only with Ctrl/Cmd held (a trackpad/mobile pinch also sets
        // ctrlKey on the wheel event, so two-finger pinch works too). A plain
        // scroll is left to the page, and we flag it to show the hint overlay.
        if (event.type === 'wheel') {
          const ok = event.ctrlKey || event.metaKey;
          if (!ok) flashHint();
          return ok;
        }
        if (event.type === 'touchstart') return event.touches?.length === 2; // 2-finger pan/zoom
        const el = event.target as Element;
        if (el?.closest?.('.city-marker, .dot, .zc')) return false;
        return !event.ctrlKey && !event.button;
      })
      .on('zoom', (event: any) => {
        const t = event.transform;
        mapTransform = `translate(${t.x} ${t.y}) scale(${t.k})`;
        zoomK = t.k;
        // event.sourceEvent is set for user gestures (wheel/drag), null for our
        // programmatic .transform() calls. Remember when the user took control
        // so a subsequent dot/city click won't yank the camera away.
        if (event.sourceEvent) userZoomed = true;
      });

  onMount(async () => {
    // resolve the theme-aware year-ring colours, and keep them in sync if the OS
    // light/dark preference changes while the page is open.
    refreshYearRamp();
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onTheme = () => refreshYearRamp();
    mq.addEventListener?.('change', onTheme);

    const res = await fetch(`${base}/countries-50m.json`);
    const topo = await res.json();
    const feat: any = topojson.feature(topo, topo.objects.countries);
    pathFn = geoPath(projection);
    countries = feat.features;

    zoomBehavior = zoomBehaviorFactory();
    select(svgEl).call(zoomBehavior);

    return () => mq.removeEventListener?.('change', onTheme);
  });

  // Smoothly zoom the map so a coordinate is centred at the given scale.
  function zoomTo(coords: [number, number] | null, k = 12) {
    if (!coords || !zoomBehavior || !svgEl) return;
    const p = projection(coords) as [number, number] | null;
    if (!p) return;
    const t = zoomIdentity.translate(CX - k * p[0], CY - k * p[1]).scale(k);
    select(svgEl).transition().duration(900).call(zoomBehavior.transform, t);
  }
  function resetZoom() {
    userZoomed = false; // back to auto-framing on the next click
    if (!zoomBehavior || !svgEl) return;
    select(svgEl).transition().duration(700).call(zoomBehavior.transform, zoomIdentity);
  }
  // Zoom in/out by a factor around the disc centre (for the + / − buttons).
  function zoomBy(factor: number) {
    if (!zoomBehavior || !svgEl) return;
    userZoomed = true; // the user is framing the map manually
    select(svgEl)
      .transition()
      .duration(300)
      .call(zoomBehavior.scaleBy, factor, [CX, CY]);
  }

  // Expose the zoom actions to the parent so the +/−/reset buttons can drive them.
  controls = {
    zoomIn: () => zoomBy(1.6),
    zoomOut: () => zoomBy(1 / 1.6),
    reset: resetZoom
  };

  // Keyboard navigation (←/→) changes `selected` without a click; zoom to it.
  let lastZoomedId: string | null = null;
  $effect(() => {
    if (selected && selected.id !== lastZoomedId) {
      lastZoomedId = selected.id;
      if (!userZoomed) zoomTo(selected.coords, 8); // keep the user's framing if they set one
    } else if (!selected) {
      lastZoomedId = null;
    }
  });
</script>

<svg
  bind:this={svgEl}
  viewBox="0 0 {SIZE} {SIZE}"
  class="carto"
  role="img"
  aria-label="Cartochronologie des matchs"
>
  <defs>
    <clipPath id="disc"><circle cx={CX} cy={CY} r={MAP_R} /></clipPath>
    <!-- spherical shading: bright top-left, shadow bottom-right -> 3D ball look -->
    <radialGradient id="sphere" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="var(--globe-hi)" />
      <stop offset="100%" stop-color="var(--globe-lo)" />
    </radialGradient>
    <radialGradient id="rim" cx="50%" cy="50%" r="50%">
      <stop offset="88%" stop-color="rgba(0,0,0,0)" />
      <stop offset="100%" stop-color="var(--globe-rim)" />
    </radialGradient>
  </defs>

  <!-- the disc -->
  <g class="ball-group" clip-path="url(#disc)">
    <!-- map background; a plain click here clears selection (without resetting zoom) -->
    <circle
      cx={CX}
      cy={CY}
      r={MAP_R}
      fill="url(#sphere)"
      onclick={() => {
        selected = null;
        cityKey = null;
        countryKey = null;
        cityInfo = null;
      }}
    />

    <!-- map + city markers zoom together toward the selected match location -->
    <g class="zoomable" transform={mapTransform}>
      <g class="map">
        {#each countries as c (c.properties.name)}
          {@const isHost = hostSet.has(c.properties.name)}
          <path
            d={pathFn(c)}
            class="country"
            class:host={isHost}
            class:clickable={isHost}
            class:selected={countryKey === c.properties.name}
            role={isHost ? 'button' : undefined}
            tabindex={isHost ? 0 : undefined}
            aria-label={isHost ? `${c.properties.name} — surligner les matchs` : undefined}
            onclick={isHost
              ? (e) => {
                  e.stopPropagation();
                  clickCountry(c.properties.name);
                }
              : undefined}
            onkeydown={isHost
              ? (e) => e.key === 'Enter' && clickCountry(c.properties.name)
              : undefined}
          />
        {/each}
      </g>

      <!-- city markers: one dot per location, area proportional to match count.
           Clicking one highlights every match played in that city. -->
      {#each cityMarkers as g (g.key)}
        <circle
          cx={g.x}
          cy={g.y}
          r={markerR(g.count) / markerScale}
          stroke-width={0.5 / markerScale}
          class="city-marker"
          class:active={(activeMatch && g.ms.some((m) => m.id === activeMatch.id)) ||
            (hasHighlight && g.ms.some((m) => highlightSet.has(m.id)))}
          class:faded={hasHighlight && !g.ms.some((m) => highlightSet.has(m.id))}
          role="button"
          tabindex="0"
          aria-label="{cityLabel(g)} — {g.count} matchs"
          onmouseenter={() => (hovered = g.ms[g.ms.length - 1])}
          onmouseleave={() => (hovered = null)}
          onclick={(e) => {
            e.stopPropagation();
            clickCity(g);
          }}
          onkeydown={(e) => e.key === 'Enter' && clickCity(g)}
        >
          <title>{cityLabel(g)} — {g.count} match{g.count > 1 ? 's' : ''}</title>
        </circle>
      {/each}
    </g>

    <!-- very light rim shadow for a touch of depth -->
    <circle cx={CX} cy={CY} r={MAP_R} fill="url(#rim)" pointer-events="none" />
  </g>

  <!-- crisp disc outline -->
  <circle cx={CX} cy={CY} r={MAP_R} class="ball-outline" pointer-events="none" />

  <!-- per-year density band: red scaled by match count, grey when empty.
       Each slice fades/scales in with the same intro clock as its dots. -->
  <g class="year-bands" pointer-events="none">
    {#each yearBands as b (b.y)}
      <path
        d={b.d}
        fill={b.fill}
        class="band"
        class:faded={b.faded}
        class:hidden={b.threshold >= revealCount}
      />
    {/each}
  </g>

  <!-- every year written radially inside its coloured slice -->
  {#each yearTicks as t (t.y)}
    <text
      x={t.x}
      y={t.y2}
      class="year-label"
      class:hl={t.highlighted}
      class:faded={yearFocus && !t.highlighted}
      class:hidden={t.threshold >= revealCount}
      text-anchor="middle"
      transform="rotate({t.rot} {t.x} {t.y2})"
      dominant-baseline="central">{t.y}</text
    >
  {/each}

  <!-- match dots -->
  {#each dots as d, i (d.m.id)}
    <circle
      cx={d.x}
      cy={d.y}
      r={DOT_R}
      fill={RESULT_VARS[d.m.result]}
      class="dot"
      class:hidden={i >= revealCount}
      class:fresh={!introDone && i >= revealCount - 10 && i < revealCount}
      class:active={activeMatch?.id === d.m.id}
      class:dim={activeMatch && activeMatch.id !== d.m.id}
      class:series={hasHighlight && highlightSet.has(d.m.id)}
      class:faded={hasHighlight && !highlightSet.has(d.m.id)}
      style:transform-origin="{d.x}px {d.y}px"
      role="button"
      tabindex="0"
      aria-label="{d.m.date} {fr(d.m.home)} {d.m.score} {fr(d.m.away)}"
      onmouseenter={() => (hovered = d.m)}
      onmouseleave={() => (hovered = null)}
      onclick={(e) => {
        e.stopPropagation();
        selected = d.m;
        cityInfo = null;
        cityKey = null;
        countryKey = null;
        // zoom handled by the $effect on `selected` (respects userZoomed)
      }}
      onkeydown={(e) => e.key === 'Enter' && (selected = d.m)}
    />
  {/each}

  <!-- interaction legend, top-right of the viz (adapts to the device) -->
  <g class="shortcuts" transform="translate({SIZE - 8} 6)">
    {#if isTouch}
      <text x="0" y="0" text-anchor="end" dominant-baseline="hanging">
        Pincez à deux doigts pour zoomer sur la carte
      </text>
    {:else}
      <text x="0" y="0" text-anchor="end" dominant-baseline="hanging">
        <tspan class="key">Esc</tspan> pour réinitialiser
      </text>
      <text x="0" y="16" text-anchor="end" dominant-baseline="hanging">
        <tspan class="key">{isMac ? '⌘' : 'Ctrl'}</tspan> + molette pour zoomer sur la carte
      </text>
    {/if}
  </g>

  <!-- zoom hint, flashed when scrolling without the modifier -->
  {#if hintVisible}
    <g class="zoom-hint">
      <rect x={CX - 150} y={CY - 16} rx="14" width="300" height="32" />
      <text x={CX} y={CY} text-anchor="middle" dominant-baseline="central">{ZOOM_HINT}</text>
    </g>
  {/if}
</svg>

<style>
  .carto {
    width: 100%;
    height: auto;
    display: block;
    overflow: visible;
    touch-action: pan-y; /* allow page scroll; d3-zoom handles 2-finger pinch */
  }
  /* keyboard-shortcut legend, top-right */
  .shortcuts text {
    font-size: 11px;
    fill: var(--text-muted);
    font-family: var(--font, system-ui, sans-serif);
    user-select: none;
  }
  .shortcuts .key {
    fill: var(--text-secondary);
    font-weight: 700;
  }
  /* zoom hint flashed on plain scroll */
  .zoom-hint {
    pointer-events: none;
  }
  .zoom-hint rect {
    fill: var(--text);
    opacity: 0.88;
  }
  .zoom-hint text {
    fill: var(--bg);
    font-size: 13px;
    font-weight: 600;
    font-family: var(--font, system-ui, sans-serif);
  }
  /* map + markers zoom together; the transform is driven by d3-zoom */
  .country {
    fill: var(--map-land);
    stroke: var(--surface);
    stroke-width: 0.35;
    vector-effect: non-scaling-stroke;
  }
  .country.host {
    fill: var(--map-host); /* muted steel blue — elegant counterpoint to the warm dots */
    transition: fill 0.12s, filter 0.12s;
  }
  /* host countries are clickable: hover brightens, click marks them selected */
  .country.clickable {
    cursor: pointer;
  }
  .country.host.clickable:hover {
    filter: brightness(1.15);
  }
  .country.selected {
    fill: var(--accent);
    stroke: var(--accent);
    stroke-width: 0.8;
  }
  .ball-outline {
    fill: none;
    stroke: var(--border);
    stroke-width: 1;
  }
  /* one dot per city, sized by number of matches played there */
  .city-marker {
    fill: var(--city-marker);
    fill-opacity: 0.62;
    stroke: var(--city-marker-stroke);
    cursor: pointer;
    transition: fill 0.15s, fill-opacity 0.15s;
  }
  .city-marker:hover {
    fill-opacity: 0.95;
  }
  .city-marker.active {
    fill: var(--accent);
    fill-opacity: 1;
  }
  .city-marker.faded {
    fill-opacity: 0.12;
  }
  .year-label {
    font-size: 9px;
    font-weight: 600;
    fill: var(--text-secondary);
    font-family: var(--font, system-ui, sans-serif);
    user-select: none;
    paint-order: stroke;
    stroke: var(--globe-lo);
    stroke-width: 2px;
  }
  .year-label.hl {
    fill: var(--text);
    font-weight: 800;
    stroke: var(--globe-lo);
  }
  .year-label {
    opacity: 1;
    transition: opacity 0.6s ease-out, fill 0.2s ease-out;
  }
  .year-label.hidden {
    opacity: 0;
  }
  .year-label.faded {
    opacity: 0.3; /* dimmed (not recoloured) when off-focus, like the dots */
  }
  .year-bands path {
    stroke: var(--bg);
    stroke-width: 0.4;
  }
  /* year slices fade in with the same intro clock as the dots */
  .band {
    opacity: 1;
    transition: opacity 0.3s ease-out;
  }
  .band.hidden {
    opacity: 0;
  }
  /* off-focus years keep their colour, just dimmed (like the dots) */
  .band.faded {
    opacity: 0.25;
  }
  @media (prefers-reduced-motion: reduce) {
    .band,
    .band.hidden {
      transition: none;
      opacity: 1;
    }
  }
  .dot {
    cursor: pointer;
    stroke: var(--bg);
    stroke-width: 0.6;
    opacity: 1;
    /* revealed state: settled in place with a soft scale-in. */
    transform: scale(1);
    transition:
      opacity 0.6s ease-out,
      transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  }
  /* intro: not yet reached by the reveal clock — invisible & collapsed in place,
     then it eases up to full size where it belongs (no travel from the centre). */
  .dot.hidden {
    opacity: 0;
    transform: scale(0);
    pointer-events: none;
  }
  /* the dot that just arrived: a brief glowing halo for the suspense reveal */
  .dot.fresh {
    animation: dot-pop 0.7s ease-out;
  }
  @keyframes dot-pop {
    0% {
      filter: drop-shadow(0 0 0 rgba(230, 51, 41, 0));
    }
    35% {
      filter: drop-shadow(0 0 5px rgba(230, 51, 41, 0.9));
    }
    100% {
      filter: drop-shadow(0 0 0 rgba(230, 51, 41, 0));
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .dot,
    .dot.hidden {
      transition: none;
      transform: none;
    }
    .dot.fresh {
      animation: none;
    }
  }
  .dot:hover,
  .dot.active {
    stroke: var(--text);
    stroke-width: 1.6;
    filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.55));
  }
  .dot.dim {
    opacity: 0.28;
  }
  /* a highlighted memorable series: emphasise its dots, fade the rest */
  .dot.faded {
    opacity: 0.12;
  }
  .dot.series {
    opacity: 1;
    stroke: var(--text);
    stroke-width: 1.4;
    filter: drop-shadow(0 0 2.5px rgba(0, 0, 0, 0.5));
  }
</style>
