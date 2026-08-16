<script lang="ts">
  import { TYPE_COLOR, REST_DAYS } from './tdf/stages';
  import { LIVE, riderName, fmtGap } from './tdf/live';
  import { cumStages, totalKmDone, TYPE_SHORT, type CumStage } from './tdf/recap';

  const rows: CumStage[] = cumStages;

  const W = 720;
  const H = 300;
  const M = { top: 26, right: 24, bottom: 54, left: 24 };
  const PW = W - M.left - M.right;
  const PH = H - M.top - M.bottom;
  const ROAD = M.top + PH;
  const BAND = PH - 8;

  const maxGap = Math.max(30, ...rows.map((r) => r.frontGap));
  const xk = (km: number) => M.left + (km / totalKmDone) * PW;
  const gy = (gap: number) => ROAD - (gap / maxGap) * BAND;

  const catmull = (pts: [number, number][]) => {
    if (pts.length < 2) return pts.length ? `M ${pts[0][0]} ${pts[0][1]}` : '';
    let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] ?? p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6;
      const c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6;
      const c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    return d;
  };

  const gapPts: [number, number][] = rows.map((r) => [xk(r.midKm), gy(r.frontGap)]);
  const anchored: [number, number][] = rows.length
    ? [[xk(0), gy(rows[0].frontGap)], ...gapPts, [xk(totalKmDone), gy(rows[rows.length - 1].frontGap)]]
    : [];
  const topLine = catmull(anchored);
  const areaPath = anchored.length ? `${topLine} L ${xk(totalKmDone).toFixed(1)} ${ROAD} L ${xk(0).toFixed(1)} ${ROAD} Z` : '';

  const kmTicks = (() => {
    const t: number[] = [];
    for (let v = 0; v <= totalKmDone; v += 500) t.push(v);
    return t;
  })();

  const restMarks = REST_DAYS.map((rd) => {
    let after: CumStage | null = null;
    for (const r of rows) {
      if (r.stage.date < rd.date) after = r;
      else break;
    }
    return after ? { km: after.cumKm, place: rd.place } : null;
  }).filter((m): m is { km: number; place: string } => m != null);

  const peak = rows.reduce((a, b) => (b.frontGap > a.frontGap ? b : a), rows[0]);

  const short = (bib: number | null) => {
    if (bib == null) return '';
    const p = riderName(bib).split(' ');
    return p.length > 1 ? `${p[0][0]}. ${p.slice(1).join(' ')}` : p[0];
  };

  let hoverI = $state<number | null>(null);
  let svgEl = $state<SVGSVGElement>();

  const onMove = (e: MouseEvent | Touch) => {
    if (!svgEl || !rows.length) return;
    const box = svgEl.getBoundingClientRect();
    const km = (((e.clientX - box.left) / box.width) * W - M.left) / PW * totalKmDone;
    let best = 0;
    let bd = Infinity;
    rows.forEach((r, i) => {
      const d = Math.abs(r.midKm - km);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    hoverI = best;
  };

  const hoverInfo = $derived.by(() => {
    if (hoverI == null) return null;
    const r = rows[hoverI];
    const gc = LIVE.stages[String(r.n)]?.gc ?? [];
    return { r, first: gc[0]?.[0] ?? null, second: gc[1]?.[0] ?? null };
  });
</script>

{#if rows.length}
  <div class="road">
    <svg
      bind:this={svgEl}
      viewBox="0 0 {W} {H}"
      role="img"
      aria-label="Écart entre le premier et le deuxième du général le long des kilomètres du Tour"
      onmousemove={onMove}
      onmouseleave={() => (hoverI = null)}
      ontouchstart={(e) => onMove(e.touches[0])}
      ontouchmove={(e) => onMove(e.touches[0])}
    >
      <defs>
        <linearGradient id="gapfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--tdf-fill)" stop-opacity="0.55" />
          <stop offset="100%" stop-color="var(--tdf-fill)" stop-opacity="0.06" />
        </linearGradient>
      </defs>

      <path d={areaPath} fill="url(#gapfill)" class="area" />
      <path d={topLine} class="tline" />

      {#each rows as r}
        {@const x0 = xk(r.cumKm - r.stage.km)}
        {@const x1 = xk(r.cumKm)}
        <rect x={x0} y={ROAD} width={Math.max(0.5, x1 - x0 - 0.6)} height="7" style:fill={TYPE_COLOR[r.stage.type]} class="seg" class:on={hoverI === rows.indexOf(r)} />
        {#if r.stage.type === 'montagne'}
          <path d="m8 3 4 8 5-5 5 15H2L8 3z" transform="translate({((x0 + x1) / 2).toFixed(1)} {ROAD + 20}) scale(0.42) translate(-12 -12)" class="mtn" />
        {:else if r.stage.type === 'clm'}
          <text x={(x0 + x1) / 2} y={ROAD + 22} class="clm">clm</text>
        {/if}
      {/each}

      {#each kmTicks as k}
        <text x={xk(k)} y={ROAD + 44} class="kmtick">{k === 0 ? '0' : k}</text>
      {/each}
      <text x={xk(totalKmDone)} y={ROAD + 44} class="kmtick end">km</text>

      {#each restMarks as rm}
        <line x1={xk(rm.km)} x2={xk(rm.km)} y1={M.top} y2={ROAD + 7} class="rest" />
        <text x={xk(rm.km)} y={M.top - 6} class="rest-lbl">repos</text>
      {/each}

      <text x={xk(0)} y={ROAD - 4} class="city start">{rows[0].stage.start}</text>
      <text x={xk(totalKmDone)} y={ROAD - 4} class="city end">{rows[rows.length - 1].stage.end}</text>

      {#if peak}
        <text x={xk(peak.midKm)} y={gy(peak.frontGap) - 8} class="peak">écart max {fmtGap(peak.frontGap).replace('+ ', '')}</text>
      {/if}

      {#if hoverI != null}
        <line x1={xk(rows[hoverI].midKm)} x2={xk(rows[hoverI].midKm)} y1={M.top} y2={ROAD} class="cross" />
        <circle cx={xk(rows[hoverI].midKm)} cy={gy(rows[hoverI].frontGap)} r="4" class="cdot" />
      {/if}
    </svg>

    {#if hoverInfo}
      <div class="htip" style:left="{(xk(hoverInfo.r.midKm) / W) * 100}%" class:flip={xk(hoverInfo.r.midKm) > W * 0.6}>
        <p class="h-cap">Étape {hoverInfo.r.n} · {TYPE_SHORT[hoverInfo.r.stage.type]}</p>
        <p class="h-road">{hoverInfo.r.stage.start} → {hoverInfo.r.stage.end}</p>
        <p class="h-km">km {Math.round(hoverInfo.r.cumKm)}</p>
        <p class="h-gap">
          <span class="lead">{short(hoverInfo.first)}</span> devance
          <span>{short(hoverInfo.second)}</span> de
          <b>{hoverInfo.r.frontGap === 0 ? 'ex æquo' : fmtGap(hoverInfo.r.frontGap).replace('+ ', '')}</b>
        </p>
      </div>
    {/if}

    <p class="road-foot">La hauteur de la vague = l'écart entre le maillot jaune et son dauphin, kilomètre après kilomètre.</p>
  </div>
{/if}

<style>
  .road {
    position: relative;
  }
  svg {
    width: 100%;
    height: auto;
    display: block;
    font-family: var(--font);
    touch-action: none;
  }
  .area {
    stroke: none;
  }
  .tline {
    fill: none;
    stroke: var(--tdf-gold);
    stroke-width: 2.4;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .seg {
    stroke: var(--bg);
    stroke-width: 0.5;
  }
  .seg.on {
    filter: brightness(1.12);
  }
  .mtn {
    fill: none;
    stroke: var(--tdf-mont);
    stroke-width: 3.2;
    stroke-linejoin: round;
    stroke-linecap: round;
    opacity: 0.8;
  }
  .clm {
    fill: var(--text-muted);
    font-size: 7.5px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    text-anchor: middle;
    opacity: 0.75;
  }
  .kmtick {
    fill: var(--text-muted);
    font-size: 9.5px;
    text-anchor: middle;
    font-variant-numeric: tabular-nums;
    opacity: 0.7;
  }
  .kmtick.end {
    opacity: 0.5;
  }
  .rest {
    stroke: var(--text-muted);
    stroke-width: 1;
    stroke-dasharray: 2 3;
    opacity: 0.6;
  }
  .rest-lbl {
    fill: var(--text-muted);
    font-size: 8.5px;
    text-anchor: middle;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    opacity: 0.8;
  }
  .city {
    fill: var(--text);
    font-size: 11px;
    font-weight: 700;
  }
  .city.start {
    text-anchor: start;
  }
  .city.end {
    text-anchor: end;
  }
  .peak {
    fill: var(--tdf-gold);
    font-size: 10px;
    font-weight: 700;
    text-anchor: middle;
  }
  .cross {
    stroke: var(--border-strong);
    stroke-width: 1;
  }
  .cdot {
    fill: var(--tdf-gold);
    stroke: var(--bg);
    stroke-width: 1.5;
  }
  .htip {
    position: absolute;
    top: 8px;
    transform: translateX(10px);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 8px 11px;
    box-shadow: 0 8px 24px var(--backdrop);
    font: 400 11px/1.5 var(--font);
    pointer-events: none;
    min-width: 172px;
    z-index: 5;
  }
  .htip.flip {
    transform: translateX(calc(-100% - 10px));
  }
  .h-cap {
    margin: 0;
    font-weight: 700;
    font-size: 11px;
    color: var(--text);
  }
  .h-road {
    margin: 0;
    color: var(--text-secondary);
    font-size: 10.5px;
  }
  .h-km {
    margin: 0 0 4px;
    color: var(--text-muted);
    font-size: 9.5px;
    font-variant-numeric: tabular-nums;
  }
  .h-gap {
    margin: 0;
    color: var(--text-muted);
    line-height: 1.45;
  }
  .h-gap .lead {
    color: var(--text);
    font-weight: 700;
  }
  .h-gap b {
    color: var(--tdf-gold);
    font-variant-numeric: tabular-nums;
  }
  .road-foot {
    text-align: center;
    font-size: 11px;
    color: var(--text-muted);
    margin: 6px 0 0;
  }
</style>
