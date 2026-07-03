<script lang="ts">
  import { STAGES, TOTAL_KM, TYPE_LABEL, TYPE_COLOR, fmtKm, type StageType } from './tdf/stages';
  import { LIVE, riderName, riderTeam, riderFlag, fmtGap, kmDone, lastResult, properName } from './tdf/live';

  const dec1 = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const st = $derived(LIVE.standings);
  const latest = $derived(lastResult());
  const nStarters = $derived(Object.keys(LIVE.riders).length || 184);
  const km = $derived(kmDone());
  const avgSpeed = $derived.by(() => {
    const t = latest?.result.leaderTimeS ?? 0;
    return t > 0 ? (km / t) * 3600 : 0;
  });

  const longest = [...STAGES].sort((a, b) => b.km - a.km).slice(0, 5);
  const maxLong = longest[0].km;
  const altFinishes = STAGES.filter((s) => s.alt);
  const typeCounts = (Object.keys(TYPE_LABEL) as StageType[]).map((t) => ({
    type: t,
    count: STAGES.filter((s) => s.type === t).length
  }));
  const maxType = Math.max(...typeCounts.map((t) => t.count));

  const winners = $derived(
    STAGES.flatMap((s) => {
      const r = LIVE.stages[String(s.n)];
      if (!r?.top?.length) return [];
      const w = r.top[0];
      return [{ s, name: r.teamStage ? properName(w.name) : w.bib ? riderName(w.bib) : properName(w.name), team: r.teamStage }];
    }).reverse()
  );

  const gcMax = $derived(st ? Math.max(60, st.gc[Math.min(4, st.gc.length - 1)]?.[1] ?? 60) : 1);
  const ptsMax = $derived(st?.points[0]?.[1] || 1);
  const komMax = $derived(st?.kom[0]?.[1] || 1);
  const youthMax = $derived(st ? Math.max(60, st.youth[Math.min(4, st.youth.length - 1)]?.[1] ?? 60) : 1);
  const teamsMax = $derived(st ? Math.max(60, st.teams[Math.min(4, st.teams.length - 1)]?.[1] ?? 60) : 1);
  const inverseBar = (gap: number, max: number) => Math.max(6, (1 - gap / (max * 1.18)) * 100);

  function scrollHint(node: HTMLElement) {
    const card = node.closest('.card');
    const update = () => {
      const more = node.scrollHeight - node.scrollTop - node.clientHeight > 2;
      card?.classList.toggle('has-more', more);
    };
    update();
    node.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return {
      destroy() {
        node.removeEventListener('scroll', update);
        ro.disconnect();
      }
    };
  }
</script>

