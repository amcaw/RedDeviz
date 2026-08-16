<script lang="ts">
  import { STAGES } from './tdf/stages';
  import { LIVE, riderName, fmtGap } from './tdf/live';
  import { doneNs, gapAt, lastN, stageByN, winnerBib } from './tdf/recap';

  const W = 720;
  const H = 400;
  const M = { top: 24, right: 116, bottom: 34, left: 40 };
  const PW = W - M.left - M.right;
  const PH = H - M.top - M.bottom;

  const pog = winnerBib ?? 1;
  const finalGc = LIVE.stages[String(lastN)]?.gc ?? [];
  const fieldBibs = finalGc.map((r) => r[0]).filter((b) => b !== pog);

  const traj = (bib: number) =>
    doneNs.flatMap((n) => {
      const g = gapAt(bib, n);
      return g == null ? [] : [{ n, gap: g }];
    });

  const pogPts = traj(pog);
  const fieldTraj = fieldBibs.map((bib) => ({ bib, pts: traj(bib) }));

  const maxGap = Math.max(600, ...fieldTraj.flatMap((t) => t.pts.map((p) => p.gap)));
  const yl = (g: number) => Math.log1p(g);
  const ylMax = yl(maxGap);

  const x = (n: number) => M.left + (doneNs.indexOf(n) / Math.max(1, doneNs.length - 1)) * PW;
  const y = (g: number) => M.top + (yl(g) / ylMax) * PH;

  const path = (pts: { n: number; gap: number }[]) =>
    pts.map((p, i) => `${i ? 'L' : 'M'} ${x(p.n).toFixed(1)} ${y(p.gap).toFixed(1)}`).join(' ');

  const yTicks = [0, 60, 300, 900, 3600, 10800, 21600].filter((g) => g <= maxGap * 1.02);
  const fmtY = (s: number) => {
    if (s === 0) return 'tête';
    if (s < 3600) return '+' + Math.round(s / 60) + ' min';
    return '+' + (s / 3600).toFixed(0) + ' h';
  };

  const dip = pogPts.reduce((a, b) => (b.gap > a.gap ? b : a), pogPts[0] ?? { n: 0, gap: 0 });

  const short = (bib: number) => {
    const p = riderName(bib).split(' ');
    return p.length > 1 ? `${p[0][0]}. ${p.slice(1).join(' ')}` : p[0];
  };

  const nFinishers = finalGc.length;
  const gLast = nFinishers ? finalGc[nFinishers - 1][1] : 0;
  const g2 = finalGc.find((r) => r[0] !== pog)?.[1] ?? 0;
  const yellowDays = doneNs.filter((n) => LIVE.stages[String(n)]?.jerseys?.jaune === pog).length;
  const wins = doneNs.filter((n) => LIVE.stages[String(n)]?.top?.[0]?.bib === pog).length;

  let hoverN = $state<number | null>(null);
  let svgEl = $state<SVGSVGElement>();

  const onMove = (e: MouseEvent | Touch) => {
    if (!svgEl || !doneNs.length) return;
    const box = svgEl.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    let best = doneNs[0];
    let bd = Infinity;
    for (const n of doneNs) {
      const d = Math.abs(x(n) - px);
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    hoverN = bd < 26 ? best : null;
  };

  const hoverInfo = $derived.by(() => {
    if (hoverN == null) return null;
    const gc = LIVE.stages[String(hoverN)]?.gc ?? [];
    const pg = gc.find((r) => r[0] === pog)?.[1] ?? 0;
    const behind = gc.filter((r) => r[0] !== pog).map((r) => r[1] - pg);
    const within1 = behind.filter((d) => d > 0 && d <= 60).length;
    const within5 = behind.filter((d) => d > 0 && d <= 300).length;
    const stage = stageByN(hoverN);
    const leaderBib = gc[0]?.[0] ?? null;
    return { pg, within1, within5, stage, leaderBib, isLeader: pg === 0 };
  });
</script>

<div class="wake">
  <div class="stats">
    <div class="stat"><b>{yellowDays}</b><span>étapes en jaune<br />sur {STAGES.length}</span></div>
    <div class="stat"><b>{wins}</b><span>victoires<br />d'étape</span></div>
    <div class="stat"><b>{fmtGap(g2).replace('+ ', '')}</b><span>sur le 2ᵉ<br />du général</span></div>
    <div class="stat"><b>{fmtGap(gLast).replace('+ ', '').replace(/′.*/, ' min')}</b><span>sur la lanterne<br />rouge ({nFinishers}ᵉ)</span></div>
  </div>

  <svg
    bind:this={svgEl}
    viewBox="0 0 {W} {H}"
    role="img"
    aria-label="Retard de chaque coureur classé au général sur le maillot jaune, étape par étape"
    onmousemove={onMove}
    onmouseleave={() => (hoverN = null)}
    ontouchstart={(e) => onMove(e.touches[0])}
    ontouchmove={(e) => onMove(e.touches[0])}
  >
    {#each STAGES as s}
      {#if s.type === 'montagne' && doneNs.includes(s.n)}
        <rect x={x(s.n) - 4} y={M.top} width="8" height={PH} class="mtn-band" />
      {/if}
    {/each}

    {#each yTicks as t}
      <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} class="grid" class:top-grid={t === 0} />
      <text x={M.left - 6} y={y(t)} class="ytick" class:head={t === 0}>{fmtY(t)}</text>
    {/each}

    {#each doneNs as n}
      <text x={x(n)} y={H - M.bottom + 15} class="xtick">{n}</text>
    {/each}

    {#if hoverN != null}
      <line x1={x(hoverN)} x2={x(hoverN)} y1={M.top} y2={H - M.bottom} class="cross" />
    {/if}

    {#each fieldTraj as t}
      <path d={path(t.pts)} class="field" />
    {/each}

    <path d={path(pogPts)} class="pog" />
    {#each pogPts as p}
      <circle cx={x(p.n)} cy={y(p.gap)} r="2.4" class="pog-dot" />
    {/each}

    {#if dip.gap > 120}
      <text x={x(dip.n)} y={y(dip.gap) + 18} class="dip-lbl">échappée · {fmtGap(dip.gap).replace('+ ', '')}</text>
    {/if}

    {#if pogPts.length}
      {@const lp = pogPts[pogPts.length - 1]}
      <circle cx={x(lp.n)} cy={y(lp.gap)} r="4.5" class="pog-end" />
      <text x={x(lp.n) + 9} y={y(lp.gap)} class="pog-lbl">Pogačar</text>
    {/if}

    <text x={W - M.right + 8} y={M.top + 66} class="side-note">le peloton,</text>
    <text x={W - M.right + 8} y={M.top + 80} class="side-note">{nFinishers} arrivés,</text>
    <text x={W - M.right + 8} y={M.top + 94} class="side-note">tous sous lui</text>
  </svg>

  {#if hoverInfo && hoverInfo.stage}
    <div class="htip" style:left="{(x(hoverN ?? 0) / W) * 100}%" class:flip={x(hoverN ?? 0) > W * 0.58}>
      <p class="h-cap">Étape {hoverN} · {hoverInfo.stage.start} → {hoverInfo.stage.end}</p>
      {#if hoverInfo.isLeader}
        <p class="h-lead gold">Pogačar en jaune</p>
      {:else}
        <p class="h-lead">Pogačar {fmtGap(hoverInfo.pg)} · {hoverInfo.leaderBib != null ? short(hoverInfo.leaderBib) : ''} en jaune</p>
      {/if}
      <p class="h-row"><b>{hoverInfo.within1}</b> coureurs à moins d'1 min de lui</p>
      <p class="h-row"><b>{hoverInfo.within5}</b> à moins de 5 min</p>
    </div>
  {/if}

  <p class="foot">
    Chaque ligne grise est l'un des {nFinishers} coureurs qui ont rallié Paris. Échelle logarithmique : même compressé, le champ s'étire de 6 minutes à plus de 6 heures. Pogačar tient le haut du cadre 17 étapes sur 21.
  </p>
</div>

<style>
  .wake {
    position: relative;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin: 0 0 14px;
  }
  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 10px 6px;
    border-radius: 10px;
    background: var(--surface);
    border: 1px solid var(--divider);
  }
  .stat b {
    font-size: 22px;
    font-weight: 800;
    color: var(--tdf-jaune);
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .stat span {
    margin-top: 5px;
    font-size: 10px;
    line-height: 1.25;
    color: var(--text-muted);
  }
  svg {
    width: 100%;
    height: auto;
    display: block;
    font-family: var(--font);
    touch-action: none;
  }
  .mtn-band {
    fill: var(--tdf-mont);
    opacity: 0.1;
  }
  .grid {
    stroke: var(--divider);
    stroke-width: 1;
  }
  .top-grid {
    stroke: var(--tdf-jaune);
    stroke-opacity: 0.35;
    stroke-width: 1.2;
  }
  .ytick {
    fill: var(--text-muted);
    font-size: 10px;
    text-anchor: end;
    dominant-baseline: middle;
    font-variant-numeric: tabular-nums;
  }
  .ytick.head {
    fill: var(--tdf-jaune);
    font-weight: 700;
  }
  .xtick {
    fill: var(--text-muted);
    font-size: 9px;
    text-anchor: middle;
    opacity: 0.6;
    font-variant-numeric: tabular-nums;
  }
  .field {
    fill: none;
    stroke: var(--result-loss);
    stroke-width: 0.8;
    stroke-opacity: 0.3;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .cross {
    stroke: var(--border-strong);
    stroke-width: 1;
  }
  .pog {
    fill: none;
    stroke: var(--tdf-jaune);
    stroke-width: 3.2;
    stroke-linejoin: round;
    stroke-linecap: round;
    filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.4));
  }
  .pog-dot {
    fill: var(--tdf-jaune);
  }
  .pog-end {
    fill: var(--tdf-jaune);
    stroke: var(--bg);
    stroke-width: 1.5;
  }
  .pog-lbl {
    fill: var(--tdf-jaune);
    font-size: 12px;
    font-weight: 800;
    dominant-baseline: middle;
  }
  .side-note {
    fill: var(--text-muted);
    font-size: 10px;
    font-style: italic;
  }
  .dip-lbl {
    fill: var(--text-secondary);
    font-size: 9.5px;
    text-anchor: middle;
    font-variant-numeric: tabular-nums;
  }
  .htip {
    position: absolute;
    top: 96px;
    transform: translateX(10px);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 8px 11px;
    box-shadow: 0 8px 24px var(--backdrop);
    font: 400 11px/1.5 var(--font);
    pointer-events: none;
    min-width: 190px;
    z-index: 5;
  }
  .htip.flip {
    transform: translateX(calc(-100% - 10px));
  }
  .h-cap {
    margin: 0 0 4px;
    font-weight: 700;
    font-size: 10.5px;
    color: var(--text-secondary);
  }
  .h-lead {
    margin: 0 0 4px;
    color: var(--text);
    font-weight: 600;
  }
  .h-lead.gold {
    color: var(--tdf-jaune);
  }
  .h-row {
    margin: 0;
    color: var(--text-muted);
  }
  .h-row b {
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }
  .foot {
    text-align: center;
    font-size: 11px;
    color: var(--text-muted);
    margin: 8px 0 0;
  }
  @media (max-width: 480px) {
    .stat b {
      font-size: 18px;
    }
    .stat span {
      font-size: 9px;
    }
  }
</style>
