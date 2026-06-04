<script lang="ts">
  import { CATEGORIES } from './data';
  // `counts` maps each category to its dynamic total (given the other active
  // filters); `total` is the count for "Tous les matchs".
  let {
    active = $bindable(null),
    counts = {},
    total = 0
  }: { active: string | null; counts?: Record<string, number>; total?: number } = $props();
</script>

<div class="filters">
  <button class="chip" class:on={active === null} onclick={() => (active = null)}>
    Tous les matchs <span class="count">({total})</span>
  </button>
  {#each CATEGORIES as cat (cat)}
    <button
      class="chip"
      class:on={active === cat}
      onclick={() => (active = active === cat ? null : cat)}
    >
      {cat} <span class="count">({counts[cat] ?? 0})</span>
    </button>
  {/each}
</div>

<style>
  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: flex-start;
    width: 100%;
    font-family: var(--font, system-ui, sans-serif);
  }
  .chip {
    flex: 0 0 auto;
    text-align: center;
    border: 1px solid #cbd5e1;
    background: #fff;
    color: #334155;
    border-radius: 8px;
    padding: 7px 14px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.12s;
    white-space: nowrap;
  }
  .chip:hover {
    border-color: #94a3b8;
  }
  .chip.on {
    background: #1f2933;
    border-color: #1f2933;
    color: #fff;
  }
  .count {
    color: #94a3b8;
    font-variant-numeric: tabular-nums;
  }
  .chip.on .count {
    color: #cbd5e1;
  }
</style>
