<script lang="ts">
  import type { WcStats } from './wc/stats';

  let { stats }: { stats: WcStats } = $props();

  const dec = (n: number, d = 2) => n.toFixed(d).replace('.', ',');
  const maxGoals = $derived(stats.scorers[0]?.goals || 1);
  const maxAtk = $derived(stats.attacks[0]?.goalsFor || 1);
  const maxConv = $derived(stats.conversion[0]?.pct || 1);
  const maxDisc = $derived(stats.discipline[0]?.total || 1);

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

{#snippet lbRow(r: {
  i: number;
  logo: string;
  name: string;
  sub: string;
  pct: number;
  val: string | number;
  unit: string;
  fill: string;
})}
  <li>
    <span class="rank" class:top={r.i === 0}>{r.i + 1}</span>
    <span class="flag"><img src={r.logo} alt="" /></span>
    <span class="who">
      <span class="pname">{r.name}</span>
      <span class="pteam">{r.sub}</span>
    </span>
    <span class="bar"><span class="fill {r.fill}" style:width="{r.pct}%"></span></span>
    <span class="val">{r.val}<span class="unit">{r.unit}</span></span>
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
  <p class="scap">Depuis le début de la compétition · {stats.matchesPlayed} matchs joués</p>
  <div class="kpi-strip">
    <span class="kpi"><b>{stats.totalGoals}</b> buts marqués</span>
    <span class="kpi"><b>{dec(stats.goalsPerMatch)}</b> buts / match</span>
    <span class="kpi"><b>{stats.shootouts}</b> séances de t.a.b.</span>
    <span class="kpi"><b>{stats.redCards}</b> cartons rouges</span>
  </div>

  <div class="grid">
    <div class="card">
      <div class="card-head">
        <h3 class="stitle">Meilleurs buteurs</h3>
        <p class="ssub">Buts marqués (penalties compris)</p>
      </div>
      <ol class="card-body board" use:scrollHint>
        {#each stats.scorers as s, i}
          {@render lbRow({ i, logo: s.logo, name: s.name, sub: s.teamAbbr + (s.pens ? ` · ${s.pens} pén.` : ''), pct: (s.goals / maxGoals) * 100, val: s.goals, unit: 'buts', fill: '' })}
        {/each}
      </ol>
      {@render chevron()}
    </div>

    <div class="card">
      <div class="card-head">
        <h3 class="stitle">Meilleures attaques</h3>
        <p class="ssub">Total de buts marqués par l'équipe</p>
      </div>
      <ol class="card-body board" use:scrollHint>
        {#each stats.attacks as t, i}
          {@render lbRow({ i, logo: t.logo, name: t.team, sub: `${t.played} match${t.played > 1 ? 's' : ''}`, pct: (t.goalsFor / maxAtk) * 100, val: t.goalsFor, unit: 'buts', fill: '' })}
        {/each}
      </ol>
      {@render chevron()}
    </div>

    <div class="card">
      <div class="card-head">
        <h3 class="stitle">Meilleures défenses</h3>
        <p class="ssub">Buts encaissés par match (moins = mieux)</p>
      </div>
      <ol class="card-body board" use:scrollHint>
        {#each stats.defenses as t, i}
          {@render lbRow({ i, logo: t.logo, name: t.team, sub: `${t.against} encaissé${t.against > 1 ? 's' : ''} · ${t.played} m`, pct: (1 - t.perMatch / (stats.worstDefense || 1)) * 100, val: dec(t.perMatch), unit: '/ m', fill: 'def' })}
        {/each}
      </ol>
      {@render chevron()}
    </div>

    <div class="card">
      <div class="card-head">
        <h3 class="stitle">Efficacité offensive</h3>
        <p class="ssub">Part des tirs convertis en but</p>
      </div>
      <ol class="card-body board" use:scrollHint>
        {#each stats.conversion as t, i}
          {@render lbRow({ i, logo: t.logo, name: t.team, sub: `${t.goals} buts · ${t.shots} tirs`, pct: (t.pct / maxConv) * 100, val: Math.round(t.pct), unit: '%', fill: '' })}
        {/each}
      </ol>
      {@render chevron()}
    </div>

    <div class="card">
      <div class="card-head">
        <h3 class="stitle">Équipes les plus averties</h3>
        <p class="ssub">Cartons reçus (jaunes + rouges)</p>
      </div>
      <ol class="card-body board" use:scrollHint>
        {#each stats.discipline as t, i}
          {@render lbRow({ i, logo: t.logo, name: t.team, sub: `${t.yellow} J · ${t.red} R`, pct: (t.total / maxDisc) * 100, val: t.total, unit: 'cart.', fill: 'card' })}
        {/each}
      </ol>
      {@render chevron()}
    </div>

    <div class="card">
      <div class="card-head">
        <h3 class="stitle">Plus gros scores</h3>
        <p class="ssub">Matchs aux plus grands écarts</p>
      </div>
      <ol class="card-body board scores" use:scrollHint>
        {#each stats.bigScores as m, i}
          <li>
            <span class="rank" class:top={i === 0}>{i + 1}</span>
            <span class="bs">
              <span class="bs-side"><span class="flag sm"><img src={m.wLogo} alt="" /></span>{m.wAbbr}</span>
              <span class="bs-score">{m.ws}<span class="dash">–</span>{m.ls}</span>
              <span class="bs-side"><span class="flag sm"><img src={m.lLogo} alt="" /></span>{m.lAbbr}</span>
            </span>
            <span class="bs-phase">{m.phase}</span>
          </li>
        {/each}
      </ol>
      {@render chevron()}
    </div>
  </div>
</section>

<style>
  .stats {
    font: 400 13px/1.4 var(--font);
    color: var(--text);
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
  }
  .ssub {
    margin: 1px 0 0;
    color: var(--text-muted);
    font-size: 11px;
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
    grid-template-columns: 15px 22px minmax(0, 1fr) minmax(34px, 24%) auto;
    align-items: center;
    gap: 8px;
    padding: 4px 5px;
    border-radius: 7px;
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
  .flag {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    overflow: hidden;
    display: inline-block;
    flex: none;
  }
  .flag.sm {
    width: 18px;
    height: 18px;
  }
  .flag img {
    width: 180%;
    height: 180%;
    margin: -40%;
    object-fit: cover;
    display: block;
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
    background: var(--accent);
  }
  .fill.def {
    background: var(--result-win);
  }
  .fill.card {
    background: #f5c518;
  }
  .val {
    display: flex;
    align-items: baseline;
    gap: 3px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    justify-content: flex-end;
    white-space: nowrap;
  }
  .unit {
    color: var(--text-muted);
    font-weight: 600;
    font-size: 10px;
  }

  .scores li {
    grid-template-columns: 15px minmax(0, 1fr) auto;
  }
  .bs {
    display: flex;
    align-items: center;
    gap: 7px;
    font-weight: 700;
    min-width: 0;
  }
  .bs-side {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .bs-score {
    font-variant-numeric: tabular-nums;
    font-weight: 800;
  }
  .bs-score .dash {
    margin: 0 1px;
    color: var(--text-muted);
  }
  .bs-phase {
    color: var(--text-muted);
    font-size: 10.5px;
    text-align: right;
    white-space: nowrap;
  }
</style>
