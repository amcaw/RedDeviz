import { STAGES, type Stage, type StageType } from './stages';
import { LIVE } from './live';

export const doneNs: number[] = STAGES.map((s) => s.n).filter(
  (n) => LIVE.stages[String(n)]?.gc?.length
);

export const lastN: number = doneNs.length ? doneNs[doneNs.length - 1] : 0;

export const isComplete: boolean = doneNs.length === STAGES.length;

export const gapAt = (bib: number, n: number): number | null => {
  const gc = LIVE.stages[String(n)]?.gc;
  if (!gc) return null;
  const row = gc.find((r) => r[0] === bib);
  return row ? row[1] : null;
};

export const stageByN = (n: number): Stage | undefined => STAGES.find((s) => s.n === n);

export const finalGc: [number, number][] = LIVE.standings?.gc ?? [];

export const finishers: number = lastN ? (LIVE.stages[String(lastN)]?.gc?.length ?? 0) : 0;

export const winnerBib: number | null = finalGc[0]?.[0] ?? null;
export const runnerBib: number | null = finalGc[1]?.[0] ?? null;

export interface Traj {
  bib: number;
  rank: number;
  finalGap: number;
  pts: { n: number; gap: number }[];
}

export const topTraj = (count: number): Traj[] =>
  finalGc.slice(0, count).map(([bib, finalGap], i) => ({
    bib,
    rank: i + 1,
    finalGap,
    pts: doneNs.flatMap((n) => {
      const g = gapAt(bib, n);
      return g == null ? [] : [{ n, gap: g }];
    })
  }));

export interface CumStage {
  n: number;
  stage: Stage;
  cumKm: number;
  midKm: number;
  frontGap: number;
}

export const cumStages: CumStage[] = (() => {
  let cum = 0;
  return doneNs.map((n) => {
    const stage = stageByN(n)!;
    const start = cum;
    cum += stage.km;
    const gc = LIVE.stages[String(n)].gc;
    return {
      n,
      stage,
      cumKm: cum,
      midKm: start + stage.km / 2,
      frontGap: gc[1]?.[1] ?? 0
    };
  });
})();

export const totalKmDone: number = cumStages.length ? cumStages[cumStages.length - 1].cumKm : 0;

export interface MarginStep {
  n: number;
  stage: Stage;
  margin: number;
  delta: number;
}

export const marginWaterfall = (): MarginStep[] => {
  if (winnerBib == null || runnerBib == null) return [];
  let prev = 0;
  return doneNs.map((n) => {
    const gw = gapAt(winnerBib, n) ?? 0;
    const gr = gapAt(runnerBib, n) ?? 0;
    const margin = gr - gw;
    const delta = margin - prev;
    prev = margin;
    return { n, stage: stageByN(n)!, margin, delta };
  });
};

export const TYPE_SHORT: Record<StageType, string> = {
  plat: 'Plat',
  accidentee: 'Vallonnée',
  montagne: 'Montagne',
  clm: 'Contre-la-montre'
};

export const fmtMin = (s: number): string => {
  const a = Math.abs(Math.round(s));
  const m = Math.floor(a / 60);
  const sec = a % 60;
  const body = m ? `${m}′${String(sec).padStart(2, '0')}″` : `${sec}″`;
  return (s < 0 ? '−' : '') + body;
};

export const fmtSigned = (s: number): string => {
  const r = Math.round(s);
  if (r === 0) return '=';
  return (r > 0 ? '+' : '−') + fmtMin(Math.abs(r));
};