{#snippet row(r: {
  i: string | number;
  name: string;
  sub: string;
  pct: number | null;
  val: string;
  fill: string;
  top?: boolean;
})}
  <li class:nobar={r.pct == null}>
    <span class="rank" class:top={r.top}>{r.i}</span>
    <span class="who">
      <span class="pname">{r.name}</span>
      {#if r.sub}<span class="pteam">{r.sub}</span>{/if}
    </span>
    {#if r.pct != null}
      <span class="bar"><span class="fill" style:background={r.fill} style:width="{r.pct}%"></span></span>
    {/if}
    <span class="val">{r.val}</span>
  </li>
{/snippet}

{#snippet chevron()}
  <div class="card-fade" aria-hidden="true">
    <svg class="chev" viewBox="0 0 24 24" width="16" height="16"
      ><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg
    >
  </div>
{/snippet}

<section class="stats">
  {#if st && latest}
    <p class="scap">Après l'étape {latest.stage.n} · mis à jour depuis les classements officiels</p>
    <div class="kpi-strip">
      <span class="kpi"><b>{latest.stage.n} / 21</b> étapes courues</span>
      <span class="kpi"><b>{fmtKm(km)}</b> km parcourus sur {fmtKm(TOTAL_KM)}</span>
      <span class="kpi"><b>{LIVE.ridersInRace}</b> coureurs en course{nStarters - LIVE.ridersInRace > 0 ? ` · ${nStarters - LIVE.ridersInRace} abandons` : ''}</span>
      {#if avgSpeed > 0}
        <span class="kpi"><b>{dec1(avgSpeed)}</b> km/h de moyenne en jaune</span>
      {/if}
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-head">
          <h3 class="stitle"><span class="jchip jaune"></span>Classement général</h3>
          <p class="ssub">Temps cumulé — écart au maillot jaune</p>
        </div>
        <ol class="card-body board" use:scrollHint>
          {#each st.gc.slice(0, 5) as [bib, gap], i}
            {@render row({ i: i + 1, top: i === 0, name: riderName(bib), sub: `${riderFlag(bib)} ${riderTeam(bib)}`.trim(), pct: inverseBar(gap, gcMax), val: gap === 0 ? 'leader' : fmtGap(gap), fill: 'var(--tdf-gold)' })}
          {/each}
        </ol>
        {@render chevron()}
      </div>

      <div class="card">
        <div class="card-head">
          <h3 class="stitle"><span class="jchip vert"></span>Classement par points</h3>
          <p class="ssub">Sprints et arrivées — maillot vert</p>
        </div>
        <ol class="card-body board" use:scrollHint>
          {#each st.points.slice(0, 5) as [bib, pts], i}
            {@render row({ i: i + 1, top: i === 0, name: riderName(bib), sub: `${riderFlag(bib)} ${riderTeam(bib)}`.trim(), pct: (pts / ptsMax) * 100, val: `${pts} pts`, fill: '#2e9e63' })}
          {/each}
        </ol>
        {@render chevron()}
      </div>

      <div class="card">
        <div class="card-head">
          <h3 class="stitle"><span class="jchip pois"></span>Meilleur grimpeur</h3>
          <p class="ssub">Points au sommet des cols — maillot à pois</p>
        </div>
        <ol class="card-body board" use:scrollHint>
          {#each st.kom.slice(0, 5) as [bib, pts], i}
            {@render row({ i: i + 1, top: i === 0, name: riderName(bib), sub: `${riderFlag(bib)} ${riderTeam(bib)}`.trim(), pct: (pts / komMax) * 100, val: `${pts} pts`, fill: 'var(--accent)' })}
          {/each}
        </ol>
        {@render chevron()}
      </div>

      <div class="card">
        <div class="card-head">
          <h3 class="stitle"><span class="jchip blanc"></span>Meilleur jeune</h3>
          <p class="ssub">Général des coureurs nés après 2000 — maillot blanc</p>
        </div>
        <ol class="card-body board" use:scrollHint>
          {#each st.youth.slice(0, 5) as [bib, gap], i}
            {@render row({ i: i + 1, top: i === 0, name: riderName(bib), sub: `${riderFlag(bib)} ${riderTeam(bib)}`.trim(), pct: inverseBar(gap, youthMax), val: gap === 0 ? 'leader' : fmtGap(gap), fill: 'var(--result-loss)' })}
          {/each}
        </ol>
        {@render chevron()}
      </div>

      <div class="card">
        <div class="card-head">
          <h3 class="stitle">Classement par équipes</h3>
          <p class="ssub">Temps cumulés des trois meilleurs par étape</p>
        </div>
        <ol class="card-body board" use:scrollHint>
          {#each st.teams.slice(0, 5) as [name, gap], i}
            {@render row({ i: i + 1, top: i === 0, name: typeof name === 'string' ? name : String(name), sub: '', pct: inverseBar(gap, teamsMax), val: gap === 0 ? 'leader' : fmtGap(gap), fill: 'var(--accent)' })}
          {/each}
        </ol>
        {@render chevron()}
      </div>

      <div class="card">
        <div class="card-head">
          <h3 class="stitle">Vainqueurs d'étapes</h3>
          <p class="ssub">Du plus récent au plus ancien</p>
        </div>
        <ol class="card-body board" use:scrollHint>
          {#each winners as w}
            {@render row({ i: w.s.n, name: w.name, sub: `${w.s.start} → ${w.s.end}`, pct: null, val: '', fill: '' })}
          {/each}
        </ol>
        {@render chevron()}
      </div>
    </div>
  {:else}
    <p class="scap">Avant le Grand Départ · ce que dit le parcours</p>
    <div class="kpi-strip">
      <span class="kpi"><b>{fmtKm(TOTAL_KM)}</b> km au total</span>
      <span class="kpi"><b>21</b> étapes, 2 journées de repos</span>
      <span class="kpi"><b>54 450</b> m de dénivelé positif</span>
      <span class="kpi"><b>{nStarters}</b> coureurs au départ</span>
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-head">
          <h3 class="stitle">Les plus longues étapes</h3>
          <p class="ssub">Distance en kilomètres</p>
        </div>
        <ol class="card-body board" use:scrollHint>
          {#each longest as s, i}
            {@render row({ i: s.n, top: i === 0, name: `${s.start} → ${s.end}`, sub: TYPE_LABEL[s.type], pct: (s.km / maxLong) * 100, val: `${fmtKm(s.km)} km`, fill: TYPE_COLOR[s.type] })}
          {/each}
        </ol>
        {@render chevron()}
      </div>

      <div class="card">
        <div class="card-head">
          <h3 class="stitle">Les arrivées en altitude</h3>
          <p class="ssub">Étapes qui se concluent en montée</p>
        </div>
        <ol class="card-body board" use:scrollHint>
          {#each altFinishes as s}
            {@render row({ i: s.n, name: s.end, sub: fmtKm(s.km) + ' km · depuis ' + s.start, pct: null, val: '', fill: '' })}
          {/each}
        </ol>
        {@render chevron()}
      </div>

      <div class="card">
        <div class="card-head">
          <h3 class="stitle">La physionomie du parcours</h3>
          <p class="ssub">Nombre d'étapes par type de terrain</p>
        </div>
        <ol class="card-body board" use:scrollHint>
          {#each typeCounts as t}
            {@render row({ i: '', name: TYPE_LABEL[t.type], sub: '', pct: (t.count / maxType) * 100, val: `${t.count} ét.`, fill: TYPE_COLOR[t.type] })}
          {/each}
        </ol>
        {@render chevron()}
      </div>
    </div>
  {/if}
</section>

<style>
  .stats {
    font: 400 13px/1.4 var(--font);
    color: var(--text);
  }
  .scap {
    margin: 0 0 10px;
    color: var(--text-muted);
    font-size: 11px;
  }
  .kpi-strip {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 8px 28px;
    padding: 12px 16px;
    margin-bottom: 14px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
  }
  .kpi {
    color: var(--text-muted);
    font-size: 12.5px;
    white-space: nowrap;
  }
  .kpi b {
    color: var(--text);
    font-weight: 800;
    font-size: 18px;
    margin-right: 5px;
    font-variant-numeric: tabular-nums;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 14px;
  }
  @media (min-width: 620px) {
    .grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  @media (min-width: 1000px) {
    .grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  .card {
    position: relative;
    height: 270px;
    display: flex;
    flex-direction: column;
    padding: 14px 14px 0;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--bg);
    overflow: hidden;
  }
  .card-head {
    flex: none;
    padding-bottom: 8px;
  }
  .stitle {
    margin: 0;
    font-size: 13.5px;
    font-weight: 700;
    letter-spacing: 0.02em;
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .ssub {
    margin: 1px 0 0;
    color: var(--text-muted);
    font-size: 11px;
  }
  .jchip {
    width: 13px;
    height: 13px;
    border-radius: 3.5px;
    display: inline-block;
    flex: none;
    border: 1px solid rgba(0, 0, 0, 0.25);
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
  .card-body {
    flex: 1;
    overflow-y: auto;
    padding-bottom: 12px;
    scrollbar-width: thin;
  }
  .card-fade {
    position: absolute;
    left: 1px;
    right: 1px;
    bottom: 0;
    height: 40px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 5px;
    background: linear-gradient(transparent, var(--bg) 72%);
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  .card:global(.has-more) .card-fade {
    opacity: 1;
  }
  .chev {
    color: var(--text-muted);
    animation: bob 1.5s ease-in-out infinite;
  }
  @keyframes bob {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(3px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .chev {
      animation: none;
    }
  }
  .board {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .board li {
    display: grid;
    grid-template-columns: 20px minmax(0, 1fr) minmax(30px, 22%) auto;
    align-items: center;
    gap: 8px;
    padding: 4px 5px;
    border-radius: 7px;
  }
  .board li.nobar {
    grid-template-columns: 20px minmax(0, 1fr) auto;
  }
  .board li:nth-child(odd) {
    background: var(--surface);
  }
  .rank {
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    text-align: center;
  }
  .rank.top {
    color: var(--accent);
  }
  .who {
    display: flex;
    flex-direction: column;
    min-width: 0;
    line-height: 1.15;
  }
  .pname {
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pteam {
    color: var(--text-muted);
    font-size: 10.5px;
    letter-spacing: 0.02em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .bar {
    height: 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--text) 12%, transparent);
    overflow: hidden;
  }
  .fill {
    display: block;
    height: 100%;
    border-radius: 999px;
  }
  .val {
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    justify-self: end;
    white-space: nowrap;
    font-size: 12px;
  }
</style>
