<script lang="ts">
  import { onMount } from 'svelte';
  import { LIVE, riderName, fmtGap } from './tdf/live';
  import { doneNs, gapAt, lastN, stageByN, winnerBib } from './tdf/recap';
  import { fmtDate } from './tdf/stages';

  const W = 720;
  const H = 430;
  const M = { top: 30, right: 30, bottom: 28, left: 44 };
  const PW = W - M.left - M.right;
  const PH = H - M.top - M.bottom;

  const pog = winnerBib ?? 1;
  const finalGc = LIVE.stages[String(lastN)]?.gc ?? [];
  const bibs = finalGc.map((r) => r[0]);
  const nF = bibs.length;

  const gapSeries = new Map(
    bibs.map((b) => [b, doneNs.map((n) => gapAt(b, n) ?? gapAt(b, lastN) ?? 0)])
  );

  const maxGap = Math.max(600, ...[...gapSeries.values()].flat());
  const yl = (g: number) => Math.log1p(g);
  const ylMax = yl(maxGap);
  const xOf = (g: number) => M.left + (yl(g) / ylMax) * PW;

  const gaps = [0, 60, 300, 900, 3600, 10800, 21600].filter((g) => g <= maxGap * 1.02);
  const fmtGrid = (s: number) => {
    if (s === 0) return 'tête';
    if (s < 3600) return '+' + Math.round(s / 60) + ' min';
    return '+' + s / 3600 + ' h';
  };

  const nStages = doneNs.length;
  let t = $state(0);
  let playing = $state(false);
  let raf = 0;
  let prevTs = 0;
  const SPEED = 2.6;

  const xAtT = (bib: number): number => {
    const s = gapSeries.get(bib)!;
    const i0 = Math.floor(t);
    const i1 = Math.min(nStages - 1, i0 + 1);
    const f = t - i0;
    const x0 = xOf(s[i0]);
    const x1 = xOf(s[i1]);
    return x0 + (x1 - x0) * f;
  };

  const laneY = (i: number) => M.top + (i / Math.max(1, nF - 1)) * PH;

  const dots = $derived.by(() => {
    const arr = bibs.map((b) => ({ bib: b, x: xAtT(b), gold: b === pog }));
    arr.sort((a, b) => a.x - b.x || (a.gold ? -1 : b.gold ? 1 : 0));
    return arr.map((d, i) => ({ ...d, y: laneY(i) }));
  });

  const curN = $derived(doneNs[Math.round(t)]);
  const curStage = $derived(stageByN(curN));
  const curGc = $derived(LIVE.stages[String(curN)]?.gc ?? []);
  const curLeader = $derived(curGc[0]?.[0] ?? null);
  const pogGapNow = $derived(curGc.find((r) => r[0] === pog)?.[1] ?? 0);
  const within = $derived.by(() => {
    const behind = curGc.filter((r) => r[0] !== curLeader).map((r) => r[1]);
    return {
      m1: behind.filter((d) => d <= 60).length,
      m5: behind.filter((d) => d <= 300).length,
      h1: behind.filter((d) => d >= 3600).length
    };
  });

  const tick = (ts: number) => {
    if (!playing) return;
    if (!prevTs) prevTs = ts;
    const dt = (ts - prevTs) / 1000;
    prevTs = ts;
    t = Math.min(nStages - 1, t + dt * SPEED);
    if (t >= nStages - 1) {
      t = nStages - 1;
      playing = false;
      prevTs = 0;
      return;
    }
    raf = requestAnimationFrame(tick);
  };

  const play = () => {
    if (playing) {
      playing = false;
      cancelAnimationFrame(raf);
      prevTs = 0;
      return;
    }
    if (t >= nStages - 1) t = 0;
    playing = true;
    prevTs = 0;
    raf = requestAnimationFrame(tick);
  };

  const onScrub = (e: Event) => {
    playing = false;
    cancelAnimationFrame(raf);
    prevTs = 0;
    t = Number((e.target as HTMLInputElement).value);
  };

  const short = (bib: number | null) => {
    if (bib == null) return '';
    const p = riderName(bib).split(' ');
    return p.length > 1 ? `${p[0][0]}. ${p.slice(1).join(' ')}` : p[0];
  };

  onMount(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      t = nStages - 1;
      return;
    }
    const id = setTimeout(() => {
      playing = true;
      prevTs = 0;
      raf = requestAnimationFrame(tick);
    }, 700);
    return () => {
      clearTimeout(id);
      cancelAnimationFrame(raf);
    };
  });
</script>

