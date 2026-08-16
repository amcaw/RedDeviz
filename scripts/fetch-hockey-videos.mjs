import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../src/data/hockey-videos.json');
const HOCKEY = resolve(__dirname, '../src/data/hockey.json');
const CHANNEL_ID = 'UCsRwclNMmdK1Kiy2O3eL6hg';
const RSS = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
const VIDEOS_PAGE = 'https://www.youtube.com/@fihockey/videos?hl=en&gl=GB';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36';

const norm = (s) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, "'")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const decode = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

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
    const title = decode(entry.match(/<title>([^<]+)/)?.[1] ?? '');
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
      if (o.videoId && o.title?.runs?.[0]?.text)
        out.set(o.videoId, o.title.runs.map((r) => r.text).join(''));
      for (const k in o) walk(o[k]);
    }
  };
  walk(data);
  return out;
}

const hockey = JSON.parse(readFileSync(HOCKEY, 'utf8'));
const names = new Map();
for (const group of ['men', 'women']) {
  for (const [code, team] of Object.entries(hockey[group].teams)) names.set(norm(team.name), code);
}
names.set('usa', 'USA');
names.set('united states of america', 'USA');
names.set('great britain', 'ENG');

const pairGenders = new Map();
for (const [group, gender] of [['men', 'M'], ['women', 'W']]) {
  for (const match of hockey[group].matches) {
    const pair = [match.home, match.away].sort().join('|');
    if (!pairGenders.has(pair)) pairGenders.set(pair, new Set());
    pairGenders.get(pair).add(gender);
  }
}

function parseVideo(title) {
  const tournament = title.match(/FIH\s+(?:Hockey\s+)?(Men's|Women's)\s+(?:Hockey\s+)?World Cup 2026/i);
  if (!tournament || !/Game\s+\d+\s*:/i.test(title)) return null;
  const gender = /^men/i.test(tournament[1]) ? 'M' : 'W';
  if (!gender) return null;
  const matchup = title.split(/Game\s+\d+\s*:/i)[1]?.split('|')[0]?.trim() ?? '';
  const parts = matchup.split(/\s+v(?:s\.?)?\s+/i);
  if (parts.length !== 2) return null;
  const codes = parts.map((x) => names.get(norm(x)));
  if (!codes[0] || !codes[1] || codes[0] === codes[1]) return null;
  return { gender, pair: codes.sort().join('|'), kind: 'highlights' };
}

const xml = await fetchText(RSS, { 'User-Agent': UA });
const html = await fetchText(VIDEOS_PAGE, {
  'User-Agent': UA,
  'Accept-Language': 'en-GB,en;q=0.9',
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
for (const [id, video] of rss) candidates.set(id, video);
for (const [id, title] of chan) if (!candidates.has(id)) candidates.set(id, { title });

const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
const data = Object.fromEntries(Object.entries(previous).filter(([, video]) => video.source === 'FIH'));
const known = new Set(Object.values(data).map((v) => v.id));
let added = 0;

for (const [id, { title, published }] of candidates) {
  if (known.has(id)) continue;
  const match = parseVideo(title);
  if (!match) {
    if (/fih/i.test(title) && /world cup 2026/i.test(title) && /game\s+\d+/i.test(title))
      console.warn(`  match non résolu: "${title}"`);
    continue;
  }
  const genders = pairGenders.get(match.pair);
  const key = genders?.size > 1 ? `${match.gender}:${match.pair}` : match.pair;
  if (!data[key]) {
    data[key] = { id, title, gender: match.gender, kind: match.kind, source: 'FIH', ...(published ? { published } : {}) };
    known.add(id);
    added++;
    console.log(`  + ${key} -> ${id} (${title})`);
  }
}

writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n');
console.log(`${added} nouvelle(s) vidéo(s); total ${Object.keys(data).length} -> ${OUT}`);
