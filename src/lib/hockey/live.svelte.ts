export interface LiveScore {
  status: string;
  hg: number | null;
  ag: number | null;
  hps: number | null;
  aps: number | null;
  period: string | null;
}

let scores = $state<Record<number, LiveScore>>({});

export const liveScore = (id: number): LiveScore | undefined => scores[id];

export const isLiveStatus = (status: string | null | undefined): boolean =>
  !!status && !/official|not started|scheduled|upcoming|cancelled|forfeit|postponed/i.test(status);

export function startLive(workerUrl: string, idsFn: () => number[], intervalMs = 20000): () => void {
  if (!workerUrl) return () => {};
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';

  const tick = async () => {
    if (stopped) return;
    const ids = idsFn();
    if (ids.length && !hidden()) {
      try {
        const res = await fetch(`${workerUrl}?ids=${ids.join(',')}`, { cache: 'no-store' });
        if (res.ok) {
          const arr = (await res.json()) as (LiveScore & { id: number })[];
          const next = { ...scores };
          for (const m of arr) {
            next[m.id] = { status: m.status, hg: m.hg, ag: m.ag, hps: m.hps, aps: m.aps, period: m.period };
          }
          scores = next;
        }
      } catch {
        void 0;
      }
    }
    if (!stopped) timer = setTimeout(tick, intervalMs);
  };

  const onVisible = () => {
    if (!stopped && !hidden()) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(tick, 200);
    }
  };
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);

  timer = setTimeout(tick, 400);
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
  };
}
