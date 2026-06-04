<script lang="ts">
  import { meta, fr } from './data';

  // Bound to the page: ids of the series currently highlighted, + the active key.
  let {
    highlight = $bindable([]),
    activeKey = $bindable(null)
  }: { highlight: string[]; activeKey: string | null } = $props();

  const r = meta.records;

  function choose(key: string, ids: string[]) {
    if (activeKey === key) {
      activeKey = null;
      highlight = [];
    } else {
      activeKey = key;
      highlight = ids;
    }
  }

  const dfmt = (d?: string) =>
    d
      ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';

  // Belgium's score from its own perspective (gf:ga).
  function belScore(m?: { score: string; home: string }): string {
    if (!m) return '';
    const [h, a] = m.score.split('-');
    return m.home === 'Belgium' ? `${h}:${a}` : `${a}:${h}`;
  }

  type Btn = { key: string; value: string; label: string; detail: string; ids: string[] };

  function streak(
    key: string,
    label: string,
    s: { length: number; from?: any; to?: any; ids: string[] }
  ): Btn {
    return {
      key,
      value: String(s.length),
      label,
      detail: `${dfmt(s.from?.date)} (${fr(s.from?.opponent ?? '')}) → ${dfmt(s.to?.date)} (${fr(
        s.to?.opponent ?? ''
      )})`,
      ids: s.ids
    };
  }

  const buttons: Btn[] = [
    {
      key: 'biggestWin',
      value: belScore(r.biggestWin.match),
      label: 'Plus large victoire',
      detail: `${dfmt(r.biggestWin.match?.date)} contre ${fr(r.biggestWin.match?.opponent ?? '')}`,
      ids: r.biggestWin.ids
    },
    {
      key: 'heaviestDefeat',
      value: belScore(r.heaviestDefeat.match),
      label: 'Plus lourde défaite',
      detail: `${dfmt(r.heaviestDefeat.match?.date)} contre ${fr(r.heaviestDefeat.match?.opponent ?? '')}`,
      ids: r.heaviestDefeat.ids
    },
    streak('mostConsecutiveWins', 'Plus de victoires consécutives', r.mostConsecutiveWins),
    streak('mostConsecutiveNoDefeat', 'Plus de matchs sans défaite', r.mostConsecutiveNoDefeat),
    streak('mostConsecutiveDraws', 'Plus de nuls consécutifs', r.mostConsecutiveDraws),
    streak('mostConsecutiveNoDraw', 'Plus de matchs sans nul', r.mostConsecutiveNoDraw),
    streak('mostConsecutiveNoWin', 'Plus de matchs sans victoire', r.mostConsecutiveNoWin),
    streak('mostConsecutiveDefeats', 'Plus de défaites consécutives', r.mostConsecutiveDefeats),
    streak('mostConsecutiveScoring', 'Plus de matchs en marquant', r.mostConsecutiveScoring),
    streak('mostConsecutiveNoScoring', 'Plus de matchs sans marquer', r.mostConsecutiveNoScoring),
    streak('mostConsecutiveConceding', 'Plus de matchs en encaissant', r.mostConsecutiveConceding),
    streak('mostConsecutiveCleanSheets', 'Plus de matchs sans encaisser', r.mostConsecutiveCleanSheets)
  ];
</script>

<div class="records">
  {#each buttons as b (b.key)}
    <button
      class="chip"
      class:on={activeKey === b.key}
      title={b.detail}
      onclick={() => choose(b.key, b.ids)}
    >
      <span class="value">{b.value}</span>
      {b.label}
    </button>
  {/each}
</div>

<style>
  .records {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: flex-start;
    width: 100%;
    font-family: var(--font, system-ui, sans-serif);
  }
  .chip {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    justify-content: center;
    border: 1px solid #cbd5e1;
    background: #fff;
    color: #334155;
    border-radius: 8px;
    padding: 7px 12px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.12s;
    white-space: nowrap;
  }
  .chip:hover {
    border-color: #94a3b8;
  }
  .chip.on {
    background: #e63329;
    border-color: #e63329;
    color: #fff;
  }
  .value {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: #e63329;
  }
  .chip.on .value {
    color: #fff;
  }
</style>
