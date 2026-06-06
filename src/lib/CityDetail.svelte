<script lang="ts">
  import { fr, cityFr, type Match } from './data';

  // cityMatches: matches played in the clicked city.
  // countryMatches: all matches played in that city's host country.
  let {
    city,
    country,
    cityMatches,
    countryMatches,
    onclose
  }: {
    city: string;
    country: string;
    cityMatches: Match[];
    countryMatches: Match[];
    onclose: () => void;
  } = $props();

  function summarise(ms: Match[]) {
    const w = ms.filter((m) => m.result === 'W').length;
    const d = ms.filter((m) => m.result === 'D').length;
    const l = ms.filter((m) => m.result === 'L').length;
    const years = ms.map((m) => m.year).sort((a, b) => a - b);
    const first = years[0];
    const last = years[years.length - 1];
    const range = first === last ? `en ${first}` : `entre ${first} et ${last}`;
    return { total: ms.length, w, d, l, range };
  }

  const countryStats = $derived(summarise(countryMatches));
  const cityStats = $derived(cityMatches.length ? summarise(cityMatches) : null);
</script>

<div class="detail">
  <button class="close" onclick={onclose} aria-label="Fermer">×</button>

  <div class="blocks">
    <section class="block">
      <h3 class="place">{fr(country)}</h3>
      <div class="stat-row">
        <span><strong>{countryStats.total}</strong> match{countryStats.total > 1 ? 's' : ''}</span>
        <span><strong>{countryStats.w}</strong> victoire{countryStats.w > 1 ? 's' : ''}</span>
        <span><strong>{countryStats.d}</strong> nul{countryStats.d > 1 ? 's' : ''}</span>
      </div>
      <p class="range">{countryStats.range}</p>
    </section>

    {#if cityStats && city}
      <section class="block city">
        <h3 class="place">{cityFr(city)}</h3>
        <div class="stat-row">
          <span><strong>{cityStats.total}</strong> match{cityStats.total > 1 ? 's' : ''}</span>
          <span><strong>{cityStats.w}</strong> victoire{cityStats.w > 1 ? 's' : ''}</span>
          <span><strong>{cityStats.d}</strong> nul{cityStats.d > 1 ? 's' : ''}</span>
        </div>
        <p class="range">{cityStats.range}</p>
      </section>
    {/if}
  </div>
</div>

<style>
  .detail {
    position: relative;
    background: var(--surface);
    border: 1px solid var(--border);
    padding: 20px 28px 22px;
    font-family: var(--font, system-ui, sans-serif);
    color: var(--text);
  }
  .close {
    position: absolute;
    top: 12px;
    right: 16px;
    border: none;
    background: none;
    font-size: 26px;
    line-height: 1;
    color: var(--text-muted);
    cursor: pointer;
  }
  .close:hover {
    color: var(--text);
  }
  .blocks {
    display: flex;
    flex-wrap: wrap;
    gap: 20px 48px;
  }
  .block {
    flex: 1 1 220px;
  }
  .place {
    font-size: 16px;
    margin: 0 0 8px;
    color: var(--text);
  }
  .city .place {
    color: var(--accent);
  }
  .stat-row {
    display: flex;
    gap: 22px;
    font-size: 14px;
    color: var(--text-secondary);
  }
  .stat-row strong {
    font-size: 20px;
    color: var(--text);
    font-variant-numeric: tabular-nums;
    margin-right: 3px;
  }
  .range {
    font-size: 12px;
    color: var(--text-muted);
    margin: 8px 0 0;
  }
</style>
