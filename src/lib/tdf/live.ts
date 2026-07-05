import rawLive from '../../data/tdf-live.json';
import { STAGES, type Stage } from './stages';

export interface StageTop {
  rank: number;
  bib: number | null;
  name: string;
  team: string | null;
  timeS: number;
  gapS: number;
}

export interface StageResult {
  teamStage: boolean;
  top: StageTop[];
  gc: [number, number][];
  leaderTimeS: number;
  jerseys: {
    jaune: number | null;
    vert: number | null;
    pois: number | null;
    blanc: number | null;
  };
}

export interface Standings {
  gc: [number, number][];
  points: [number, number][];
  kom: [number, number][];
  youth: [number, number][];
  teams: [string, number][];
}

export interface TdfLive {
  updated: string;
  stagesDone: number;
  ridersInRace: number;
  riders: Record<string, [string, string, string]>;
  stages: Record<string, StageResult>;
  standings: Standings | null;
}

export const LIVE = rawLive as unknown as TdfLive;

const PARTICLES = new Set(['van', 'der', 'den', 'de', 'del', 'della', 'di', 'da', 'la', 'le', 'ten', 'ter']);

const caseWord = (w: string, first: boolean): string => {
  const lower = w.toLowerCase();
  if (!first && PARTICLES.has(lower)) return lower;
  return lower
    .split('-')
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
    .join('-');
};

export const properName = (raw: string): string =>
  raw
    .trim()
    .split(/\s+/)
    .map((w, i) => caseWord(w, i === 0))
    .join(' ');

export const riderName = (bib: number | null): string => {
  if (bib == null) return '';
  const r = LIVE.riders[String(bib)];
  return r ? properName(r[0]) : `Dossard ${bib}`;
};

export const riderTeam = (bib: number | null): string => {
  if (bib == null) return '';
  return LIVE.riders[String(bib)]?.[1] ?? '';
};

const ISO3_TO_2: Record<string, string> = {
  fra: 'fr',
  bel: 'be',
  ned: 'nl',
  ger: 'de',
  esp: 'es',
  ita: 'it',
  gbr: 'gb',
  sui: 'ch',
  aut: 'at',
  den: 'dk',
  nor: 'no',
  swe: 'se',
  slo: 'si',
  svk: 'sk',
  pol: 'pl',
  por: 'pt',
  irl: 'ie',
  lux: 'lu',
  cze: 'cz',
  est: 'ee',
  lat: 'lv',
  ltu: 'lt',
  hun: 'hu',
  rou: 'ro',
  cro: 'hr',
  usa: 'us',
  can: 'ca',
  mex: 'mx',
  col: 'co',
  ecu: 'ec',
  arg: 'ar',
  bra: 'br',
  uru: 'uy',
  aus: 'au',
  nzl: 'nz',
  rsa: 'za',
  eri: 'er',
  eth: 'et',
  rwa: 'rw',
  alg: 'dz',
  mar: 'ma',
  tun: 'tn',
  jpn: 'jp',
  kaz: 'kz',
  uae: 'ae',
  isr: 'il',
  tur: 'tr',
  ukr: 'ua',
  fin: 'fi',
  gre: 'gr',
  bul: 'bg',
  srb: 'rs'
};

export const riderFlag = (bib: number | null): string => {
  if (bib == null) return '';
  const iso3 = LIVE.riders[String(bib)]?.[2];
  const iso2 = iso3 ? ISO3_TO_2[iso3] : undefined;
  if (!iso2) return '';
  return [...iso2.toUpperCase()].map((c) => String.fromCodePoint(0x1f1a5 + c.charCodeAt(0))).join('');
};

export const fmtGap = (s: number): string => {
  if (s === 0) return 'm.t.';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `+ ${h} h ${String(m).padStart(2, '0')}′ ${String(sec).padStart(2, '0')}″`;
  if (m) return `+ ${m}′ ${String(sec).padStart(2, '0')}″`;
  return `+ ${sec}″`;
};

export const fmtTime = (s: number): string => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h} h ${String(m).padStart(2, '0')}′ ${String(sec).padStart(2, '0')}″`;
};

export const parisToday = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());

export type StageState = 'done' | 'today' | 'future';

export const stageState = (s: Stage): StageState => {
  if (LIVE.stages[String(s.n)]) return 'done';
  return s.date === parisToday() ? 'today' : 'future';
};

export const kmDone = (): number =>
  STAGES.filter((s) => LIVE.stages[String(s.n)]).reduce((a, s) => a + s.km, 0);

export const lastResult = (): { stage: Stage; result: StageResult } | null => {
  for (let i = STAGES.length - 1; i >= 0; i--) {
    const r = LIVE.stages[String(STAGES[i].n)];
    if (r) return { stage: STAGES[i], result: r };
  }
  return null;
};

export const fmtUpdated = (): string => {
  if (!LIVE.updated) return '';
  const d = new Date(LIVE.updated);
  const day = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' });
  const time = d
    .toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
    .replace(':', ' h ');
  return `${day} à ${time}`;
};

const JERSEY_LABELS: [keyof StageResult['jerseys'], string][] = [
  ['jaune', 'maillot jaune'],
  ['vert', 'maillot vert'],
  ['pois', 'maillot à pois'],
  ['blanc', 'maillot blanc du meilleur jeune']
];

export const stageFacts = (n: number): string[] => {
  const cur = LIVE.stages[String(n)];
  if (!cur) return [];
  let prev: StageResult | null = null;
  for (let k = n - 1; k >= 1; k--) {
    if (LIVE.stages[String(k)]) {
      prev = LIVE.stages[String(k)];
      break;
    }
  }
  const facts: string[] = [];
  if (prev) {
    for (const [key, label] of JERSEY_LABELS) {
      const now = cur.jerseys[key];
      const before = prev.jerseys[key];
      if (now != null && before != null && now !== before) {
        facts.push(`${riderName(now)} s'empare du ${label}, repris à ${riderName(before)}`);
      }
    }
    const g2now = cur.gc[1]?.[1];
    const g2prev = prev.gc[1]?.[1];
    if (g2now != null && g2prev != null && g2now - g2prev >= 25) {
      facts.push(`L'écart au général se creuse : + ${fmtGap(g2now).replace('+ ', '')} désormais sur le 2ᵉ`);
    }
  }
  return facts;
};
