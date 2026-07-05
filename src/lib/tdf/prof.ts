export interface Climb {
  fromKm: number;
  toKm: number;
  gain: number;
  pct: number;
}

export interface ProfileFacts {
  startAlt: number;
  endAlt: number;
  bestClimb: Climb | null;
  finalKm: number;
  finalPct: number;
}

export function analyzeProfile(prof: number[], km: number): ProfileFacts {
  const n = prof.length;
  const kmAt = (i: number) => (i / (n - 1)) * km;

  const climbs: Climb[] = [];
  let start = 0;
  let peak = 0;
  let climbing = false;
  for (let i = 1; i < n; i++) {
    const d = prof[i] - prof[i - 1];
    if (d > 0) {
      if (!climbing) {
        climbing = true;
        start = i - 1;
        peak = i;
      } else if (prof[i] >= prof[peak]) {
        peak = i;
      }
    } else if (climbing && prof[i] < prof[peak] - 30) {
      climbs.push(makeClimb(prof, start, peak, kmAt));
      climbing = false;
    } else if (climbing && prof[i] >= prof[peak]) {
      peak = i;
    }
  }
  if (climbing) climbs.push(makeClimb(prof, start, peak, kmAt));

  const real = climbs.filter((c) => c.gain >= 150 && c.toKm > c.fromKm);
  const bestClimb = real.length ? real.reduce((a, b) => (b.gain > a.gain ? b : a)) : null;

  const finalKm = Math.min(3, km);
  const fi = Math.max(0, n - 1 - Math.round((finalKm / km) * (n - 1)));
  const finalPct = ((prof[n - 1] - prof[fi]) / (finalKm * 1000)) * 100;

  return {
    startAlt: prof[0],
    endAlt: prof[n - 1],
    bestClimb,
    finalKm,
    finalPct
  };
}

function makeClimb(prof: number[], start: number, peak: number, kmAt: (i: number) => number): Climb {
  const fromKm = kmAt(start);
  const toKm = kmAt(peak);
  const gain = prof[peak] - prof[start];
  const dist = Math.max(0.1, toKm - fromKm);
  return {
    fromKm,
    toKm,
    gain,
    pct: gain / (dist * 10)
  };
}
