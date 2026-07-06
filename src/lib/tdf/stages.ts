import raw from '../../data/tdf-stages.json';

export type StageType = 'plat' | 'accidentee' | 'montagne' | 'clm';
export type ClimbCat = 'HC' | '1' | '2' | '3' | '4';

export interface Climb {
  cat: ClimbCat;
  name: string;
  alt: number | null;
  kmToGo: number;
  desgrange: boolean;
}

export interface Sprint {
  name: string;
  kmDone: number;
}

export interface Stage {
  n: number;
  date: string;
  start: string;
  end: string;
  km: number;
  type: StageType;
  clmLabel: string | null;
  alt: boolean;
  profile: string;
  dplus: number;
  altmax: number;
  climbs: Climb[];
  sprint: Sprint | null;
  nCat: Partial<Record<ClimbCat, number>>;
  departLabel: string;
  departTime: string;
  arriveeLabel: string;
  arriveeTime: string;
}

export const CAT_ORDER: ClimbCat[] = ['HC', '1', '2', '3', '4'];
export const CAT_LABEL: Record<ClimbCat, string> = {
  HC: 'Hors catégorie',
  '1': '1re catégorie',
  '2': '2e catégorie',
  '3': '3e catégorie',
  '4': '4e catégorie'
};

export interface RestDay {
  date: string;
  place: string;
}

export const TYPE_LABEL: Record<StageType, string> = {
  plat: 'Plat',
  accidentee: 'Accidentée',
  montagne: 'Montagne',
  clm: 'Contre-la-montre'
};

export const TYPE_COLOR: Record<StageType, string> = {
  plat: 'var(--tdf-plat)',
  accidentee: 'var(--tdf-acc)',
  montagne: 'var(--tdf-mont)',
  clm: 'var(--tdf-clm)'
};

export const TOTAL_KM: number = raw.totalKm;
export const STAGES: Stage[] = raw.stages as Stage[];
export const REST_DAYS: RestDay[] = raw.rests as RestDay[];

export const stageByDate = (iso: string): Stage | undefined => STAGES.find((s) => s.date === iso);

export const fmtKm = (km: number): string =>
  km.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 1 });

export const fmtInt = (n: number): string => Math.round(n).toLocaleString('fr-FR');

export const fmtHm = (t: string): string => t.replace(':', 'h');

export const fmtDate = (iso: string): string =>
  new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
