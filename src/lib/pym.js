// Central pym.js wrapper (per DESIGN_SYSTEM.md). Lets the widget auto-resize the
// iframe it is embedded in: the pym Child measures its own height and reports it
// to the parent page. Call initPym() once at a component root, then sendHeight()
// after anything that changes the document height (tab/team switch, popups,
// filters, the reveal animation settling).
//
// Outside an iframe (window.self === window.top) pym does nothing useful; the
// layout adds a `standalone` body class for that case so the widget fills the
// viewport instead.
import { onMount } from 'svelte';
// pym.js ships no type declarations; the resolved JS file is untyped.
// @ts-ignore
import pym from 'pym.js';

/** @type {any} */
let pymChild = null;

/** Create the pym Child on mount. Safe to call from any component's root. */
export function initPym() {
  onMount(() => {
    if (typeof window !== 'undefined') {
      pymChild = new pym.Child({ polling: 500 });
      // report once layout has settled
      setTimeout(() => pymChild && pymChild.sendHeight(), 50);
    }
  });
}

/** Report the current height to the parent. Call after height-changing updates. */
export function sendHeight() {
  if (pymChild) {
    // defer a tick so the DOM has reflowed before we measure
    setTimeout(() => pymChild && pymChild.sendHeight(), 50);
  }
}
