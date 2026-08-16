<script lang="ts">
  import { STAGES } from './tdf/stages';
  import { LIVE, riderName, riderTeam, riderFlag, fmtGap } from './tdf/live';
  import { doneNs, topTraj, winnerBib, stageByN } from './tdf/recap';

  const N_TOP = 8;
  const N_HERO = 3;
  const HERO = ['var(--tdf-jaune)', 'var(--tdf-acc)', 'var(--tdf-mont)'];

  const S = 600;
  const C = S / 2;
  const SEAM = 26;
  const A0 = -90 + SEAM / 2;
  const SPAN = 360 - SEAM;
  const R_MIN = 96;
  const R_MAX = 268;

  const idxOf = (n: number) => doneNs.indexOf(n);
  const ang = (n: number) => A0 + (idxOf(n) / Math.max(1, doneNs.length - 1)) * SPAN;
  const rad = (deg: number) => (deg * Math.PI) / 180;

  const trajs = topTraj(N_TOP);
  const maxGap = Math.max(60, ...trajs.flatMap((t) => t.pts.map((p) => p.gap)));
  const r = (gap: number) => R_MIN + Math.sqrt(gap / maxGap) * (R_MAX - R_MIN);

  const pt = (n: number, gap: number) => {
    const a = rad(ang(n));
    const rr = r(gap);
    return [C + rr * Math.cos(a), C + rr * Math.sin(a)] as const;
  };

  const linePath = (pts: { n: number; gap: number }[]) =>
    pts
      .map((p, i) => {
        const [x, y] = pt(p.n, p.gap);
        return `${i ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');

  const RINGS = [60, 180, 360, 600].filter((g) => g < maxGap);
  const fmtRing = (s: number) => (s % 60 === 0 ? `${s / 60}′` : `${s}″`);

  const mtnStages = doneNs.filter((n) => stageByN(n)?.type === 'montagne');
  const clmStages = doneNs.filter((n) => stageByN(n)?.type === 'clm');

  const glyphAt = (n: number, rr: number, scale: number) => {
    const a = rad(ang(n));
    const x = C + rr * Math.cos(a);
    const y = C + rr * Math.sin(a);
    return { x, y, t: `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale})` };
  };

  const stageLabelPos = (n: number) => glyphAt(n, R_MAX + 20, 1);

  const heroTrajs = trajs.filter((t) => t.rank <= N_HERO);
  const packTrajs = trajs.filter((t) => t.rank > N_HERO);

  const short = (bib: number) => {
    const p = riderName(bib).split(' ');
    return p.length > 1 ? `${p[0][0]}. ${p.slice(1).join(' ')}` : p[0];
  };

  let hoverN = $state<number | null>(null);
  let hoverBib = $state<number | null>(null);
  let svgEl = $state<SVGSVGElement>();

  const onMove = (e: MouseEvent | Touch) => {
    if (!svgEl) return;
    const box = svgEl.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * S - C;
    const py = ((e.clientY - box.top) / box.height) * S - C;
    if (Math.hypot(px, py) < R_MIN - 8) {
      hoverN = null;
      return;
    }
    let deg = (Math.atan2(py, px) * 180) / Math.PI;
    let best: number | null = null;
    let bd = Infinity;
    for (const n of doneNs) {
      let d = Math.abs(((ang(n) - deg + 540) % 360) - 180);
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    hoverN = bd < SPAN / doneNs.length / 1.4 ? best : null;
  };

  const hoverRows = $derived.by(() => {
    if (hoverN == null) return [];
    const gc = LIVE.stages[String(hoverN)]?.gc ?? [];
    return gc.slice(0, 5).map(([bib, gap], i) => ({ bib, gap, rank: i + 1 }));
  });

  const hoverStage = $derived(hoverN != null ? stageByN(hoverN) : null);
</script>

<div class="spiral">
  <svg
    bind:this={svgEl}
    viewBox="0 0 {S} {S}"
    role="img"
    aria-label="Spirale du classement général : chaque rayon est une étape, la distance au centre l'écart au maillot jaune"
    onmousemove={onMove}
    onmouseleave={() => (hoverN = null)}
    ontouchstart={(e) => onMove(e.touches[0])}
    ontouchmove={(e) => onMove(e.touches[0])}
  >
    {#each RINGS as g}
      <circle cx={C} cy={C} r={r(g)} class="ring" />
      <text x={C} y={C - r(g)} class="ring-lbl">{'+' + fmtRing(g)}</text>
    {/each}
    <circle cx={C} cy={C} r={R_MIN} class="ring lead-ring" />

    {#each mtnStages as n}
      {@const a = rad(ang(n))}
      <line
        x1={C + R_MIN * Math.cos(a)}
        y1={C + R_MIN * Math.sin(a)}
        x2={C + (R_MAX + 6) * Math.cos(a)}
        y2={C + (R_MAX + 6) * Math.sin(a)}
        class="mtn-spoke"
      />
    {/each}

    {#if hoverN != null}
      {@const a = rad(ang(hoverN))}
      <line
        x1={C + R_MIN * Math.cos(a)}
        y1={C + R_MIN * Math.sin(a)}
        x2={C + (R_MAX + 8) * Math.cos(a)}
        y2={C + (R_MAX + 8) * Math.sin(a)}
        class="cross-spoke"
      />
    {/if}

    {#each doneNs as n}
      {@const p = stageLabelPos(n)}
      <text x={p.x} y={p.y} class="stage-lbl" class:on={hoverN === n}>{n}</text>
    {/each}

    {#each mtnStages as n}
      {@const p = glyphAt(n, R_MAX + 40, 0.5)}
      <path d="m8 3 4 8 5-5 5 15H2L8 3z" transform="{p.t} translate(-12 -12)" class="mtn-glyph" />
    {/each}
    {#each clmStages as n}
      {@const p = glyphAt(n, R_MAX + 39, 1)}
      <text x={p.x} y={p.y} class="clm-glyph">clm</text>
    {/each}

    {#each packTrajs as t}
      <path
        d={linePath(t.pts)}
        class="pack"
        class:dim={hoverBib != null && hoverBib !== t.bib}
        class:up={hoverBib === t.bib}
      />
    {/each}
    {#each heroTrajs as t}
      <path
        d={linePath(t.pts)}
        class="hero"
        style:stroke={HERO[t.rank - 1]}
        class:dim={hoverBib != null && hoverBib !== t.bib}
      />
      {#if t.pts.length}
        {@const last = t.pts[t.pts.length - 1]}
        {@const [ex, ey] = pt(last.n, last.gap)}
        <circle cx={ex} cy={ey} r="4.5" style:fill={HERO[t.rank - 1]} class="end-dot" />
      {/if}
    {/each}

    {#if hoverN != null}
      {#each hoverRows as h}
        {@const [hx, hy] = pt(hoverN, h.gap)}
        <circle cx={hx} cy={hy} r="3.5" class="hpt" class:hero-pt={h.rank <= N_HERO} style:fill={h.rank <= N_HERO ? HERO[h.rank - 1] : 'var(--result-loss)'} />
      {/each}
    {/if}

    {#if winnerBib != null}
      <circle cx={C} cy={C} r={R_MIN - 14} class="medal-bg" />
      <text x={C} y={C - 30} class="medal-kicker">Vainqueur 2026</text>
      <text x={C} y={C - 4} class="medal-flag">{riderFlag(winnerBib)}</text>
      <text x={C} y={C + 24} class="medal-name">{short(winnerBib)}</text>
      <text x={C} y={C + 44} class="medal-team">{riderTeam(winnerBib)}</text>
    {/if}
  </svg>

  {#if hoverN != null && hoverStage}
    <div class="tip">
      <p class="tip-cap">Étape {hoverN} · {hoverStage.start} → {hoverStage.end}</p>
      {#each hoverRows as h}
        <p class="tip-row">
          <span class="tip-rank">{h.rank}</span>
          <span class="tip-name">{short(h.bib)}</span>
          <span class="tip-gap">{h.gap === 0 ? 'maillot jaune' : fmtGap(h.gap)}</span>
        </p>
      {/each}
    </div>
  {/if}

  <ul class="legend">
    {#each trajs as t}
      <li
        class:hero={t.rank <= N_HERO}
        onmouseenter={() => (hoverBib = t.bib)}
        onmouseleave={() => (hoverBib = null)}
      >
        <span class="sw" style:background={t.rank <= N_HERO ? HERO[t.rank - 1] : 'var(--result-loss)'}></span>
        <span class="rk">{t.rank}</span>
        <span class="nm">{short(t.bib)}</span>
        <span class="gp">{t.finalGap === 0 ? 'tête' : fmtGap(t.finalGap)}</span>
      </li>
    {/each}
  </ul>
</div>

<style>
  .spiral {
    position: relative;
  }
  svg {
    width: 100%;
    height: auto;
    display: block;
    font-family: var(--font);
    touch-action: none;
  }
  .ring {
    fill: none;
    stroke: var(--divider);
    stroke-width: 1;
  }
  .lead-ring {
    stroke: var(--border-strong);
    stroke-dasharray: 2 4;
  }
  .ring-lbl {
    fill: var(--text-muted);
    font-size: 10px;
    text-anchor: middle;
    dominant-baseline: middle;
    font-variant-numeric: tabular-nums;
  }
  .mtn-spoke {
    stroke: var(--tdf-mont);
    stroke-width: 8;
    opacity: 0.07;
    stroke-linecap: round;
  }
  .cross-spoke {
    stroke: var(--border-strong);
    stroke-width: 1.2;
  }
  .stage-lbl {
    fill: var(--text-muted);
    font-size: 11px;
    text-anchor: middle;
    dominant-baseline: middle;
    font-variant-numeric: tabular-nums;
    opacity: 0.6;
  }
  .stage-lbl.on {
    opacity: 1;
    font-weight: 700;
    fill: var(--text);
  }
  .mtn-glyph {
    fill: none;
    stroke: var(--tdf-mont);
    stroke-width: 3.4;
    stroke-linejoin: round;
    stroke-linecap: round;
    opacity: 0.75;
  }
  .clm-glyph {
    fill: var(--text-muted);
    font-size: 8px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    text-anchor: middle;
    dominant-baseline: middle;
    opacity: 0.7;
  }
  .pack {
    fill: none;
    stroke: var(--result-loss);
    stroke-width: 1.3;
    stroke-opacity: 0.38;
    stroke-linejoin: round;
    stroke-linecap: round;
    transition: stroke-opacity 0.15s, stroke-width 0.15s;
  }
  .pack.dim {
    stroke-opacity: 0.1;
  }
  .pack.up {
    stroke-opacity: 1;
    stroke-width: 2.4;
  }
  .hero {
    fill: none;
    stroke-width: 3;
    stroke-linejoin: round;
    stroke-linecap: round;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.25));
    transition: opacity 0.15s;
  }
  .hero.dim {
    opacity: 0.25;
  }
  .end-dot {
    stroke: var(--bg);
    stroke-width: 1.5;
  }
  .hpt {
    stroke: var(--bg);
    stroke-width: 1.4;
  }
  .medal-bg {
    fill: var(--surface);
    stroke: var(--tdf-jaune);
    stroke-width: 2;
    filter: drop-shadow(0 3px 10px rgba(0, 0, 0, 0.28));
  }
  .medal-kicker {
    fill: var(--text-muted);
    font-size: 10px;
    text-anchor: middle;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  .medal-flag {
    font-size: 26px;
    text-anchor: middle;
  }
  .medal-name {
    fill: var(--text);
    font-size: 17px;
    font-weight: 800;
    text-anchor: middle;
  }
  .medal-team {
    fill: var(--text-muted);
    font-size: 8.5px;
    text-anchor: middle;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .tip {
    position: absolute;
    top: 8px;
    left: 8px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 8px 10px;
    box-shadow: 0 8px 24px var(--backdrop);
    font: 400 11px/1.5 var(--font);
    pointer-events: none;
    min-width: 168px;
    z-index: 5;
  }
  .tip-cap {
    margin: 0 0 5px;
    font-weight: 700;
    font-size: 10.5px;
    color: var(--text-secondary);
  }
  .tip-row {
    margin: 0;
    display: flex;
    align-items: baseline;
    gap: 7px;
  }
  .tip-rank {
    color: var(--text-muted);
    width: 12px;
    font-variant-numeric: tabular-nums;
  }
  .tip-name {
    color: var(--text);
    font-weight: 600;
    flex: 1;
    white-space: nowrap;
  }
  .tip-gap {
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .legend {
    list-style: none;
    margin: 6px 0 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1px 18px;
  }
  .legend li {
    display: flex;
    align-items: baseline;
    gap: 7px;
    padding: 3px 4px;
    border-radius: 6px;
    cursor: default;
    font-size: 12px;
  }
  .legend li:hover {
    background: var(--surface);
  }
  .sw {
    width: 9px;
    height: 9px;
    border-radius: 2px;
    flex: none;
    align-self: center;
  }
  .rk {
    color: var(--text-muted);
    width: 12px;
    font-variant-numeric: tabular-nums;
  }
  .nm {
    color: var(--text-secondary);
    flex: 1;
    white-space: nowrap;
  }
  .legend li.hero .nm {
    color: var(--text);
    font-weight: 700;
  }
  .gp {
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  @media (max-width: 520px) {
    .legend {
      grid-template-columns: 1fr;
    }
  }
</style>
