import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../src/data/wc-videos.json');

const CHANNEL_ID = 'UCLrFHKfx_Fs8vBJBRBeGIKg';
const RSS = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
const VIDEOS_PAGE = `https://www.youtube.com/channel/${CHANNEL_ID}/videos?hl=fr&gl=FR`;

const FR_TO_ESPN = {
  'afrique du sud': 'South Africa',
  algerie: 'Algeria',
  allemagne: 'Germany',
  angleterre: 'England',
  argentine: 'Argentina',
  australie: 'Australia',
  autriche: 'Austria',
  belgique: 'Belgium',
  'bosnie-herzegovine': 'Bosnia-Herzegovina',
  bresil: 'Brazil',
  canada: 'Canada',
  'cap-vert': 'Cape Verde',
  colombie: 'Colombia',
  'cote d’ivoire': 'Ivory Coast',
  "cote d'ivoire": 'Ivory Coast',
  croatie: 'Croatia',
  egypte: 'Egypt',
  equateur: 'Ecuador',
  espagne: 'Spain',
  'etats-unis': 'United States',
  france: 'France',
  ghana: 'Ghana',
  iran: 'Iran',
  japon: 'Japan',
  jordanie: 'Jordan',
  maroc: 'Morocco',
  mexique: 'Mexico',
  norvege: 'Norway',
  'nouvelle-zelande': 'New Zealand',
  paraguay: 'Paraguay',
  'pays-bas': 'Netherlands',
  portugal: 'Portugal',
  'republique democratique du congo': 'Congo DR',
  'rd congo': 'Congo DR',
  senegal: 'Senegal',
  suede: 'Sweden',
  suisse: 'Switzerland',
  tunisie: 'Tunisia'
};

const norm = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, "'")
    .toLowerCase()
    .trim();

async function fetchText(url, headers, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers });
      if (res.ok) return await res.text();
      console.warn(`  HTTP ${res.status} on ${url} (essai ${i + 1}/${tries})`);
    } catch (e) {
      console.warn(`  fetch error "${e.message}" on ${url} (essai ${i + 1}/${tries})`);
    }
    if (i < tries - 1) await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  return null;
}

function parseRss(xml) {
  const out = new Map();
  for (const entry of xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? []) {
    const id = entry.match(/<yt:videoId>([^<]+)/)?.[1];
    const title = entry.match(/<title>([^<]+)/)?.[1] ?? '';
    const published = entry.match(/<published>([^<]+)/)?.[1]?.slice(0, 10);
    if (id) out.set(id, { title, published });
  }
  return out;
}

function parseChannel(html) {
  const out = new Map();
  const m = html.match(/ytInitialData\s*=\s*(\{[\s\S]*?\});<\/script>/);
  if (!m) return out;
  let data;
  try {
    data = JSON.parse(m[1]);
  } catch {
    return out;
  }
  const walk = (o) => {
    if (Array.isArray(o)) {
      for (const x of o) walk(x);
      return;
    }
    if (o && typeof o === 'object') {
      if (o.contentId && o.metadata?.lockupMetadataViewModel?.title?.content)
        out.set(o.contentId, o.metadata.lockupMetadataViewModel.title.content);
      if (o.videoId && o.title?.runs?.[0]?.text) out.set(o.videoId, o.title.runs.map((r) => r.text).join(''));
      for (const k in o) walk(o[k]);
    }
  };
  walk(data);
  return out;
}

function parseTeams(title) {
  if (!/coupe du monde 2026/i.test(title) || !/r[ée]sum[ée]/i.test(title)) return null;
  const after = title.replace(/^[\s\S]*?coupe du monde 2026\s*:\s*/i, '');
  const matchup = after.split(',')[0].replace(/\s+/g, ' ').trim();
  for (const d of matchup.matchAll(/[-–—]/g)) {
    const a = FR_TO_ESPN[norm(matchup.slice(0, d.index))];
    const b = FR_TO_ESPN[norm(matchup.slice(d.index + d[0].length))];
    if (a && b && a !== b) return [a, b].sort();
  }
  return null;
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36';

const xml = await fetchText(RSS, { 'User-Agent': UA });
const html = await fetchText(VIDEOS_PAGE, {
  'User-Agent': UA,
  'Accept-Language': 'fr-FR,fr;q=0.9',
  Cookie: 'SOCS=CAI; CONSENT=YES+'
});

if (!xml && !html) {
  console.error('Aucune source accessible (RSS et page chaîne ont échoué).');
  process.exit(1);
}

const rss = xml ? parseRss(xml) : new Map();
const chan = html ? parseChannel(html) : new Map();
console.log(`RSS: ${rss.size} entrées · page chaîne: ${chan.size} vidéos`);

const candidates = new Map();
for (const [id, v] of rss) candidates.set(id, v);
for (const [id, title] of chan) if (!candidates.has(id)) candidates.set(id, { title });

const data = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
const known = new Set(Object.values(data).map((v) => v.id));
let added = 0;

for (const [id, { title, published }] of candidates) {
  if (known.has(id)) continue;
  const teams = parseTeams(title);
  if (!teams) {
    if (/coupe du monde 2026/i.test(title) && /r[ée]sum[ée]/i.test(title))
      console.warn(`  match non résolu (équipe hors dico ?): "${title}"`);
    continue;
  }
  const key = teams.join('|');
  if (!data[key]) {
    data[key] = { id, title, ...(published ? { published } : {}) };
    known.add(id);
    added++;
    console.log(`  + ${key} -> ${id} (${title})`);
  }
}

writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n');
console.log(`${added} nouvelle(s) vidéo(s); total ${Object.keys(data).length} -> ${OUT}`);
