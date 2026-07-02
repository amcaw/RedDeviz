import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../src/data/wc-videos.json');

const CHANNEL_ID = 'UCLrFHKfx_Fs8vBJBRBeGIKg';
const FEED = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

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
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, "'")
    .toLowerCase()
    .trim();

const res = await fetch(FEED, { headers: { 'User-Agent': 'Mozilla/5.0' } });
if (!res.ok) {
  console.error(`RSS HTTP ${res.status}`);
  process.exit(1);
}
const xml = await res.text();

const existing = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
let added = 0;

for (const entry of xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? []) {
  const id = entry.match(/<yt:videoId>([^<]+)/)?.[1];
  const title = entry.match(/<title>([^<]+)/)?.[1] ?? '';
  const published = entry.match(/<published>([^<]+)/)?.[1]?.slice(0, 10) ?? '';
  if (!id) continue;

  const m = title.match(/coupe du monde 2026\s*:\s*(.+?)\s+[-–]\s+([^,]+)/i);
  if (!m || !/r[ée]sum[ée]/i.test(title)) continue;
  const a = FR_TO_ESPN[norm(m[1])];
  const b = FR_TO_ESPN[norm(m[2])];
  if (!a || !b) {
    console.warn(`  équipe non reconnue: "${title}"`);
    continue;
  }
  const key = [a, b].sort().join('|');
  if (!existing[key]) {
    existing[key] = { id, title, published };
    added++;
    console.log(`  + ${key} -> ${id} (${title})`);
  }
}

writeFileSync(OUT, JSON.stringify(existing, null, 2));
console.log(`${added} nouvelle(s) vidéo(s); total ${Object.keys(existing).length} -> ${OUT}`);
