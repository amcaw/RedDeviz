<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import {
    ROUND_ORDER,
    FR_NAME,
    championOf,
    championTitle,
    type Bracket,
    type RoundKey,
    type WcMatch,
    type Side,
    type WcVideoRef
  } from './wc/bracket';

  let {
    bracket,
    videos = {},
    onvideo
  }: {
    bracket: Bracket;
    videos?: Record<string, WcVideoRef>;
    onvideo?: (v: WcVideoRef) => void;
  } = $props();

  const SIZE = 1000;
  const C = SIZE / 2;
  const PAD = 34;
  const TAU = Math.PI * 2;

  const prevOf: Record<Exclude<RoundKey, 'R32'>, RoundKey> = {
    R16: 'R32',
    QF: 'R16',
    SF: 'QF',
    F: 'SF'
  };

  const LVL: Record<RoundKey, number> = { R32: 408, R16: 336, QF: 264, SF: 192, F: 120 };
  const TEAM_R = 480;
  const TEAM_OFF = (TAU / 16) * 0.22;

  const pt = (r: number, a: number) => [C + r * Math.cos(a), C + r * Math.sin(a)] as const;
  const radial = (a: number, r1: number, r2: number) => {
    const [x1, y1] = pt(r1, a);
    const [x2, y2] = pt(r2, a);
    return `M${x1} ${y1}L${x2} ${y2}`;
  };
  const arc = (r: number, a1: number, a2: number) => {
    let d = a2 - a1;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    const [x1, y1] = pt(r, a1);
    const [x2, y2] = pt(r, a1 + d);
    return `M${x1} ${y1}A${r} ${r} 0 0 ${d > 0 ? 1 : 0} ${x2} ${y2}`;
  };

  function winnerSide(m: WcMatch): Side | null {
    if (m.state !== 'post') return null;
    if (m.home?.winner) return m.home;
    if (m.away?.winner) return m.away;
    return null;
  }

  interface Kid { a: number; side: Side | null; advanced: boolean; }
  function participants(round: RoundKey, m: WcMatch): Kid[] {
    const win = winnerSide(m);
    if (round === 'R32') {
      return (['home', 'away'] as const).map((which) => ({
        a: m.angle + (which === 'home' ? -TEAM_OFF : TEAM_OFF),
        side: m[which],
        advanced: !!win && m[which]?.name === win.name
      }));
    }
    const prev = bracket.rounds[prevOf[round as Exclude<RoundKey, 'R32'>]];
    return (m.feeds ?? [0, 0]).map((fn) => {
      const f = prev.find((x) => x.num === fn);
      const fw = f ? winnerSide(f) : null;
      return { a: f?.angle ?? m.angle, side: fw, advanced: !!win && !!fw && fw.name === win.name };
    });
  }

  let reveal = $state(0);
  const smootherstep = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);
  onMount(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      reveal = 1;
      return;
    }
    const DURATION = 4200;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const x = Math.min(1, (now - start) / DURATION);
      reveal = smootherstep(x);
      if (x < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });
  const sweep = (a: number) => ((((a + Math.PI / 2) % TAU) + TAU) % TAU) / TAU;
  const GREY_BASE: Record<RoundKey, number> = { R32: 0.28, R16: 0.35, QF: 0.42, SF: 0.48, F: 0.53 };
  const COL_BASE: Record<RoundKey, number> = { R32: 0.58, R16: 0.7, QF: 0.79, SF: 0.87, F: 0.93 };
  const prog = (delay: number, dur: number) =>
    Math.max(0, Math.min(1, (reveal - delay) / dur));

  let isLight = $state(false);
  $effect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    isLight = mq.matches;
    const on = () => (isLight = mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  });
  const hexRgb = (h: string) => {
    const s = h.replace('#', '');
    return /^[0-9a-f]{6}$/i.test(s)
      ? [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]
      : null;
  };
  const lum = ([r, g, b]: number[]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const toHex = ([r, g, b]: number[]) =>
    '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const mix = (c: number[], t: number[], k: number) => c.map((v, i) => v + (t[i] - v) * k);
  const dist = (a: number[], b: number[]) =>
    Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  function rotateHue(c: number[], deg: number): number[] {
    const [r, g, b] = c.map((v) => v / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    let h = 0;
    const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    if (d !== 0) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    h = (((h + deg) % 360) + 360) % 360;
    const C = (1 - Math.abs(2 * l - 1)) * sat;
    const X = C * (1 - Math.abs(((h / 60) % 2) - 1));
    const m0 = l - C / 2;
    const [r1, g1, b1] =
      h < 60 ? [C, X, 0] : h < 120 ? [X, C, 0] : h < 180 ? [0, C, X]
      : h < 240 ? [0, X, C] : h < 300 ? [X, 0, C] : [C, 0, X];
    return [(r1 + m0) * 255, (g1 + m0) * 255, (b1 + m0) * 255].map(Math.round);
  }

  const FLAG_CANDS: Record<string, string> = {
    Morocco: '006233',
    Canada: 'ed2224',
    Belgium: 'e63329',
    Switzerland: 'd52b1e',
    Norway: '00205b',
    Denmark: 'c8102e',
    Tunisia: 'e70013',
    England: '1a4c9c',
    Austria: 'ed2939',
    Portugal: '046a38',
    'Ivory Coast': 'ff8200',
    Senegal: '00853f',
    Algeria: '006233',
    Egypt: 'c09300'
  };

  const FLAG_FORCE: Record<string, string> = {
    Spain: 'ffc400'
  };

  const colorAssign = $derived.by(() => {
    const ok = (c: number[]) => (isLight ? lum(c) <= 0.62 : lum(c) >= 0.22);
    const target = isLight ? [0, 0, 0] : [255, 255, 255];
    const fix = (c: number[]) => {
      let v = c;
      for (let i = 0; i < 8 && !ok(v); i++) v = mix(v, target, 0.2);
      return v;
    };
    const map = new Map<string, number[]>();
    const cands = new Map<string, number[][]>();
    const ensure = (side: Side | null) => {
      if (!side || map.has(side.name)) return;
      const forced = FLAG_FORCE[side.name] ? hexRgb(FLAG_FORCE[side.name]) : null;
      if (forced) {
        const f = fix(forced);
        map.set(side.name, f);
        cands.set(side.name, [f]);
        return;
      }
      const cs = [side.color, FLAG_CANDS[side.name], side.altColor]
        .map((h) => (h ? hexRgb(h) : null))
        .filter(Boolean) as number[][];
      const ordered = [...cs.filter(ok), ...cs.filter((c) => !ok(c))];
      const fixed = ordered.length ? ordered.map(fix) : [fix(hexRgb('e63329')!)];
      map.set(side.name, fixed[0]);
      cands.set(side.name, fixed);
    };
    for (const round of ROUND_ORDER) {
      for (const m of bracket.rounds[round]) {
        for (const kid of participants(round, m)) ensure(kid.side);
      }
    }
    const THRESH = 85;
    for (const round of ROUND_ORDER) {
      for (const m of bracket.rounds[round]) {
        const [a, b] = participants(round, m);
        if (!a?.side || !b?.side) continue;
        const ca = map.get(a.side.name)!;
        let cb = map.get(b.side.name)!;
        if (dist(ca, cb) >= THRESH) continue;
        const alt = (cands.get(b.side.name) ?? []).find((c) => dist(ca, c) >= THRESH);
        if (alt) {
          map.set(b.side.name, alt);
          continue;
        }
        for (const deg of [60, -60, 120, 180]) {
          const rot = fix(rotateHue(cb, deg));
          if (dist(ca, rot) >= THRESH) {
            cb = rot;
            break;
          }
        }
        map.set(b.side.name, cb);
      }
    }
    const out = new Map<string, string>();
    for (const [k, v] of map) out.set(k, toHex(v));
    return out;
  });

  function teamColor(side: Side | null): string {
    if (!side) return 'var(--accent)';
    return colorAssign.get(side.name) ?? 'var(--accent)';
  }

  const champ = $derived(championOf(bracket));
  const GOLD = '#d4a017';

  interface Seg { d: string; color: string | null; delay: number; dur: number; champ?: boolean; runner?: boolean; }
  interface Flag { x: number; y: number; side: Side; advanced: boolean; big: boolean; delay: number; champ?: boolean; }
  interface Dot { x: number; y: number; delay: number; }
  interface Score { x: number; y: number; text: string; pens: string | null; video: WcVideoRef | null; delay: number; }
  interface MatchDate { x: number; y: number; text: string; time?: string; delay: number; }

  const sideInMatch = (m: WcMatch, name: string): Side | null =>
    m.home?.name === name ? m.home : m.away?.name === name ? m.away : null;

  const ddmm = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const hhmm = (iso?: string) => {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
  };

  const geometry = $derived.by(() => {
    void isLight;
    const segs: Seg[] = [];
    const flags: Flag[] = [];
    const dots: Dot[] = [];
    const scores: Score[] = [];
    const dates: MatchDate[] = [];

    for (const round of ROUND_ORDER) {
      const lvl = LVL[round];
      const inFrom = round === 'R32' ? TEAM_R : LVL[prevOf[round as Exclude<RoundKey, 'R32'>]];
      const greyBase = GREY_BASE[round];
      const prevRound = round === 'R32' ? null : prevOf[round as Exclude<RoundKey, 'R32'>];
      for (const m of bracket.rounds[round]) {
        const kids = participants(round, m);
        for (const kid of kids) {
          const col = kid.side ? teamColor(kid.side) : null;
          const jitter = sweep(kid.a) * 0.02;
          const isChamp = !!champ && kid.advanced && kid.side?.name === champ.champion.name;
          const isRunner =
            !!champ && kid.advanced && !!champ.runnerUp && kid.side?.name === champ.runnerUp.name;
          const inColor = round === 'R32' ? (kid.advanced ? col : null) : kid.side ? col : null;
          const inDelay = inColor
            ? (round === 'R32' ? COL_BASE.R32 : COL_BASE[prevRound!] + 0.05) + jitter
            : greyBase + jitter;
          segs.push({
            d: radial(kid.a, inFrom, lvl),
            color: isChamp ? GOLD : inColor,
            delay: inDelay,
            dur: 0.05,
            champ: isChamp,
            runner: isRunner
          });
          if (round !== 'F') {
            const arcColor = kid.advanced ? col : null;
            segs.push({
              d: arc(lvl, kid.a, m.angle),
              color: isChamp ? GOLD : arcColor,
              delay: arcColor ? COL_BASE[round] + 0.04 + jitter : greyBase + 0.04 + jitter,
              dur: 0.05,
              champ: isChamp,
              runner: isRunner
            });
          }
          if (round !== 'R32') {
            const [x, y] = pt(lvl, kid.a);
            if (kid.side)
              flags.push({
                x,
                y,
                side: kid.side,
                advanced: kid.advanced,
                big: false,
                delay: COL_BASE[prevRound!] + 0.11 + jitter,
                champ: isChamp
              });
            else dots.push({ x, y, delay: greyBase + 0.1 + jitter });
          }
        }
        if (kids[0]?.side && kids[1]?.side && (m.state === 'post' || m.state === 'in')) {
          const [k0, k1] = kids;
          const spanX = Math.abs(Math.cos(k0.a) - Math.cos(k1.a));
          const spanY = Math.abs(Math.sin(k0.a) - Math.sin(k1.a));
          const horizontal = spanX >= spanY * 0.7;
          const key = (k: Kid) => (horizontal ? Math.cos(k.a) : Math.sin(k.a));
          const ordered = key(k0) <= key(k1) ? [k0, k1] : [k1, k0];
          const s0 = sideInMatch(m, ordered[0].side!.name);
          const s1 = sideInMatch(m, ordered[1].side!.name);
          if (s0?.score != null && s1?.score != null) {
            const pens =
              s0.shootout != null && s1.shootout != null
                ? `${s0.shootout}–${s1.shootout} t.a.b.`
                : null;
            const key = [kids[0].side.name, kids[1].side.name].sort().join('|');
            const [mx, my] = pt(lvl, m.angle);
            scores.push({
              x: mx,
              y: my,
              text: `${s0.score}-${s1.score}`,
              pens,
              video: videos[key] ?? null,
              delay: COL_BASE[round] + 0.1 + sweep(m.angle) * 0.02
            });
          }
        } else if (m.state === 'pre' && m.date) {
          const [mx, my] = pt(lvl, m.angle);
          const bothKnown = !!(kids[0]?.side && kids[1]?.side);
          dates.push({
            x: mx,
            y: my,
            text: ddmm(m.date),
            time: hhmm(m.date),
            delay:
              (bothKnown ? COL_BASE[prevRound ?? round] : GREY_BASE[round]) +
              0.12 +
              sweep(m.angle) * 0.02
          });
        }
      }
    }

    for (const m of bracket.rounds.R32) {
      for (const kid of participants('R32', m)) {
        const [x, y] = pt(TEAM_R, kid.a);
        if (kid.side)
          flags.push({
            x,
            y,
            side: kid.side,
            advanced: kid.advanced,
            big: true,
            delay: 0.02 + sweep(kid.a) * 0.4,
            champ: !!champ && kid.side.name === champ.champion.name
          });
      }
    }

    return { segs, flags, dots, scores, dates };
  });

  interface Tip { side: Side; lx: number; ly: number; ox: boolean; oy: boolean; }
  let tip = $state<Tip | null>(null);
  const VB = SIZE + 2 * PAD;
  let tipEl = $state<HTMLDivElement>();
  let placed = $state(false);
  let isMobile = $state(false);
  const showTip = (f: { x: number; y: number; side: Side }) => {
    placed = false;
    tip = {
      side: f.side,
      lx: ((f.x + PAD) / VB) * 100,
      ly: ((f.y + PAD) / VB) * 100,
      ox: f.x > C,
      oy: f.y > C
    };
  };
  const hideTip = () => (tip = null);
  $effect(() => {
    const mq = window.matchMedia('(hover: none), (max-width: 560px)');
    isMobile = mq.matches;
    const on = () => (isMobile = mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  });
  $effect(() => {
    const el = tipEl;
    if (!el || !tip) return;
    if (isMobile) {
      el.style.left = '';
      el.style.top = '';
      return;
    }
    const wrap = el.parentElement as HTMLElement;
    const ww = wrap.clientWidth;
    const wh = wrap.clientHeight;
    const px = (tip.lx / 100) * ww;
    const py = (tip.ly / 100) * wh;
    const tw = el.offsetWidth;
    const th = el.offsetHeight;
    const gap = 12;
    const pad = 6;
    let left = tip.ox ? px - tw - gap : px + gap;
    let top = tip.oy ? py - th - gap : py + gap;
    left = Math.max(pad, Math.min(left, ww - tw - pad));
    top = Math.max(pad, Math.min(top, wh - th - pad));
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    placed = true;
  });
  const FR_RES: Record<string, string> = { W: 'V', D: 'N', L: 'D' };
  const mnum = (m: string) => parseInt(m, 10) || 0;
  const dec = (v: string | null) => (v == null ? '' : v.replace('.', ','));
  const dt = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    const day = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return `${day}, ${time}`;
  };
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && hideTip()} />

<div class="wrap">
<svg
  viewBox="{-PAD} {-PAD} {SIZE + 2 * PAD} {SIZE + 2 * PAD}"
  class="bracket"
  role="img"
  aria-label="Bracket Coupe du Monde 2026"
>
  <g class="links" fill="none">
    {#each geometry.segs as s}
      <path
        d={s.d}
        class:advanced={!!s.color}
        class:champ-path={s.champ}
        class:runner-path={s.runner}
        style:stroke={s.color ?? undefined}
        pathLength="1"
        stroke-dasharray="1"
        style:stroke-dashoffset={1 - prog(s.delay, s.dur)}
      />
    {/each}
  </g>

  <g class="dots">
    {#each geometry.dots as d}
      <circle cx={d.x} cy={d.y} r="4.5" class="merge-dot" class:hidden={reveal < d.delay} />
    {/each}
  </g>

  <g class="flags">
    {#each geometry.flags as f, i}
      {@const r = 21}
      <g transform="translate({f.x} {f.y})">
        <g
          class="flag-hit"
          role="button"
          tabindex="0"
          aria-label="{f.side.name}, détails du match"
          onmouseenter={() => {
            if (!isMobile) showTip(f);
          }}
          onmouseleave={() => {
            if (!isMobile) hideTip();
          }}
          onfocus={() => {
            if (!isMobile) showTip(f);
          }}
          onblur={() => {
            if (!isMobile) hideTip();
          }}
          onclick={() => {
            if (isMobile) showTip(f);
          }}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              showTip(f);
            }
          }}
        >
        <g class="flag" class:hidden={reveal < f.delay}>
          <clipPath id="fc{i}">
            <circle r={r - 1} />
          </clipPath>
          <circle {r} class="flag-ring" class:won={f.advanced} class:champ-ring={f.champ}
            style:stroke={f.champ ? GOLD : f.advanced ? teamColor(f.side) : undefined} />
          <image
            href={f.side.logo}
            x={-1.8 * r}
            y={-1.8 * r}
            width={3.6 * r}
            height={3.6 * r}
            clip-path="url(#fc{i})"
          />
          <text class="flag-label" y={r + 11}>{f.side.abbr}</text>
        </g>
        </g>
      </g>
    {/each}
  </g>

  <g class="scores">
    {#each geometry.scores as s}
      {#if s.video}
        <g
          class="score-btn"
          class:hidden={reveal < s.delay}
          role="button"
          tabindex="0"
          aria-label="Voir le résumé vidéo"
          onclick={() => onvideo?.(s.video!)}
          onkeydown={(e) => e.key === 'Enter' && onvideo?.(s.video!)}
        >
          <text class="score" x={s.x} y={s.y}>{s.text}</text>
          {#if s.pens}
            <text class="pens" x={s.x} y={s.y + 14}>{s.pens}</text>
          {/if}
          <g transform="translate({s.x} {s.y + (s.pens ? 30 : 16)})">
            <circle r="8" class="play-badge" />
            <path d="M-2.4 -4 L4.2 0 L-2.4 4 Z" class="play-tri" />
          </g>
        </g>
      {:else}
        <g class:hidden={reveal < s.delay} class="score-plain">
          <text class="score" x={s.x} y={s.y}>{s.text}</text>
          {#if s.pens}
            <text class="pens" x={s.x} y={s.y + 14}>{s.pens}</text>
          {/if}
        </g>
      {/if}
    {/each}
  </g>

  <g class="dates">
    {#each geometry.dates as d}
      <text class="match-date" x={d.x} y={d.y} class:hidden={reveal < d.delay}
        >{#if d.time}<tspan x={d.x} dy="-0.32em">{d.text}</tspan><tspan class="match-time" x={d.x} dy="1.18em">{d.time}</tspan>{:else}{d.text}{/if}</text
      >
    {/each}
  </g>

  {#if champ}
    {@const cr = 42}
    {@const finalVideo = champ.runnerUp
      ? (videos[[champ.champion.name, champ.runnerUp.name].sort().join('|')] ?? null)
      : null}
    <g class="medal" class:hidden={reveal < 0.96}>
      <circle cx={C} cy={C} r="80" class="medal-halo" />
      <image
        href="{base}/logos/fifa26.png"
        x={C - 36}
        y={C - cr - 76}
        width="72"
        height="72"
        class="medal-mark"
      />
      <g
        class="medal-hit"
        role="button"
        tabindex="0"
        aria-label="{champ.champion.name}, statistiques de la finale"
        onmouseenter={() => {
          if (!isMobile) showTip({ x: C, y: C, side: champ.champion });
        }}
        onmouseleave={() => {
          if (!isMobile) hideTip();
        }}
        onfocus={() => {
          if (!isMobile) showTip({ x: C, y: C, side: champ.champion });
        }}
        onblur={() => {
          if (!isMobile) hideTip();
        }}
        onclick={() => showTip({ x: C, y: C, side: champ.champion })}
        onkeydown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            showTip({ x: C, y: C, side: champ.champion });
          }
        }}
      >
        <clipPath id="champClip"><circle cx={C} cy={C} r={cr - 1} /></clipPath>
        <circle cx={C} cy={C} r={cr} class="medal-ring" />
        <image
          href={champ.champion.logo}
          x={C - 1.8 * cr}
          y={C - 1.8 * cr}
          width={3.6 * cr}
          height={3.6 * cr}
          clip-path="url(#champClip)"
        />
      </g>
      <text class="medal-name" x={C} y={C + cr + 23}>{FR_NAME[champ.champion.name] ?? champ.champion.name}</text>
      <text class="medal-title" x={C} y={C + cr + 38}>{championTitle(champ.champion.name)} 2026</text>
      {#if champ.runnerUp}
        <text class="medal-score" x={C} y={C + cr + 53}
          >{champ.score} c. {FR_NAME[champ.runnerUp.name] ?? champ.runnerUp.name}</text
        >
      {/if}
      {#if finalVideo}
        <g
          class="medal-play"
          role="button"
          tabindex="0"
          aria-label="Voir le résumé de la finale"
          onclick={() => onvideo?.(finalVideo)}
          onkeydown={(e) => e.key === 'Enter' && onvideo?.(finalVideo)}
        >
          <g transform="translate({C} {C + cr + 68})">
            <circle r="9" class="play-badge" />
            <path d="M-2.7 -4.5 L4.7 0 L-2.7 4.5 Z" class="play-tri" />
          </g>
        </g>
      {/if}
    </g>
  {:else}
    <image href="{base}/logos/fifa26.png" x={C - 85} y={C - 85} width="170" height="170" class="fifa-logo" />
  {/if}
</svg>

{#if tip && isMobile}
  <button class="tip-backdrop" aria-label="Fermer" onclick={hideTip}></button>
{/if}
{#if tip}
  {@const s = tip.side}
  <div
    bind:this={tipEl}
    class="tip"
    class:drawer={isMobile}
    style:opacity={placed || isMobile ? 1 : 0}
    role={isMobile ? 'dialog' : 'tooltip'}
  >
    {#if isMobile}
      <button class="tip-close" aria-label="Fermer" onclick={hideTip}>
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"
          ><path
            d="M6 6l12 12M18 6L6 18"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
            fill="none"
          /></svg
        >
      </button>
    {/if}
    {#if s.roundLabel || s.date || s.venue || s.city || s.country}
      <div class="tip-cap">
        {#if s.roundLabel || s.date}
          <div class="cap-meta">
            {#if s.roundLabel}<span class="cap-round">{s.roundLabel}</span>{/if}{#if s.roundLabel && s.date}<span class="cap-dot">·</span>{/if}{#if s.date}{dt(s.date)}{/if}
          </div>
        {/if}
        {#if s.venue}<div class="cap-venue">{s.venue}</div>{/if}
        {#if s.city || s.country}
          <div class="cap-sub">{[s.city, s.country].filter(Boolean).join(', ')}</div>
        {/if}
      </div>
    {/if}
    {#if s.opp}
      {@const o = s.opp}
      {@const A = s.homeAway === 'home' ? s : o}
      {@const B = s.homeAway === 'home' ? o : s}
      {@const cA = teamColor(A)}
      {@const cB = teamColor(B)}
      {@const goals = [
        ...A.goals.map((g) => ({ ...g, c: cA })),
        ...B.goals.map((g) => ({ ...g, c: cB }))
      ].sort((x, y) => mnum(x.minute) - mnum(y.minute))}
      {@const cards = [...A.cards, ...B.cards]
        .filter((c) => c.scorer)
        .sort((x, y) => mnum(x.minute) - mnum(y.minute))}
      {@const stats = [
        { label: 'Possession', a: A.possession, b: B.possession, pct: true },
        { label: 'Tirs', a: A.shots, b: B.shots, pct: false },
        { label: 'Tirs cadrés', a: A.shotsOnTarget, b: B.shotsOnTarget, pct: false },
        { label: 'Passes déc.', a: A.assists, b: B.assists, pct: false },
        { label: 'Corners', a: A.corners, b: B.corners, pct: false },
        { label: 'Fautes', a: A.fouls, b: B.fouls, pct: false }
      ].filter((x) => x.a != null && x.b != null && (x.pct || +x.a + +x.b > 0))}
      <div class="tip-match">
        {#each [A, B] as t}
          <div class="tip-team" class:me={t.id === s.id}>
            <span class="tip-flag"><img src={t.logo} alt="" /></span>
            <span class="tip-name">{t.nameFr}</span>
            {#if t.record}<span class="tip-rec">{t.record}</span>{/if}
            {#if t.score != null}
              <span class="tip-score" class:win={t.winner}
                >{t.score}{t.shootout ? ` (${t.shootout})` : ''}</span
              >
            {/if}
          </div>
        {/each}
      </div>
      {#if goals.length}
        <div class="tip-events">
          {#each goals as g}
            <span class="ev">
              <span class="dot" style:background={g.c}></span><span class="min">{g.minute}</span>
              {g.scorer}{g.note ? ` (${g.note})` : ''}
            </span>
          {/each}
        </div>
      {/if}
      {#if stats.length}
        <div class="tip-stats">
          {#each stats as st}
            {@const av = +(st.a ?? 0)}
            {@const bv = +(st.b ?? 0)}
            {@const la = av + bv > 0 ? (av / (av + bv)) * 100 : 50}
            <div class="cmp">
              <div class="cmp-top">
                <span class="cmp-v">{dec(st.a)}{st.pct ? ' %' : ''}</span>
                <span class="cmp-l">{st.label}</span>
                <span class="cmp-v">{dec(st.b)}{st.pct ? ' %' : ''}</span>
              </div>
              <div class="cmp-bar">
                <span class="cmp-seg" style:width="{la}%" style:background={cA}></span>
                <span class="cmp-seg" style:width="{100 - la}%" style:background={cB}></span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
      {#if cards.length}
        <div class="tip-events cards">
          {#each cards as c}
            <span class="ev"><span class="pip" class:red={c.red}></span><span class="min"
                >{c.minute}</span
              >
              {c.scorer}</span
            >
          {/each}
        </div>
      {/if}
      {#if A.form || B.form}
        <div class="tip-forms">
          <span class="flbl">5 derniers matchs</span>
          {#each [A, B] as t}
            {#if t.form}
              <div class="frow">
                <span class="fabbr">{t.abbr}</span>
                {#each t.form.split('') as ch}<span class="fpip f{ch}">{FR_RES[ch] ?? ch}</span>{/each}
              </div>
            {/if}
          {/each}
        </div>
      {/if}
    {:else}
      <div class="tip-match">
        <div class="tip-team me">
          <span class="tip-flag"><img src={s.logo} alt="" /></span>
          <span class="tip-name">{s.nameFr}</span>
        </div>
      </div>
    {/if}
  </div>
{/if}
</div>

<style>
  .wrap {
    position: relative;
  }
  .bracket {
    width: 100%;
    height: auto;
    display: block;
  }
  .flag-hit {
    cursor: pointer;
    outline: none;
  }
  .flag-hit:hover .flag-ring,
  .flag-hit:focus-visible .flag-ring {
    stroke: var(--accent);
    stroke-width: 4;
  }
  .tip {
    position: absolute;
    z-index: 20;
    width: min(280px, 82%);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 10px 12px;
    box-shadow: 0 12px 32px var(--backdrop);
    font: 400 12.5px/1.35 var(--font);
    color: var(--text);
    pointer-events: none;
    transition: opacity 0.12s ease-out;
  }
  .tip-backdrop {
    position: absolute;
    inset: 0;
    z-index: 19;
    border: 0;
    padding: 0;
    background: var(--backdrop);
    cursor: pointer;
  }
  .tip.drawer {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    top: auto;
    margin: 0;
    width: auto;
    max-width: none;
    max-height: 84%;
    overflow-y: auto;
    border-radius: 16px 16px 0 0;
    padding: 14px 16px 16px;
    pointer-events: auto;
    box-shadow: 0 -8px 30px var(--backdrop);
    animation: drawer-up 0.2s ease-out;
  }
  @keyframes drawer-up {
    from {
      transform: translateY(14px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  .tip-close {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 1;
    width: 30px;
    height: 30px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 999px;
    background: var(--surface-hover);
    color: var(--text-secondary);
    cursor: pointer;
  }
  .tip.drawer .tip-cap {
    padding-right: 30px;
  }
  .tip-cap {
    padding-bottom: 9px;
    margin-bottom: 9px;
    border-bottom: 1px solid var(--border);
  }
  .cap-meta {
    color: var(--text-muted);
    font-size: 10.5px;
    line-height: 1.4;
  }
  .cap-round {
    color: var(--text-secondary);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 9.5px;
  }
  .cap-dot {
    margin: 0 4px;
  }
  .cap-venue {
    color: var(--text);
    font-weight: 700;
    font-size: 13px;
    margin-top: 3px;
  }
  .cap-sub {
    color: var(--text-muted);
    font-size: 10.5px;
    margin-top: 1px;
  }
  .tip-match {
    display: grid;
    gap: 2px;
  }
  .tip-team {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 3px 6px;
    margin: 0 -6px;
    border-radius: 7px;
  }
  .tip-team.me {
    background: var(--surface-hover);
  }
  .tip-flag {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    overflow: hidden;
    flex: none;
    display: inline-block;
  }
  .tip-flag img {
    width: 180%;
    height: 180%;
    margin: -40%;
    object-fit: cover;
    display: block;
  }
  .tip-name {
    font-weight: 600;
    font-size: 13px;
  }
  .tip-team.me .tip-name {
    font-weight: 700;
  }
  .tip-score {
    margin-left: auto;
    font-weight: 600;
    font-size: 14px;
    font-variant-numeric: tabular-nums;
    color: var(--text-secondary);
  }
  .tip-score.win {
    color: var(--text);
    font-weight: 800;
  }
  .tip-rec {
    color: var(--text-muted);
    font-size: 10.5px;
    font-variant-numeric: tabular-nums;
    margin-left: 5px;
  }
  .min {
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  .tip-events {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 11.5px;
    color: var(--text-secondary);
  }
  .tip-events.cards {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 4px 10px;
    margin-top: 7px;
  }
  .ev {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex: none;
  }
  .pip {
    width: 8px;
    height: 11px;
    border-radius: 2px;
    background: #f5c518;
    flex: none;
  }
  .pip.red {
    background: #e5423b;
  }
  .tip-stats {
    margin-top: 9px;
    padding-top: 8px;
    border-top: 1px solid var(--border);
    display: grid;
    gap: 7px;
  }
  .cmp-top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 11px;
  }
  .cmp-v {
    font-weight: 700;
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }
  .cmp-l {
    color: var(--text-muted);
  }
  .cmp-bar {
    display: flex;
    gap: 2px;
    height: 6px;
    margin-top: 3px;
  }
  .cmp-seg {
    height: 100%;
    border-radius: 2px;
  }
  .cmp-seg:first-child {
    border-radius: 999px 2px 2px 999px;
  }
  .cmp-seg:last-child {
    border-radius: 2px 999px 999px 2px;
  }
  .tip-forms {
    margin-top: 9px;
    padding-top: 8px;
    border-top: 1px solid var(--border);
    display: grid;
    gap: 4px;
  }
  .flbl {
    color: var(--text-muted);
    font-size: 10.5px;
  }
  .frow {
    display: flex;
    align-items: center;
    gap: 3px;
  }
  .fabbr {
    color: var(--text-secondary);
    font-size: 10px;
    font-weight: 700;
    width: 30px;
  }
  .fpip {
    width: 15px;
    height: 15px;
    border-radius: 3px;
    font-size: 9.5px;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--c) 20%, transparent);
    color: var(--c);
    border: 1px solid color-mix(in srgb, var(--c) 38%, transparent);
  }
  .fpip.fW {
    --c: var(--result-win);
  }
  .fpip.fD {
    --c: var(--result-draw);
  }
  .fpip.fL {
    --c: var(--result-loss);
  }
  .links path {
    stroke: var(--divider);
    stroke-width: 1.6;
  }
  .links path.advanced {
    stroke-width: 3;
    stroke-linecap: round;
  }
  .links path.runner-path {
    stroke-width: 3.6;
    filter: drop-shadow(0 0 3px rgba(148, 155, 168, 0.75));
  }
  .links path.champ-path {
    stroke-width: 5;
    stroke-linecap: round;
    filter: drop-shadow(0 0 4px rgba(212, 160, 23, 0.55));
  }
  .medal-halo {
    fill: rgba(212, 160, 23, 0.1);
    stroke: rgba(212, 160, 23, 0.35);
    stroke-width: 1;
  }
  .medal-ring {
    fill: var(--surface);
    stroke: #d4a017;
    stroke-width: 4.5;
    filter: drop-shadow(0 0 8px rgba(212, 160, 23, 0.5));
  }
  .champ-ring {
    stroke-width: 4.5;
  }
  .medal-hit {
    cursor: pointer;
    outline: none;
  }
  .medal-hit:hover .medal-ring,
  .medal-hit:focus-visible .medal-ring {
    stroke-width: 6;
  }
  .medal-mark {
    pointer-events: none;
  }
  .medal-play {
    cursor: pointer;
    outline: none;
  }
  .medal-play:hover .play-badge,
  .medal-play:focus-visible .play-badge {
    r: 11;
  }
  .medal-name {
    font: 800 21px var(--font);
    fill: var(--text);
    text-anchor: middle;
    letter-spacing: 0.04em;
    paint-order: stroke;
    stroke: var(--bg);
    stroke-width: 4px;
    user-select: none;
  }
  .medal-title {
    font: 700 12px var(--font);
    fill: #b8860b;
    text-anchor: middle;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    paint-order: stroke;
    stroke: var(--bg);
    stroke-width: 3.5px;
    user-select: none;
  }
  .medal-score {
    font: 600 12px var(--font);
    fill: var(--text-secondary);
    text-anchor: middle;
    font-variant-numeric: tabular-nums;
    paint-order: stroke;
    stroke: var(--bg);
    stroke-width: 3.5px;
    user-select: none;
  }
  .medal {
    transition: opacity 0.5s ease-out;
  }
  .medal.hidden {
    opacity: 0;
  }
  .merge-dot {
    fill: var(--border-strong);
  }
  .flag-ring {
    fill: var(--surface);
    stroke: var(--border);
    stroke-width: 1.5;
  }
  .flag-ring.won {
    stroke-width: 2.8;
  }
  .flag-label {
    font: 700 11px var(--font);
    fill: var(--text-secondary);
    text-anchor: middle;
    letter-spacing: 0.06em;
    paint-order: stroke;
    stroke: var(--bg);
    stroke-width: 3px;
    user-select: none;
  }
  .score {
    font: 700 14.5px var(--font);
    fill: var(--text);
    text-anchor: middle;
    dominant-baseline: central;
    font-variant-numeric: tabular-nums;
    paint-order: stroke;
    stroke: var(--bg);
    stroke-width: 4px;
    user-select: none;
  }
  @media (prefers-color-scheme: dark) {
    .fifa-logo,
    .medal-mark {
      filter: invert(1) hue-rotate(180deg);
    }
  }
  .score-btn {
    cursor: pointer;
    outline: none;
  }
  .play-badge {
    fill: var(--accent);
  }
  .play-tri {
    fill: var(--accent-contrast);
  }
  .score-btn:hover .play-badge,
  .score-btn:focus-visible .play-badge {
    transform: scale(1.25);
    transform-box: fill-box;
    transform-origin: center;
  }
  .pens {
    font: 700 10px var(--font);
    fill: var(--text-secondary);
    text-anchor: middle;
    dominant-baseline: central;
    font-variant-numeric: tabular-nums;
    paint-order: stroke;
    stroke: var(--bg);
    stroke-width: 3px;
    user-select: none;
  }
  .match-date {
    font: 600 10.5px var(--font);
    fill: var(--text-muted);
    text-anchor: middle;
    dominant-baseline: central;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
    paint-order: stroke;
    stroke: var(--bg);
    stroke-width: 3.5px;
    user-select: none;
  }
  .match-time {
    fill: var(--text-secondary);
    font-weight: 700;
  }
  .merge-dot,
  .score-plain,
  .score-btn,
  .match-date {
    opacity: 1;
    transition: opacity 0.5s ease-out;
  }
  .flag {
    opacity: 1;
    transform: scale(1);
    transform-box: fill-box;
    transform-origin: center;
    transition:
      opacity 0.45s ease-out,
      transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .hidden {
    opacity: 0;
  }
  .flag.hidden {
    transform: scale(0.3);
  }
  .score-btn.hidden {
    pointer-events: none;
  }
  @media (prefers-reduced-motion: reduce) {
    .merge-dot,
    .score,
    .score-btn,
    .flag {
      transition: none;
    }
  }
</style>
