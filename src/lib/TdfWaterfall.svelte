<script lang="ts">
  import { TYPE_COLOR } from './tdf/stages';
  import { riderName } from './tdf/live';
  import { marginWaterfall, winnerBib, runnerBib, TYPE_SHORT, fmtMin, fmtSigned, type MarginStep } from './tdf/recap';

  const steps: MarginStep[] = marginWaterfall();

  const W = 720;
  const H = 360;
  const M = { top: 28, right: 58, bottom: 46, left: 50 };
  const PW = W - M.left - M.right;
  const PH = H - M.top - M.bottom;

  const margins = steps.map((s) => s.margin);
  const lo = Math.min(0, ...margins);
  const hi = Math.max(60, ...margins);
  const pad = (hi - lo) * 0.08;

  const x = (i: number) => M.left + (steps.length > 1 ? (i / (steps.length - 1)) * PW : PW / 2);
  const y = (v: number) => M.top + (1 - (v - (lo - pad)) / (hi + pad - (lo - pad))) * PH;
  const bw = Math.min(20, (PW / steps.length) * 0.62);

  const yTicks = (() => {
    const span = hi + pad - (lo - pad);
    const step = span > 900 ? 300 : span > 360 ? 120 : 60;
    const t: number[] = [];
    for (let v = Math.ceil((lo - pad) / step) * step; v <= hi + pad; v += step) t.push(v);
    if (!t.includes(0)) t.push(0);
    return t;
  })();

  const fmtTick = (s: number) => (s === 0 ? '0' : (s > 0 ? '+' : '−') + fmtMin(Math.abs(s)));

  const marginLine =
    steps.map((s, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(s.margin).toFixed(1)}`).join(' ');

  const short = (bib: number | null) => {
    if (bib == null) return '';
    const p = riderName(bib).split(' ');
    return p.length > 1 ? `${p[0][0]}. ${p.slice(1).join(' ')}` : p[0];
  };

  const ranked = [...steps].map((s, i) => ({ ...s, i })).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const noteIdx = new Set(ranked.slice(0, 3).map((s) => s.i));
  const last = steps.length ? steps[steps.length - 1] : null;

  let hoverI = $state<number | null>(null);
</script>

{#if steps.length && winnerBib != null && runnerBib != null}
  <div class="wf">
    <p class="wf-lead">
      <span class="chip win">{riderName(winnerBib)}</span> construit son avance sur
      <span class="chip run">{riderName(runnerBib)}</span>, étape après étape
    </p>
    <svg
      viewBox="0 0 {W} {H}"
      role="img"
      aria-label="Écart cumulé entre le vainqueur et le deuxième du général, étape par étape"
      onmouseleave={() => (hoverI = null)}
    >
      {#each yTicks as t}
        <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} class="grid" class:zero={t === 0} />
        <text x={M.left - 8} y={y(t)} class="ytick">{fmtTick(t)}</text>
      {/each}

      {#each steps as s, i}
        {@const y0 = y(i ? steps[i - 1].margin : 0)}
        {@const y1 = y(s.margin)}
        {@const gain = s.delta >= 0}
        <rect
          x={x(i) - bw / 2}
          y={Math.min(y0, y1)}
          width={bw}
          height={Math.max(1.5, Math.abs(y1 - y0))}
          rx="2"
          class="bar"
          class:gain
          style:fill={gain ? 'var(--tdf-fill)' : 'var(--result-loss)'}
          class:on={hoverI === i}
          role="presentation"
          onmouseenter={() => (hoverI = i)}
        />
        {#if i > 0}
          <line x1={x(i - 1)} x2={x(i) - bw / 2} y1={y(steps[i - 1].margin)} y2={y(steps[i - 1].margin)} class="step" />
        {/if}
      {/each}

      <path d={marginLine} class="mline" />
      {#each steps as s, i}
        <circle cx={x(i)} cy={y(s.margin)} r={hoverI === i ? 4 : 2.4} class="mdot" />
      {/each}

      {#each steps as s, i}
        <text x={x(i)} y={H - M.bottom + 15} class="xtick" class:on={hoverI === i}>{s.n}</text>
        <rect x={x(i) - 1.4} y={H - M.bottom + 20} width="2.8" height="6" rx="1.2" style:fill={TYPE_COLOR[s.stage.type]} class="type-mark" />
      {/each}

      {#each steps as s, i}
        {#if noteIdx.has(i) && Math.abs(s.delta) > 20}
          {@const up = s.delta >= 0}
          <text x={x(i)} y={up ? y(s.margin) - 12 : y(s.margin) + 20} class="note" class:below={!up}>
            <tspan class="note-d">{fmtSigned(s.delta)}</tspan>
          </text>
        {/if}
      {/each}

      {#if last}
        <text x={x(steps.length - 1) + 7} y={y(last.margin)} class="final">{fmtMin(last.margin)}</text>
      {/if}

      <text x={M.left} y={H - 8} class="axis-note">étape · couleur = type de terrain</text>
    </svg>

    {#if hoverI != null}
      {@const s = steps[hoverI]}
      <div class="htip" style:left="{(x(hoverI) / W) * 100}%" class:flip={x(hoverI) > W * 0.6}>
        <p class="h-cap">Étape {s.n} · {TYPE_SHORT[s.stage.type]}</p>
        <p class="h-road">{s.stage.start} → {s.stage.end}</p>
        <p class="h-line"><span>Ce jour-là</span><b class:pos={s.delta >= 0} class:neg={s.delta < 0}>{fmtSigned(s.delta)}</b></p>
        <p class="h-line"><span>Écart au 2ᵉ</span><b>{fmtMin(s.margin)}</b></p>
      </div>
    {/if}

    <p class="wf-foot">
      Barre vers le haut : {short(winnerBib)} reprend du temps · vers le bas : il en concède. La ligne suit l'écart total au 2ᵉ.
    </p>
  </div>
{/if}

<style>
  .wf {
    position: relative;
  }
  .wf-lead {
    text-align: center;
    font-size: 13px;
    color: var(--text-secondary);
    margin: 0 0 4px;
  }
  .chip {
    font-weight: 700;
    padding: 1px 7px;
    border-radius: 20px;
    white-space: nowrap;
  }
  .chip.win {
    background: var(--tdf-jaune);
    color: #1a1a1a;
  }
  .chip.run {
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
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
  .grid.zero {
    stroke: var(--border-strong);
    stroke-width: 1.3;
  }
  .ytick {
    fill: var(--text-muted);
    font-size: 10px;
    text-anchor: end;
    dominant-baseline: middle;
    font-variant-numeric: tabular-nums;
  }
  .xtick {
    fill: var(--text-muted);
    font-size: 9.5px;
    text-anchor: middle;
    opacity: 0.6;
    font-variant-numeric: tabular-nums;
  }
  .xtick.on {
    opacity: 1;
    font-weight: 700;
    fill: var(--text);
  }
  .type-mark {
    opacity: 0.9;
  }
  .bar {
    stroke: var(--bg);
    stroke-width: 0.6;
    transition: filter 0.12s;
    cursor: default;
  }
  .bar.on {
    filter: brightness(1.08) drop-shadow(0 1px 3px rgba(0, 0, 0, 0.3));
  }
  .step {
    stroke: var(--border);
    stroke-width: 1;
    stroke-dasharray: 2 2.5;
  }
  .mline {
    fill: none;
    stroke: var(--tdf-gold);
    stroke-width: 2.4;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .mdot {
    fill: var(--tdf-gold);
    stroke: var(--bg);
    stroke-width: 1.2;
  }
  .note {
    text-anchor: middle;
    font-variant-numeric: tabular-nums;
  }
  .note-d {
    fill: var(--text-secondary);
    font-size: 10.5px;
    font-weight: 700;
  }
  .final {
    fill: var(--tdf-gold);
    font-size: 12px;
    font-weight: 800;
    dominant-baseline: middle;
    font-variant-numeric: tabular-nums;
  }
  .axis-note {
    fill: var(--text-muted);
    font-size: 9.5px;
    text-anchor: start;
    opacity: 0.8;
  }
  .htip {
    position: absolute;
    top: 34px;
    transform: translateX(10px);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 8px 11px;
    box-shadow: 0 8px 24px var(--backdrop);
    font: 400 11px/1.5 var(--font);
    pointer-events: none;
    min-width: 150px;
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
    margin: 0 0 5px;
    color: var(--text-muted);
    font-size: 10px;
  }
  .h-line {
    margin: 0;
    display: flex;
    justify-content: space-between;
    gap: 14px;
  }
  .h-line span {
    color: var(--text-muted);
  }
  .h-line b {
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }
  .h-line b.pos {
    color: var(--tdf-gold);
  }
  .h-line b.neg {
    color: var(--result-loss);
  }
  .wf-foot {
    text-align: center;
    font-size: 11px;
    color: var(--text-muted);
    margin: 6px 0 0;
  }
</style>
