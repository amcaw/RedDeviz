import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../src/data/tdf-live.json');
const STAGES = JSON.parse(readFileSync(resolve(__dirname, '../src/data/tdf-stages.json'), 'utf8')).stages;

const BASE = 'https://www.letour.fr';
const UA = { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' } };
const NO_GATE = process.argv.includes('--no-gate');

const decode = (s) =>
  s
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));

const norm = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

async function fetchText(path) {
  const res = await fetch(path.startsWith('http') ? path : BASE + path, UA);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`);
  return res.text();
}

function parseTable(html) {
  const h = decode(html);
  const table = h.match(/<table[\s\S]*?<\/table>/)?.[0];
  if (!table) return { headers: [], rows: [] };
  const trs = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) =>
    [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) =>
      c[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    )
  );
  if (!trs.length) return { headers: [], rows: [] };
  const headers = trs[0].map(norm);
  const rows = trs
    .slice(1)
    .filter((r) => r.length >= 3)
    .map((r) => Object.fromEntries(headers.map((k, i) => [k, r[i] ?? ''])));
  return { headers, rows };
}

function toSec(str) {
  if (!str) return 0;
  let s = 0;
  for (const m of str.matchAll(/(\d+)\s*(h|''|')/g)) {
    s += Number(m[1]) * (m[2] === 'h' ? 3600 : m[2] === "'" ? 60 : 1);
  }
  return s;
}

const toPts = (str) => Number(str?.match(/(\d+)/)?.[1] ?? 0);
const toBib = (str) => Number(str?.match(/(\d+)/)?.[1] ?? 0) || null;

function rankingUrls(pageHtml) {
  const urls = {};
  for (const m of pageHtml.matchAll(/\/fr\/ajax\/ranking\/(\d+)\/([a-z]+)\/[a-f0-9]+\/(?:subtab|none)/g)) {
    urls[m[2]] = m[0];
  }
  for (const stack of pageHtml.matchAll(/data-ajax-stack\s*=\s*\{([\s\S]*?)\}/g)) {
    try {
      for (const [code, url] of Object.entries(JSON.parse(decode(`{${stack[1]}}`)))) {
        urls[code] = url;
      }
    } catch {
      void 0;
    }
  }
  return urls;
}

function gateOk(pageHtml, stage) {
  if (NO_GATE) return true;
  const text = norm(decode(pageHtml).replace(/<[^>]+>/g, ' '));
  return text.includes(`${norm(stage.start)} > ${norm(stage.end)}`);
}

async function parseStage(n, stage) {
  let page;
  try {
    page = await fetchText(`/fr/classements/etape-${n}`);
  } catch {
    return null;
  }
  if (!gateOk(page, stage)) return null;
  const urls = rankingUrls(page);
  const teamStage = stage.clmLabel === 'CLM par équipes';
  const stageCode = teamStage && urls.ete ? 'ete' : 'ite';
  const need = [stageCode, 'itg', 'ipg', 'img', 'ijg', 'etg'];
  const tables = {};
  for (const code of need) {
    if (!urls[code]) continue;
    tables[code] = parseTable(await fetchText(urls[code]));
  }

  const st = tables[stageCode] ?? { rows: [] };
  const top = st.rows.slice(0, 5).map((r) => ({
    rank: Number(r.rang) || 0,
    bib: toBib(r.dossard),
    name: r.coureur ?? r.equipe ?? '',
    team: r.coureur ? (r.equipe ?? '') : null,
    timeS: toSec(r.temps),
    gapS: toSec(r.ecart)
  }));

  const gcRows = tables.itg?.rows ?? [];
  if (!top.length || !gcRows.length) return null;
  const gc = gcRows.slice(0, 40).map((r) => [toBib(r.dossard), toSec(r.ecart)]);
  const leader = (t) => toBib(t?.rows?.[0]?.dossard) ?? null;

  return {
    data: {
      teamStage,
      top,
      gc,
      leaderTimeS: toSec(gcRows[0]?.temps),
      jerseys: {
        jaune: leader(tables.itg),
        vert: leader(tables.ipg),
        pois: leader(tables.img),
        blanc: leader(tables.ijg)
      }
    },
    tables,
    ridersInRace: gcRows.length
  };
}

async function parseStartlist() {
  const page = decode(await fetchText('/fr/coureurs'));
  const riders = {};
  let team = '';
  const re = /<h3 class="list__heading">.*?>([^<]+)<\/a><\/h3>|<span class="bib">(\d+)<\/span>.*?flag--([a-z]+)".*?runner__link[^>]*>\s*([^<]+?)\s*</gs;
  for (const m of page.matchAll(re)) {
    if (m[1]) team = m[1].trim();
    else riders[m[2]] = [m[4].replace(/\s+/g, ' ').trim(), team, m[3]];
  }
  return riders;
}

const existing = existsSync(OUT)
  ? JSON.parse(readFileSync(OUT, 'utf8'))
  : { stages: {}, standings: null, ridersInRace: 0 };

for (const k of Object.keys(existing.stages)) {
  if (!existing.stages[k].top?.length || !existing.stages[k].gc?.length) {
    delete existing.stages[k];
  }
}

const done = Object.keys(existing.stages).map(Number);
const startN = done.length ? Math.max(...done) : 1;

let last = null;
let fetched = 0;
for (let n = startN; n <= STAGES.length; n++) {
  const stage = STAGES.find((s) => s.n === n);
  let parsed;
  try {
    parsed = await parseStage(n, stage);
  } catch (e) {
    console.warn(`étape ${n}: ${e.message}`);
    break;
  }
  if (!parsed) {
    console.log(`étape ${n}: pas encore de données 2026 (garde millésime)`);
    break;
  }
  existing.stages[n] = parsed.data;
  last = parsed;
  fetched++;
  console.log(`étape ${n}: ok (${parsed.data.top[0]?.name ?? '?'})`);
}

if (last) {
  const pick = (t, val, count) =>
    (t?.rows ?? []).slice(0, count).map((r) => [toBib(r.dossard) ?? r.equipe ?? '', val(r)]);
  existing.standings = {
    gc: pick(last.tables.itg, (r) => toSec(r.ecart), 10),
    points: pick(last.tables.ipg, (r) => toPts(r.points), 6),
    kom: pick(last.tables.img, (r) => toPts(r.points), 6),
    youth: pick(last.tables.ijg, (r) => toSec(r.ecart), 6),
    teams: (last.tables.etg?.rows ?? []).slice(0, 6).map((r) => [r.equipe ?? '', toSec(r.ecart)])
  };
  existing.ridersInRace = last.ridersInRace;
}

try {
  existing.riders = await parseStartlist();
  console.log(`startlist: ${Object.keys(existing.riders).length} coureurs`);
} catch (e) {
  console.warn(`startlist: ${e.message}`);
}

existing.stagesDone = Object.keys(existing.stages).length;
existing.updated = new Date().toISOString();
writeFileSync(OUT, JSON.stringify(existing));
console.log(`${fetched} étape(s) mises à jour; ${existing.stagesDone} au total -> ${OUT}`);
