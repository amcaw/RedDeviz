<script lang="ts">
  import { STAGES } from './tdf/stages';
  import { LIVE, riderName, fmtGap, parisToday } from './tdf/live';

  const W = 720;
  const H = 320;
  const M = { top: 18, right: 130, bottom: 30, left: 46 };
  const PW = W - M.left - M.right;
  const PH = H - M.top - M.bottom;
  const N_LINES = 8;
  const N_COLORED = 4;
  const COLORS = ['var(--tdf-gold)', 'var(--tdf-c2)', 'var(--tdf-c3)', 'var(--tdf-c4)'];

  const doneNs = $derived(
    STAGES.map((s) => s.n).filter((n) => LIVE.stages[String(n)]?.gc?.length)
  );

  const series = $derived.by(() => {
    if (!doneNs.length) return [];
    const lastGc = LIVE.stages[String(doneNs[doneNs.length - 1])].gc;
    return lastGc.slice(0, N_LINES).map(([bib], i) => {
      const pts = doneNs.flatMap((n) => {
        const row = LIVE.stages[String(n)].gc.find((r) => r[0] === bib);
        return row ? [{ n, gap: row[1] }] : [];
      });
      return { bib, rank: i + 1, pts, last: pts[pts.length - 1] };
    });
  });

  const maxGap = $derived(Math.max(60, ...series.flatMap((s) => s.pts.map((p) => p.gap))));
  const x = (n: number) => M.left + ((n - 1) / (STAGES.length - 1)) * PW;
  const y = (gap: number) => M.top + (gap / maxGap) * PH;

  const yTicks = $derived.by(() => {
    const steps = [15, 30, 60, 120, 300, 600, 1200, 1800, 3600];
    const step = steps.find((s) => maxGap / s <= 5) ?? 7200;
    const ticks: number[] = [];
    for (let v = 0; v <= maxGap; v += step) ticks.push(v);
    return ticks;
  });

  const fmtTick = (s: number) => {
    if (s === 0) return '0';
    if (s < 60) return `${s}″`;
    if (s % 3600 === 0) return `${s / 3600} h`;
    if (s >= 3600) return `${Math.floor(s / 3600)}h${String(Math.round((s % 3600) / 60)).padStart(2, '0')}`;
    return `${Math.round(s / 60)}′`;
  };

  const path = (pts: { n: number; gap: number }[]) =>
    pts.map((p, i) => `${i ? 'L' : 'M'} ${x(p.n).toFixed(1)} ${y(p.gap).toFixed(1)}`).join(' ');

  const labels = $derived.by(() => {
    const ls = series
      .map((s) => ({ ...s, ty: y(s.last.gap) }))
      .sort((a, b) => a.ty - b.ty);
    const minGap = 15;
    for (let i = 1; i < ls.length; i++) {
      if (ls[i].ty - ls[i - 1].ty < minGap) ls[i].ty = ls[i - 1].ty + minGap;
    }
    const over = ls.length ? ls[ls.length - 1].ty - (H - M.bottom) : 0;
    if (over > 0) for (const l of ls) l.ty -= over;
    return ls;
  });

  const shortName = (bib: number) => {
    const parts = riderName(bib).split(' ');
    return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : parts[0];
  };

  const todayN = $derived.by(() => {
    const n = STAGES.find((s) => s.date === parisToday())?.n ?? null;
    return n != null && !doneNs.includes(n) ? n : null;
  });

  let hoverN = $state<number | null>(null);
  let svgEl = $state<SVGSVGElement>();

  const onMove = (e: MouseEvent | Touch) => {
    if (!svgEl || !doneNs.length) return;
    const rect = svgEl.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = doneNs[0];
    let bd = Infinity;
    for (const n of doneNs) {
      const d = Math.abs(x(n) - px);
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    hoverN = bd < 40 ? best : null;
  };

  const hoverRows = $derived.by(() => {
    if (hoverN == null) return [];
    return series
      .flatMap((s) => {
        const p = s.pts.find((q) => q.n === hoverN);
        return p ? [{ bib: s.bib, gap: p.gap, color: s.rank <= N_COLORED ? COLORS[s.rank - 1] : 'var(--result-loss)' }] : [];
      })
      .sort((a, b) => a.gap - b.gap);
  });

  const hoverStage = $derived(hoverN != null ? STAGES.find((s) => s.n === hoverN) : null);
</script>

{#if doneNs.length}
  <div class="gwrap">
    <svg
      bind:this={svgEl}
      viewBox="0 0 {W} {H}"
      class="gchart"
      role="img"
      aria-label="Écart cumulé au maillot jaune après chaque étape, huit premiers du classement général"
      onmousemove={onMove}
      onmouseleave={() => (hoverN = null)}
      ontouchstart={(e) => onMove(e.touches[0])}
      ontouchmove={(e) => onMove(e.touches[0])}
    >
      {#each STAGES as s}
        {#if s.type === 'montagne'}
          <rect x={x(s.n) - 4} y={M.top} width="8" height={H - M.bottom - M.top} class="mtn-band" />
        {/if}
      {/each}
      {#each yTicks as t}
        <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} class="grid" />
        <text x={M.left - 7} y={y(t)} class="ytick">{t === 0 ? 'tête' : '+' + fmtTick(t)}</text>
      {/each}
      {#each STAGES as s}
        <text x={x(s.n)} y={H - M.bottom + 16} class="xtick" class:done={LIVE.stages[String(s.n)]}>{s.n}</text>
        {#if s.type === 'montagne'}
          <g class="mtn-mark" transform="translate({x(s.n)} {H - M.bottom + 22}) scale(0.36)">
            <path d="m8 3 4 8 5-5 5 15H2L8 3z" transform="translate(-12 -12)" />
          </g>
        {/if}
      {/each}
      <g class="mtn-mark" transform="translate({W - 114} {H - 6.5}) scale(0.36)">
        <path d="m8 3 4 8 5-5 5 15H2L8 3z" transform="translate(-12 -12)" />
      </g>
      <text x={W - 107} y={H - 3} class="xlabel">étape de montagne</text>

      {#if todayN != null}
        <line x1={x(todayN)} x2={x(todayN)} y1={M.top - 4} y2={H - M.bottom} class="today-line" />
        <text x={x(todayN)} y={M.top - 8} class="today-lbl">aujourd'hui</text>
      {/if}

      {#if hoverN != null}
        <line x1={x(hoverN)} x2={x(hoverN)} y1={M.top} y2={H - M.bottom} class="crosshair" />
      {/if}

      {#each [...series].reverse() as s}
        {@const colored = s.rank <= N_COLORED}
        <path
          d={path(s.pts)}
          class="line"
          class:gray={!colored}
          style:stroke={colored ? COLORS[s.rank - 1] : undefined}
        />
        {#if s.pts.length === 1}
          <circle cx={x(s.pts[0].n)} cy={y(s.pts[0].gap)} r="3.5" class="lone" style:fill={colored ? COLORS[s.rank - 1] : 'var(--result-loss)'} />
        {/if}
        {#if hoverN != null}
          {@const p = s.pts.find((q) => q.n === hoverN)}
          {#if p}
            <circle cx={x(p.n)} cy={y(p.gap)} r="3.5" class="hpt" style:fill={colored ? COLORS[s.rank - 1] : 'var(--result-loss)'} />
          {/if}
        {/if}
      {/each}

      {#each labels as l}
        {@const colored = l.rank <= N_COLORED}
        <line x1={x(l.last.n) + 3} x2={W - M.right + 8} y1={y(l.last.gap)} y2={l.ty} class="leader" />
        {#if l.rank === 1}
          <rect x={W - M.right + 10} y={l.ty - 5.5} width="11" height="11" rx="3" class="ylab-chip" />
        {/if}
        <text x={W - M.right + (l.rank === 1 ? 25 : 12)} y={l.ty} class="lbl" style:fill={colored ? COLORS[l.rank - 1] : undefined}>
          {shortName(l.bib)}
          <tspan class="lbl-gap">{l.last.gap === 0 ? '' : fmtGap(l.last.gap)}</tspan>
        </text>
      {/each}
    </svg>

    {#if hoverN != null && hoverStage}
      <div class="htip" style:left="{(x(hoverN) / W) * 100}%" class:flip={x(hoverN) > W * 0.55}>
        <p class="h-cap">Étape {hoverN} · {hoverStage.start} → {hoverStage.end}</p>
        {#each hoverRows as r}
          <p class="h-row">
            <span class="h-dot" style:background={r.color}></span>
            <span class="h-name">{shortName(r.bib)}</span>
            <span class="h-gap">{r.gap === 0 ? 'tête' : fmtGap(r.gap)}</span>
          </p>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .gwrap {
    position: relative;
  }
  .gchart {
    width: 100%;
    height: auto;
    display: block;
    font-family: var(--font);
  }
  .grid {
    stroke: var(--divider);
    stroke-width: 1;
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
    opacity: 0.55;
    font-variant-numeric: tabular-nums;
  }
  .xtick.done {
    opacity: 1;
    font-weight: 600;
  }
  .mtn-band {
    fill: var(--tdf-mont);
    opacity: 0.08;
  }
  .mtn-mark {
    fill: none;
    stroke: var(--tdf-mont);
    stroke-width: 2.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .xlabel {
    fill: var(--text-muted);
    font-size: 10px;
    text-anchor: start;
  }
  .line {
    fill: none;
    stroke-width: 2.2;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .line.gray {
    stroke: var(--result-loss);
    stroke-width: 1.3;
    stroke-opacity: 0.55;
  }
  .leader {
    stroke: var(--border);
    stroke-width: 0.8;
  }
  .lbl {
    font-size: 11px;
    font-weight: 700;
    dominant-baseline: middle;
    fill: var(--text-secondary);
  }
  .lbl-gap {
    font-weight: 500;
    fill: var(--text-muted);
    font-size: 10px;
  }
  .ylab-chip {
    fill: var(--tdf-jaune);
    stroke: var(--border-strong);
    stroke-width: 0.6;
  }
  .today-line {
    stroke: var(--text-muted);
    stroke-width: 1;
    stroke-dasharray: 3 4;
  }
  .today-lbl {
    fill: var(--text-muted);
    font-size: 9.5px;
    text-anchor: middle;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .crosshair {
    stroke: var(--border-strong);
    stroke-width: 1;
  }
  .hpt,
  .lone {
    stroke: var(--bg);
    stroke-width: 1.5;
  }
  .htip {
    position: absolute;
    top: 8px;
    transform: translateX(12px);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 8px 10px;
    box-shadow: 0 8px 24px var(--backdrop);
    font: 400 11px/1.5 var(--font);
    pointer-events: none;
    min-width: 150px;
    z-index: 5;
  }
  .htip.flip {
    transform: translateX(calc(-100% - 12px));
  }
  .h-cap {
    margin: 0 0 4px;
    font-weight: 700;
    font-size: 10.5px;
    color: var(--text-secondary);
  }
  .h-row {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .h-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex: none;
  }
  .h-name {
    color: var(--text);
    font-weight: 600;
    flex: 1;
    white-space: nowrap;
  }
  .h-gap {
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
</style>