<div class="swarm">
  <div class="head">
    <button class="play" onclick={play} aria-label={playing ? 'Pause' : 'Lecture'}>
      {#if playing}
        <svg viewBox="0 0 16 16" width="16" height="16"><rect x="3" y="2" width="4" height="12" rx="1" /><rect x="9" y="2" width="4" height="12" rx="1" /></svg>
      {:else}
        <svg viewBox="0 0 16 16" width="16" height="16"><path d="M4 2.5 13 8l-9 5.5z" /></svg>
      {/if}
    </button>
    <div class="readout">
      <p class="r-stage">Étape {curN}<span> · {curStage?.start} → {curStage?.end}</span></p>
      <p class="r-date">{curStage ? fmtDate(curStage.date) : ''} · maillot jaune {short(curLeader)}</p>
    </div>
    <div class="counts">
      <span><b>{within.m1}</b> à −1 min</span>
      <span><b>{within.m5}</b> à −5 min</span>
      <span><b>{within.h1}</b> à +1 h</span>
    </div>
  </div>

  <svg viewBox="0 0 {W} {H}" role="img" aria-label="Chaque coureur classé est un point, positionné par son écart au maillot jaune, animé étape par étape">
    {#each gaps as g}
      <line x1={xOf(g)} x2={xOf(g)} y1={M.top - 6} y2={H - M.bottom} class="grid" class:head-grid={g === 0} />
      <text x={xOf(g)} y={H - M.bottom + 16} class="gtick" class:head={g === 0}>{fmtGrid(g)}</text>
    {/each}

    {#each dots as d (d.bib)}
      {#if !d.gold}
        <circle cx={d.x} cy={d.y} r="2.3" class="dot" />
      {/if}
    {/each}

    {#each dots as d (d.bib)}
      {#if d.gold}
        <circle cx={d.x} cy={d.y} r="9" class="halo" />
        <circle cx={d.x} cy={d.y} r="5" class="pog-dot" />
        <text x={d.x} y={d.y - 13} class="pog-lbl">Pogačar {pogGapNow === 0 ? '' : fmtGap(pogGapNow)}</text>
      {/if}
    {/each}
  </svg>

  <input class="scrub" type="range" min="0" max={nStages - 1} step="0.02" value={t} oninput={onScrub} aria-label="Timeline des étapes" />

  <p class="foot">
    {nF} coureurs classés, chacun un point · position horizontale = écart au maillot jaune · ordre vertical = classement final. Pressez lecture pour rejouer les 21 étapes.
  </p>
</div>

<style>
  .swarm {
    position: relative;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 0 0 10px;
  }
  .play {
    flex: none;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    border: none;
    background: var(--tdf-jaune);
    color: #1a1a1a;
    display: grid;
    place-items: center;
    cursor: pointer;
    transition: transform 0.12s;
  }
  .play:hover {
    transform: scale(1.06);
  }
  .play svg {
    fill: #1a1a1a;
  }
  .readout {
    flex: 1;
    min-width: 0;
  }
  .r-stage {
    margin: 0;
    font-size: 15px;
    font-weight: 800;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .r-stage span {
    font-weight: 500;
    color: var(--text-secondary);
  }
  .r-date {
    margin: 1px 0 0;
    font-size: 11px;
    color: var(--text-muted);
    text-transform: capitalize;
  }
  .counts {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 1px;
    text-align: right;
    font-size: 10.5px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
  .counts b {
    color: var(--tdf-jaune);
    font-size: 12px;
  }
  svg {
    width: 100%;
    height: auto;
    display: block;
    font-family: var(--font);
  }
  .grid {
    stroke: var(--divider);
    stroke-width: 1;
  }
  .head-grid {
    stroke: var(--tdf-jaune);
    stroke-opacity: 0.4;
    stroke-width: 1.2;
  }
  .gtick {
    fill: var(--text-muted);
    font-size: 10px;
    text-anchor: middle;
    font-variant-numeric: tabular-nums;
  }
  .gtick.head {
    fill: var(--tdf-jaune);
    font-weight: 700;
  }
  .dot {
    fill: var(--text-muted);
    fill-opacity: 0.5;
    stroke: var(--bg);
    stroke-width: 0.4;
  }
  .halo {
    fill: var(--tdf-jaune);
    opacity: 0.18;
  }
  .pog-dot {
    fill: var(--tdf-jaune);
    stroke: var(--bg);
    stroke-width: 1.5;
  }
  .pog-lbl {
    fill: var(--tdf-jaune);
    font-size: 11px;
    font-weight: 800;
    text-anchor: middle;
    font-variant-numeric: tabular-nums;
  }
  .scrub {
    width: 100%;
    margin: 8px 0 0;
    accent-color: var(--tdf-jaune);
    cursor: pointer;
  }
  .foot {
    text-align: center;
    font-size: 11px;
    color: var(--text-muted);
    margin: 8px 0 0;
  }
  @media (max-width: 480px) {
    .counts {
      display: none;
    }
  }
</style>
