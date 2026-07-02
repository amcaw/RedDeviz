<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import {
    ROUND_ORDER,
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

  interface Seg { d: string; color: string | null; delay: number; dur: number; }
  interface Flag { x: number; y: number; side: Side; advanced: boolean; big: boolean; delay: number; }
  interface Dot { x: number; y: number; delay: number; }
  interface Score { x: number; y: number; text: string; video: WcVideoRef | null; delay: number; }

  const geometry = $derived.by(() => {
    void isLight;
    const segs: Seg[] = [];
    const flags: Flag[] = [];
    const dots: Dot[] = [];
    const scores: Score[] = [];

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
          const inColor = round === 'R32' ? (kid.advanced ? col : null) : kid.side ? col : null;
          const inDelay = inColor
            ? (round === 'R32' ? COL_BASE.R32 : COL_BASE[prevRound!] + 0.05) + jitter
            : greyBase + jitter;
          segs.push({
            d: radial(kid.a, inFrom, lvl),
            color: inColor,
            delay: inDelay,
            dur: 0.05
          });
          if (round !== 'F') {
            const arcColor = kid.advanced ? col : null;
            segs.push({
              d: arc(lvl, kid.a, m.angle),
              color: arcColor,
              delay: arcColor ? COL_BASE[round] + 0.04 + jitter : greyBase + 0.04 + jitter,
              dur: 0.05
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
                delay: COL_BASE[prevRound!] + 0.11 + jitter
              });
            else dots.push({ x, y, delay: greyBase + 0.1 + jitter });
          }
        }
        if (kids[0]?.side && kids[1]?.side && (m.state === 'post' || m.state === 'in')) {
          const flagR = round === 'R32' ? TEAM_R : lvl;
          const [ax, ay] = pt(flagR, kids[0].a);
          const [bx, by] = pt(flagR, kids[1].a);
          const aFirst = Math.abs(ax - bx) > 12 ? ax < bx : ay < by;
          const [s1, s2] = aFirst ? [kids[0], kids[1]] : [kids[1], kids[0]];
          const [mx, my] = pt(lvl, m.angle);
          const key = [kids[0].side.name, kids[1].side.name].sort().join('|');
          scores.push({
            x: mx,
            y: my,
            text: `${s1.side!.score ?? ''}–${s2.side!.score ?? ''}`,
            video: videos[key] ?? null,
            delay: COL_BASE[round] + 0.1 + sweep(m.angle) * 0.02
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
            delay: 0.02 + sweep(kid.a) * 0.4
          });
      }
    }
    return { segs, flags, dots, scores };
  });
</script>

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
        <g class="flag" class:hidden={reveal < f.delay}>
          <clipPath id="fc{i}">
            <circle r={r - 1} />
          </clipPath>
          <circle {r} class="flag-ring" class:won={f.advanced}
            style:stroke={f.advanced ? teamColor(f.side) : undefined} />
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
          <g transform="translate({s.x} {s.y + 16})">
            <circle r="8" class="play-badge" />
            <path d="M-2.4 -4 L4.2 0 L-2.4 4 Z" class="play-tri" />
          </g>
        </g>
      {:else}
        <text class="score" x={s.x} y={s.y} class:hidden={reveal < s.delay}>{s.text}</text>
      {/if}
    {/each}
  </g>

  <image href="{base}/logos/fifa26.png" x={C - 85} y={C - 85} width="170" height="170" class="fifa-logo" />
</svg>

<style>
  .bracket {
    width: 100%;
    height: auto;
    display: block;
  }
  .links path {
    stroke: var(--divider);
    stroke-width: 1.6;
  }
  .links path.advanced {
    stroke-width: 3;
    stroke-linecap: round;
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
    .fifa-logo {
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
  .merge-dot,
  .score,
  .score-btn {
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
