import { chromium } from 'playwright';
import { mkdir, rename } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const captureDir = path.join(root, 'exports', 'hockey-social-vertical-capture');
const rawVideo = path.join(root, 'exports', 'hockey2026-social-vertical.webm');
const finalVideo = path.join(root, 'exports', 'hockey2026-social-vertical.mp4');
const cover = path.join(root, 'exports', 'hockey2026-social-vertical-cover.jpg');
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
  viewport: { width: 1080, height: 1920 },
  deviceScaleFactor: 1,
  recordVideo: { dir: captureDir, size: { width: 1080, height: 1920 } },
  colorScheme: 'light'
});
const page = await context.newPage();
const wait = (ms) => page.waitForTimeout(ms);

await page.setContent(`
  <style>
    * { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #eff1f5; }
    body { display: grid; place-items: center; background: radial-gradient(circle at 50% 47%, #fff 0, #f3f4f7 56%, #e7e9ef 100%); }
    .phone { width: 691px; height: 1472px; padding: 10px; border: 2px solid #bfc2ca; border-radius: 58px; background: #15161a; box-shadow: 0 42px 110px rgba(28,30,38,.26); }
    .screen { width: 671px; height: 1452px; overflow: hidden; border-radius: 47px; background: #f7f8fa; }
    iframe { width: 390px; height: 844px; border: 0; background: #f7f8fa; transform: scale(1.72); transform-origin: 0 0; }
  </style>
  <div class="phone"><div class="screen"><iframe id="demo-phone" src="${url}" title="Hockey 2026"></iframe></div></div>
`);

const phoneElement = await page.locator('#demo-phone').elementHandle();
const frame = await phoneElement.contentFrame();
await frame.locator('.nation-layer').first().waitFor();
await frame.evaluate(() => document.fonts.ready);
await frame.addStyleTag({ content: `
  .capture-tap {
    position: fixed;
    z-index: 100000;
    width: 34px;
    height: 34px;
    margin: -17px 0 0 -17px;
    border: 2px solid rgba(226, 35, 26, .9);
    border-radius: 50%;
    background: rgba(226, 35, 26, .12);
    pointer-events: none;
    animation: capture-tap .5s ease-out forwards;
  }
  @keyframes capture-tap {
    from { opacity: 1; transform: scale(.4); }
    to { opacity: 0; transform: scale(1.5); }
  }
` });

const tap = async (locator, pause = 1200, force = false) => {
  const target = locator.first();
  await target.waitFor({ state: 'visible' });
  await target.scrollIntoViewIfNeeded();
  await wait(220);
  await target.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'capture-tap';
    ripple.style.left = `${rect.left + rect.width / 2}px`;
    ripple.style.top = `${rect.top + rect.height / 2}px`;
    document.body.append(ripple);
    window.setTimeout(() => ripple.remove(), 550);
  });
  await wait(140);
  await target.click({ force });
  await wait(pause);
};

await wait(2200);

await tap(frame.getByRole('button', { name: 'Jour précédent' }), 1100);
await tap(frame.getByRole('button', { name: 'Jour suivant' }), 1100);
await tap(frame.getByRole('button', { name: 'Jour précédent' }), 1500);

await tap(frame.getByRole('button', { name: 'Femmes' }), 1500);
await tap(frame.getByRole('button', { name: 'Hommes' }), 1700);

await tap(frame.locator('.chord-hit[aria-label*="Belgique"][aria-label*="France"]'), 2500, true);
const matchVideo = frame.locator('.drawer .video-btn');
if (await matchVideo.count()) {
  await tap(matchVideo, 1900);
  const poster = frame.locator('.video-panel .poster');
  if (await poster.count()) await tap(poster, 2200);
  await tap(frame.locator('.video-panel .close'), 700);
}
await tap(frame.locator('.drawer-mobile-close'), 900);

await frame.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
await wait(900);
await tap(frame.locator('.team[aria-label^="Belgique"]'), 2300);
const expandable = frame.locator('.drawer .row[aria-expanded]').first();
if (await expandable.count()) {
  await tap(expandable, 2600);
  const teamVideo = frame.locator('.drawer .video-btn').first();
  if (await teamVideo.count()) {
    await tap(teamVideo, 1900);
    await tap(frame.locator('.video-panel .close'), 700);
  }
}
await tap(frame.locator('.drawer-mobile-close'), 900);

const readViz = frame.locator('.read-viz summary');
await tap(readViz, 2300);
await frame.evaluate(() => window.scrollBy({ top: 260, behavior: 'smooth' }));
await wait(1500);
await tap(readViz, 900);

await frame.locator('.calendar-cue-reserve').scrollIntoViewIfNeeded();
await frame.evaluate(() => window.scrollBy({ top: -32, behavior: 'instant' }));
await wait(700);
const calendarCue = frame.locator('.calendar-cue');
if (await calendarCue.count()) await tap(calendarCue, 2100);
else {
  await frame.locator('.matches').scrollIntoViewIfNeeded();
  await wait(2100);
}

const directVideo = frame.locator('.calendar-video').first();
if (await directVideo.count()) {
  await tap(directVideo, 1900);
  await tap(frame.locator('.video-panel .close'), 700);
}

await tap(frame.locator('.matches .match').first(), 2500);
await tap(frame.locator('.drawer-mobile-close'), 800);

await frame.evaluate(() => window.scrollBy({ top: 520, behavior: 'smooth' }));
await wait(2000);
await frame.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
await wait(2300);

const video = page.video();
await context.close();
await browser.close();
await rename(await video.path(), rawVideo);
await run('ffmpeg', [
  '-y', '-i', rawVideo,
  '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
  '-map', '0:v:0', '-map', '1:a:0',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-profile:v', 'high', '-level', '4.2',
  '-pix_fmt', 'yuv420p', '-r', '25', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart',
  finalVideo
]);
await run('ffmpeg', ['-y', '-ss', '2', '-i', finalVideo, '-frames:v', '1', '-q:v', '2', '-update', '1', cover]);
console.log(finalVideo);
