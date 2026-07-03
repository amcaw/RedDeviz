<script lang="ts">
  import { onMount } from 'svelte';
  import { STAGES, REST_DAYS, TOTAL_KM, TYPE_LABEL, TYPE_COLOR, fmtKm, fmtDate, type Stage } from './tdf/stages';
  import { LIVE, stageState, riderName, riderTeam, riderFlag, fmtGap, fmtTime, properName, lastResult, type StageResult, type StageState } from './tdf/live';

  const R = 288;
  const W = 34;
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
  const todaySeg = $derived(geometry.segs.find((g) => g.state === 'today') ?? null);
  const latest = $derived(lastResult());

  let mounted = $state(false);
  onMount(() => {
    requestAnimationFrame(() => (mounted = true));
  });

  interface Tip {
    seg: Seg;
    lx: number;
    ly: number;
    ox: boolean;
    oy: boolean;
  }
  let tip = $state<Tip | null>(null);
  let tipEl = $state<HTMLDivElement>();
  let placed = $state(false);
  let isMobile = $state(false);

  const showTip = (g: Seg) => {
    placed = false;
    const [x, y] = P(g.mid, R);
    tip = {
      seg: g,
      lx: ((x + 360) / 720) * 100,
      ly: ((y + 360) / 720) * 100,
      ox: x > 0,
      oy: y > 0
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

  let wrapW = $state(720);
  const cScale = $derived(Math.min(1, wrapW / 720));

  const JERSEYS: { key: 'jaune' | 'vert' | 'pois' | 'blanc'; label: string }[] = [
    { key: 'jaune', label: 'Général' },
    { key: 'vert', label: 'Points' },
    { key: 'pois', label: 'Montagne' },
    { key: 'blanc', label: 'Jeune' }
  ];

  const deg = (a: number) => (a * 180) / Math.PI;
  const stageAria = (g: Seg) =>
    `Étape ${g.s.n}, ${g.s.start} vers ${g.s.end}, ${g.s.clmLabel ?? TYPE_LABEL[g.s.type]}, ${fmtKm(g.s.km)} kilomètres, ${fmtDate(g.s.date)}`;
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && hideTip()} />

<div class="wrap" bind:clientWidth={wrapW}>
  <svg viewBox="-360 -360 720 720" class="loop" role="img" aria-label="La Grande Boucle 2026, les 21 étapes du Tour de France">
    <circle cx="0" cy="0" r={R} class="base" />

    {#if todaySeg}
      <path d={arc(todaySeg.a0, todaySeg.a1, R)} class="halo" style:stroke={todaySeg.color} stroke-width={W + 14} />
    {/if}

    <g class="segs">
      {#each geometry.segs as g, i}
        <g
          class="seg"
          class:in={mounted}
          style:transition-delay="{i * 32}ms"
          role="button"
          tabindex="0"
          aria-label={stageAria(g)}
          onmouseenter={() => {
            if (!isMobile) showTip(g);
          }}
          onmouseleave={() => {
            if (!isMobile) hideTip();
          }}
          onfocus={() => {
            if (!isMobile) showTip(g);
          }}
          onblur={() => {
            if (!isMobile) hideTip();
          }}
          onclick={() => {
            if (isMobile) showTip(g);
          }}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              showTip(g);
            }
          }}
        >
          <path
            d={arc(g.a0, g.a1, R)}
            class="stage"
            class:future={g.state === 'future'}
            style:stroke={g.color}
            stroke-width={W}
          />
          {#if g.s.type === 'clm'}
            <path d={arc(g.a0 + 0.012, g.a1 - 0.012, R)} class="hatch" class:future={g.state === 'future'} stroke-width={W - 8} />
          {/if}
          {#if g.s.alt}
            <g transform="translate({P(g.a1 - 0.028, R)[0]} {P(g.a1 - 0.028, R)[1]}) rotate({deg(g.a1 - 0.028)})">
              <path d="M 0 -4.5 L 4.5 3.5 L -4.5 3.5 Z" class="alt-mark" class:future={g.state === 'future'} />
            </g>
          {/if}
          <text x={P(g.mid, R - W / 2 - 15)[0]} y={P(g.mid, R - W / 2 - 15)[1]} class="num" class:today={g.state === 'today'}>{g.s.n}</text>
          <path d={arc(g.a0, g.a1, R)} class="hit" stroke-width={W + 16} />
        </g>
      {/each}
    </g>

    {#each geometry.rests as r}
      <g class="rest" class:in={mounted}>
        <circle cx={P(r.a, R)[0]} cy={P(r.a, R)[1]} r="5.5" class="rest-dot">
          <title>Repos — {fmtDate(r.date)} ({r.place})</title>
        </circle>
      </g>
    {/each}

    <g class="yellow" class:in={mounted}>
      {#if lastDone}
        <path d={arc(SEAM / 2, lastDone.a1, R + W / 2 + 11)} class="yline" />
        <circle cx={P(lastDone.a1, R + W / 2 + 11)[0]} cy={P(lastDone.a1, R + W / 2 + 11)[1]} r="6" class="ydot" />
      {:else}
        <circle cx={P(SEAM / 2, R + W / 2 + 11)[0]} cy={P(SEAM / 2, R + W / 2 + 11)[1]} r="6" class="ydot" />
      {/if}
    </g>

    <g class="seam-labels" class:in={mounted}>
      <text x={P(SEAM / 2, R)[0] + 12} y={P(SEAM / 2, R)[1] - 20} text-anchor="start">
        <tspan class="seam-top">Grand Départ · 4 juil.</tspan>
        <tspan class="seam-city" x={P(SEAM / 2, R)[0] + 12} dy="13">Barcelone</tspan>
      </text>
      <text x={P(-SEAM / 2, R)[0] - 12} y={P(-SEAM / 2, R)[1] - 20} text-anchor="end">
        <tspan class="seam-top">Arrivée · 26 juil.</tspan>
        <tspan class="seam-city" x={P(-SEAM / 2, R)[0] - 12} dy="13">Paris</tspan>
      </text>
    </g>
  </svg>

  <div class="center" style:font-size="{Math.max(9, 13.5 * cScale)}px">
    {#if latest}
      {@const jaune = latest.result.jerseys.jaune}
      {@const second = latest.result.gc[1]}
      <p class="c-eyebrow">Après l'étape {latest.stage.n} · {fmtDate(latest.stage.date)}</p>
      <p class="c-leader"><span class="jchip jaune big"></span>{riderName(jaune)}</p>
      <p class="c-sub">{riderFlag(jaune)} {riderTeam(jaune)}</p>
      {#if second}
        <p class="c-gap">{fmtGap(second[1])} sur {riderName(second[0])}</p>
      {/if}
      {#if todaySeg}
        <p class="c-next">Aujourd'hui · Ét. {todaySeg.s.n} : {todaySeg.s.start} → {todaySeg.s.end}</p>
      {:else}
        {@const next = geometry.segs.find((g) => g.state === 'future')}
        {#if next}
          <p class="c-next">À suivre · Ét. {next.s.n} : {next.s.start} → {next.s.end}</p>
        {/if}
      {/if}
    {:else if todaySeg}
      <p class="c-eyebrow">Aujourd'hui</p>
      <p class="c-big">Étape {todaySeg.s.n}</p>
      <p class="c-city">{todaySeg.s.start} → {todaySeg.s.end}</p>
      <p class="c-facts">{fmtKm(todaySeg.s.km)} km · {todaySeg.s.clmLabel ?? TYPE_LABEL[todaySeg.s.type]}</p>
      <p class="c-live"><span class="live-dot"></span>en attente des résultats</p>
    {:else}
      <p class="c-eyebrow">Grand Départ</p>
      <p class="c-big">Barcelone</p>
      <p class="c-city">samedi 4 juillet</p>
      <p class="c-facts">{fmtKm(TOTAL_KM)} km · 21 étapes</p>
      <p class="c-facts muted">{Object.keys(LIVE.riders).length || 184} partants · arrivée à Paris le 26 juillet</p>
    {/if}
  </div>

  {#if tip && isMobile}
    <button class="tip-backdrop" aria-label="Fermer" onclick={hideTip}></button>
  {/if}
  {#if tip}
    {@const g = tip.seg}
    {@const s = g.s}
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
            ><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none" /></svg
          >
        </button>
      {/if}
      <div class="tip-cap">
        <div class="cap-meta">
          <span class="type-dot" style:background={g.color}></span>
          <span class="cap-round">Étape {s.n} · {s.clmLabel ?? TYPE_LABEL[s.type]}</span>
          <span class="cap-dot">·</span>{fmtDate(s.date)}
        </div>
        <div class="cap-venue">{s.start} → {s.end}</div>
        <div class="cap-sub">{fmtKm(s.km)} km{s.alt ? ' · arrivée en altitude' : ''}</div>
      </div>
      <div class="tip-profile">
        <img src={s.profile} alt="Profil officiel de l'étape {s.n}" loading="lazy" />
      </div>
      {#if g.state === 'today' && !g.result}
        <p class="tip-live"><span class="live-dot"></span>En course aujourd'hui</p>
      {/if}
      {#if g.result?.top.length}
        <ol class="tip-top">
          {#each g.result.top as t}
            <li class:win={t.rank === 1}>
              <span class="t-rank">{t.rank}</span>
              <span class="t-name"
                >{g.result.teamStage ? properName(t.name) : t.bib ? riderName(t.bib) : properName(t.name)}</span
              >
              <span class="t-time">{t.rank === 1 ? fmtTime(t.timeS) : fmtGap(t.gapS)}</span>
            </li>
          {/each}
        </ol>
        <div class="tip-jerseys">
          {#each JERSEYS as j}
            {@const bib = g.result.jerseys[j.key]}
            {#if bib != null}
              <span class="jline"><span class="jchip {j.key}"></span><span class="j-name">{riderName(bib)}</span><span class="j-role">{j.label}</span></span>
            {/if}
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<div class="legend">
  {#each Object.entries(TYPE_LABEL) as [key, label]}
    <span class="lg-item"><span class="lg-swatch" style:background={TYPE_COLOR[key as keyof typeof TYPE_COLOR]} class:hatched={key === 'clm'}></span>{label}</span>
  {/each}
  <span class="lg-item"><span class="lg-alt">▲</span>Arrivée en altitude</span>
  <span class="lg-item"><span class="lg-yellow"></span>Progression du maillot jaune</span>
</div>

<style>
  .wrap {
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
  }
  .stage.future {
    stroke-opacity: 0.22;
  }
  .seg:hover .stage.future,
  .seg:focus-visible .stage.future {
    stroke-opacity: 0.45;
  }
  .seg:hover .stage:not(.future),
  .seg:focus-visible .stage:not(.future) {
    stroke-opacity: 0.85;
  }
  .hatch {
    fill: none;
    stroke: var(--bg);
    stroke-dasharray: 2.5 8;
  }
  .hatch.future {
    stroke-opacity: 0.5;
  }
  .alt-mark {
    fill: var(--bg);
  }
  .alt-mark.future {
    fill-opacity: 0.5;
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
  .halo {
    fill: none;
    stroke-opacity: 0.28;
    animation: haloPulse 1.6s ease-in-out infinite;
  }
  @keyframes haloPulse {
    0%,
    100% {
      stroke-opacity: 0.16;
    }
    50% {
      stroke-opacity: 0.34;
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
  .rest-dot {
    fill: var(--surface);
    stroke: var(--border-strong);
    stroke-width: 1.5;
  }
  .yellow {
    opacity: 0;
    transition: opacity 0.6s ease 0.9s;
  }
  .yellow.in {
    opacity: 1;
  }
  .yline {
    fill: none;
    stroke: var(--tdf-jaune, #ffd60a);
    stroke-width: 5;
    stroke-linecap: round;
  }
  .ydot {
    fill: var(--tdf-jaune, #ffd60a);
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

  .center {
    position: absolute;
    inset: 24%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 0.25em;
    pointer-events: none;
    color: var(--text);
  }
  .center p {
    margin: 0;
  }
  .c-eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.14em;
    font-size: 0.78em;
    font-weight: 700;
    color: var(--text-muted);
  }
  .c-big {
    font-size: 2em;
    font-weight: 800;
    line-height: 1.1;
  }
  .c-leader {
    font-size: 1.45em;
    font-weight: 800;
    display: flex;
    align-items: center;
    gap: 0.4em;
    line-height: 1.15;
  }
  .c-city {
    font-size: 1.1em;
    font-weight: 600;
    color: var(--text-secondary);
  }
  .c-sub {
    font-size: 0.85em;
    color: var(--text-muted);
  }
  .c-gap {
    font-size: 0.95em;
    font-weight: 600;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
  }
  .c-facts {
    font-size: 0.95em;
    color: var(--text-secondary);
    font-weight: 600;
  }
  .c-facts.muted {
    color: var(--text-muted);
    font-weight: 400;
    font-size: 0.85em;
  }
  .c-next {
    margin-top: 0.5em;
    font-size: 0.82em;
    color: var(--text-muted);
    border-top: 1px solid var(--divider);
    padding-top: 0.7em;
  }
  .c-live,
  .tip-live {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85em;
    font-weight: 600;
    color: var(--text-secondary);
  }
  .tip-live {
    font-size: 11.5px;
    margin: 8px 0 0;
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
  .jchip.big {
    width: 0.85em;
    height: 0.85em;
  }
  .jchip.jaune {
    background: #ffd60a;
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

  .tip {
    position: absolute;
    z-index: 20;
    width: min(290px, 82%);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 10px 12px 12px;
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
    padding-bottom: 8px;
    margin-bottom: 9px;
    border-bottom: 1px solid var(--border);
  }
  .cap-meta {
    color: var(--text-muted);
    font-size: 10.5px;
    line-height: 1.4;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
  }
  .type-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 5px;
    flex: none;
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
    font-size: 13.5px;
    margin-top: 3px;
  }
  .cap-sub {
    color: var(--text-muted);
    font-size: 10.5px;
    margin-top: 1px;
  }
  .tip-profile {
    background: #fff;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--border);
  }
  .tip-profile img {
    display: block;
    width: 100%;
    height: auto;
  }
  .tip-top {
    list-style: none;
    margin: 9px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .tip-top li {
    display: grid;
    grid-template-columns: 16px minmax(0, 1fr) auto;
    gap: 7px;
    align-items: baseline;
    padding: 2.5px 6px;
    margin: 0 -6px;
    border-radius: 6px;
  }
  .tip-top li:nth-child(odd) {
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
  .tip-jerseys {
    margin-top: 9px;
    padding-top: 8px;
    border-top: 1px solid var(--divider);
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 5px 10px;
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

  .legend {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px 16px;
    margin-top: 10px;
    font: 400 11.5px var(--font);
    color: var(--text-secondary);
  }
  .lg-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .lg-swatch {
    width: 14px;
    height: 9px;
    border-radius: 3px;
    display: inline-block;
  }
  .lg-swatch.hatched {
    background-image: repeating-linear-gradient(90deg, transparent 0 2px, var(--bg) 2px 4px);
  }
  .lg-alt {
    font-size: 10px;
    color: var(--text-muted);
  }
  .lg-yellow {
    width: 16px;
    height: 4px;
    border-radius: 999px;
    background: var(--tdf-jaune, #ffd60a);
    display: inline-block;
  }
</style>
