<script lang="ts">
  import { eventTeamCode, type Gender, type Match } from './hockey/data';

  let { match, gender }: { match: Match; gender: Gender } = $props();

  const countGoals = (side: 'home' | 'away', type: string) =>
    (match.scorers ?? []).filter((goal) => eventTeamCode(gender, match, goal.team) === match[side] && goal.type === type).length;
  const countCards = (side: 'home' | 'away') =>
    (match.cards ?? []).filter((card) => eventTeamCode(gender, match, card.team) === match[side]).length;

  const rows = $derived.by(() => {
    const values: { label: string; home: number; away: number; suffix?: string }[] = [];
    if (match.stats?.possession) values.push({ label: 'Possession', home: match.stats.possession[0], away: match.stats.possession[1], suffix: '%' });
    if (match.stats?.shots) values.push({ label: 'Tirs', home: match.stats.shots[0], away: match.stats.shots[1] });
    if (match.stats?.circleEntries) values.push({ label: 'Entrées dans le cercle', home: match.stats.circleEntries[0], away: match.stats.circleEntries[1] });
    if (match.stats?.penaltyCorners) values.push({ label: 'Penalty-corner obtenus', home: match.stats.penaltyCorners[0], away: match.stats.penaltyCorners[1] });
    if (match.scorers?.length) {
      values.push({ label: 'Buts dans le jeu', home: countGoals('home', 'FG'), away: countGoals('away', 'FG') });
      values.push({ label: 'Buts sur penalty-corner', home: countGoals('home', 'PC'), away: countGoals('away', 'PC') });
    }
    if (match.cards?.length) values.push({ label: 'Cartons', home: countCards('home'), away: countCards('away') });
    return values;
  });
</script>

{#if match.stats?.quarters?.length || rows.length}
  <section class="match-stats" aria-label="Statistiques du match">
    <h4>Chiffres du match</h4>
    {#if match.stats?.quarters?.length}
      <div class="quarters">
        <span></span>
        {#each match.stats.quarters as _, i}<span>Q{i + 1}</span>{/each}
        <strong>Score</strong>
        {#each match.stats.quarters as q}<b>{q[0]}–{q[1]}</b>{/each}
      </div>
    {/if}
    {#if rows.length}
      <div class="stat-rows">
        {#each rows as row}
          <div><b>{row.home}{row.suffix ?? ''}</b><span>{row.label}</span><b>{row.away}{row.suffix ?? ''}</b></div>
        {/each}
      </div>
    {/if}
  </section>
{/if}

<style>
  .match-stats {
    margin: 12px 0;
  }
  h4 {
    margin: 0 0 7px;
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .quarters {
    display: grid;
    grid-template-columns: minmax(55px, 1fr) repeat(4, 36px);
    align-items: center;
    padding: 7px 9px;
    border: 1px solid var(--divider);
    border-radius: 7px;
    background: var(--surface-2, rgba(0, 0, 0, 0.03));
    text-align: center;
  }
  .quarters span {
    color: var(--text-muted);
    font-size: 9px;
    font-weight: 700;
  }
  .quarters strong {
    color: var(--text-secondary);
    font-size: 10.5px;
    text-align: left;
  }
  .quarters b {
    color: var(--text);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }
  .stat-rows {
    margin-top: 5px;
  }
  .stat-rows > div {
    display: grid;
    grid-template-columns: 48px 1fr 48px;
    align-items: center;
    min-height: 26px;
    border-bottom: 1px solid var(--divider);
    text-align: center;
  }
  .stat-rows b {
    color: var(--text);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  .stat-rows span {
    color: var(--text-secondary);
    font-size: 10.5px;
  }
</style>
