<script lang="ts">
  // `categories` is the active team's filter buckets; `counts` maps each to its
  // dynamic total (given the other active filters); `total` is "Tous les matchs".
  let {
    active = $bindable(null),
    categories = [],
    counts = {},
    total = 0
  }: {
    active: string | null;
    categories?: string[];
    counts?: Record<string, number>;
    total?: number;
  } = $props();
</script>

<div class="filters">
  <button class="chip" class:on={active === null} onclick={() => (active = null)}>
    Tous les matchs <span class="count">({total})</span>
  </button>
  {#each categories as cat (cat)}
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
    flex: 0 1 auto;
    max-width: 100%;
    min-height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    border: 1px solid #cbd5e1;
    background: #fff;
    color: #334155;
    border-radius: 8px;
    padding: 4px 14px;
    font-size: 13px;
    line-height: 1.2;
    cursor: pointer;
    transition: all 0.12s;
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
    /* reserve room for up to 3 digits so the chip width never shifts */
    display: inline-block;
    min-width: 2.9em;
    text-align: left;
    margin-left: 5px; /* inline-flex drops the literal space before it */
  }
  .chip.on .count {
    color: #cbd5e1;
  }
</style>
