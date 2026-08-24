import { chromium } from 'playwright';
import { mkdir, rename } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const captureDir = path.join(root, 'exports', 'hockey-social-capture');
const rawVideo = path.join(root, 'exports', 'hockey2026-social-square.webm');
const finalVideo = path.join(root, 'exports', 'hockey2026-social-square.mp4');
const cover = path.join(root, 'exports', 'hockey2026-social-square-cover.jpg');
const url = process.env.HOCKEY_CAPTURE_URL ?? 'http://127.0.0.1:5173/hockey2026';

const run = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}`)));
  });

await mkdir(captureDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1080, height: 1080 },
  deviceScaleFactor: 1,
  recordVideo: { dir: captureDir, size: { width: 1080, height: 1080 } },
  colorScheme: 'light'
});
const page = await context.newPage();
const wait = (ms) => page.waitForTimeout(ms);

await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.locator('.nation-layer').first().waitFor();
await page.evaluate(() => document.fonts.ready);
await wait(900);

await page.evaluate(() => {
  const style = document.createElement('style');
  style.id = 'social-capture-style';
  style.textContent = `
    #social-title, #social-end, #phone-stage { position: fixed; inset: 0; z-index: 10000; font-family: Montserrat, Arial, sans-serif; }
    #social-title, #social-end { display: grid; place-items: center; overflow: hidden; background: #f4f5f8; color: #24262c; transition: opacity .6s ease; }
    .social-card { position: relative; z-index: 2; width: 760px; text-align: center; }
    .social-kicker { margin: 0 0 22px; color: #e2231a; font-size: 20px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
    .social-card h1 { margin: 0; font-size: 76px; line-height: .98; letter-spacing: -.055em; }
    .social-card p { margin: 28px auto 0; max-width: 650px; color: #686b73; font-size: 25px; line-height: 1.4; }
    .social-orbit { position: absolute; width: 820px; height: 820px; border: 5px solid rgba(226,35,26,.18); border-radius: 50%; }
    .social-orbit::before, .social-orbit::after { content: ''; position: absolute; border-radius: 50%; border: 3px solid rgba(226,35,26,.12); }
    .social-orbit::before { inset: 95px; } .social-orbit::after { inset: 210px; }
    #social-caption { position: fixed; left: 50%; bottom: 38px; z-index: 9999; width: max-content; max-width: 860px; padding: 17px 28px 18px; border: 1px solid rgba(226,35,26,.24); border-radius: 20px; background: rgba(255,255,255,.94); box-shadow: 0 16px 48px rgba(20,20,28,.18); color: #24262c; font-family: Montserrat, Arial, sans-serif; text-align: center; pointer-events: none; transform: translate(-50%, 18px); opacity: 0; transition: opacity .3s ease, transform .3s ease; backdrop-filter: blur(12px); }
    #social-caption.show { opacity: 1; transform: translate(-50%, 0); }
    #social-caption small { display: block; margin-bottom: 4px; color: #e2231a; font-size: 14px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
    #social-caption strong { display: block; font-size: 25px; line-height: 1.22; }
    body.capture-mode .calendar-cue { display: none !important; }
    #phone-stage { display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at 50% 48%, #fff 0, #f1f2f6 66%, #e9ebf0 100%); transition: opacity .55s ease; }
    #phone-stage .phone-title { position: absolute; top: 34px; left: 0; right: 0; color: #24262c; font-size: 28px; font-weight: 800; text-align: center; }
    #phone-stage .phone-title span { color: #e2231a; }
    #phone-stage .phone { width: 420px; height: 860px; margin-top: 70px; padding: 10px; border: 2px solid #cfd1d8; border-radius: 42px; background: #15161a; box-shadow: 0 30px 80px rgba(30,32,40,.24); }
    #phone-stage iframe { width: 100%; height: 100%; border: 0; border-radius: 31px; background: #f7f8fa; }
    #social-end .social-card h1 { font-size: 64px; }
    #social-end .social-url { display: inline-block; margin-top: 30px; padding: 13px 24px; border-radius: 999px; background: #e2231a; color: white; font-size: 20px; font-weight: 800; }
  `;
  document.head.append(style);
  document.body.classList.add('capture-mode');

  const title = document.createElement('div');
  title.id = 'social-title';
  title.innerHTML = `<div class="social-orbit"></div><div class="social-card"><div class="social-kicker">Coupe du Monde de hockey 2026</div><h1>Le Mondial,<br>match après match</h1><p>Calendrier, parcours, statistiques et résumés officiels dans une visualisation interactive.</p></div>`;
  document.body.append(title);

  const caption = document.createElement('div');
  caption.id = 'social-caption';
  document.body.append(caption);
});

const setCaption = async (kicker, text, visible = true) => {
  await page.evaluate(({ kicker, text, visible }) => {
    const caption = document.querySelector('#social-caption');
    caption.innerHTML = `<small>${kicker}</small><strong>${text}</strong>`;
    caption.classList.toggle('show', visible);
  }, { kicker, text, visible });
};

await wait(2800);
await page.evaluate(() => document.querySelector('#social-title').style.opacity = '0');
await wait(700);
await page.evaluate(() => document.querySelector('#social-title').remove());

await setCaption('Vue d’ensemble', 'Comprendre le tournoi en un coup d’œil');
await wait(3000);

await setCaption('Jour après jour', 'Les lignes révèlent les affiches de la date sélectionnée');
await page.getByRole('button', { name: 'Jour suivant' }).click();
await wait(1700);
await page.getByRole('button', { name: 'Jour précédent' }).click();
await wait(1800);

await setCaption('Deux compétitions', 'Les nations se croisent en douceur entre Hommes et Femmes');
await page.getByRole('button', { name: 'Femmes' }).click();
await wait(1500);
await page.getByRole('button', { name: 'Hommes' }).click();
await wait(1800);

await setCaption('Un format inédit', 'Deux phases de poules, puis demi-finales et matchs de classement');
const readViz = page.locator('.read-viz summary');
await readViz.scrollIntoViewIfNeeded();
await readViz.click();
await wait(3300);
await readViz.click();
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
await wait(900);

await setCaption('Chaque nation', 'Classement, résultats et calendrier dans un parcours dédié');
await page.locator('.team[aria-label^="Belgique"]').click();
await wait(3000);

const expandable = page.locator('.drawer .row[aria-expanded]').first();
if (await expandable.count()) {
  await setCaption('Chaque match', 'Scores par quart-temps, actions et statistiques détaillées');
  await expandable.click();
  await wait(3200);

  const videoButton = page.locator('.drawer .video-btn').first();
  if (await videoButton.count()) {
    await setCaption('Source officielle', 'Les résumés vidéo publiés par FIH Hockey');
    await videoButton.click();
    await page.locator('.video-panel .poster').waitFor();
    await wait(3200);
    await page.locator('.video-panel .close').click();
    await wait(600);
  }
}

await page.locator('.drawer .close').click().catch(async () => page.keyboard.press('Escape'));
await wait(700);
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
await wait(900);
await setCaption('', '', false);
await page.evaluate(() => document.body.classList.remove('capture-mode'));
await page.locator('.calendar-cue').waitFor();
await wait(1400);
await page.locator('.calendar-cue').click();
await wait(1100);
await page.evaluate(() => document.body.classList.add('capture-mode'));
await setCaption('Calendrier complet', 'Matchs joués et à venir, horaires et phases de compétition');
await wait(2800);

await page.locator('.matches .match').first().click();
await setCaption('Une fiche unifiée', 'Le même niveau de détail depuis le calendrier ou la visualisation');
await wait(3200);
await page.keyboard.press('Escape');
await wait(700);
await setCaption('', '', false);

await page.evaluate(() => {
  const stage = document.createElement('div');
  stage.id = 'phone-stage';
  stage.innerHTML = `<div class="phone-title">Une expérience pensée pour le <span>mobile</span></div><div class="phone"><iframe id="demo-phone" src="/hockey2026" title="Démonstration mobile"></iframe></div>`;
  document.body.append(stage);
});

const phone = page.frameLocator('#demo-phone');
await phone.locator('.nation-layer').first().waitFor();
await wait(1700);
await phone.locator('.team[aria-label^="Belgique"]').click();
await wait(2400);
const phoneExpandable = phone.locator('.drawer .row[aria-expanded]').first();
if (await phoneExpandable.count()) {
  await phoneExpandable.click();
  await wait(2500);
}

await page.evaluate(() => document.querySelector('#phone-stage').style.opacity = '0');
await wait(650);
await page.evaluate(() => {
  document.querySelector('#phone-stage').remove();
  const end = document.createElement('div');
  end.id = 'social-end';
  end.innerHTML = `<div class="social-orbit"></div><div class="social-card"><div class="social-kicker">Belgique · Pays-Bas 2026</div><h1>Tout le Mondial.<br>Une seule visualisation.</h1><div class="social-url">RedDeviz · Hockey 2026</div></div>`;
  document.body.append(end);
});
await wait(3000);

const video = page.video();
await context.close();
await browser.close();
await rename(await video.path(), rawVideo);
await run('ffmpeg', [
  '-y', '-i', rawVideo,
  '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
  '-map', '0:v:0', '-map', '1:a:0',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-profile:v', 'high', '-level', '4.1',
  '-pix_fmt', 'yuv420p', '-r', '25', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart',
  finalVideo
]);
await run('ffmpeg', ['-y', '-ss', '49', '-i', finalVideo, '-frames:v', '1', '-q:v', '2', '-update', '1', cover]);
console.log(finalVideo);
