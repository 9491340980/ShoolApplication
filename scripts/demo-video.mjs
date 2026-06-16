/**
 * Records an automated Head Master walkthrough of VidyaSetu as a video file.
 *
 * Usage:
 *   node scripts/demo-video.mjs              # records EN + TE against the live site
 *   BASE_URL=http://localhost:4200 node scripts/demo-video.mjs
 *   LANGS=en node scripts/demo-video.mjs     # just one language
 *
 * Output: demo-videos/<lang>/*.webm  (one video per language)
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readdirSync, renameSync } from 'fs';
import { join } from 'path';

const BASE = process.env.BASE_URL || 'https://vidyasetu-d0ee7.web.app';
const LANGS = (process.env.LANGS || 'en,te').split(',').map((s) => s.trim());
const OUT = 'demo-videos';
const VW = 1366;
const VH = 800;

const HM_LABEL = { en: 'Head Master', te: 'హెడ్ మాస్టర్' };

// Intro + the route-by-route flow. Each step has a bilingual caption.
const INTRO = {
  en: 'VidyaSetu — Head Master demo',
  te: 'విద్యాసేతు — హెడ్ మాస్టర్ డెమో',
};
const FLOW = [
  { href: '/dashboard', hold: 4500, cap: { en: 'Dashboard — live school stats at a glance', te: 'డాష్‌బోర్డు — స్కూల్ గణాంకాలు ఒక్క చూపులో' } },
  { href: '/students', hold: 4000, search: true, cap: { en: 'Students — search & manage every class', te: 'విద్యార్థులు — ప్రతి తరగతిని వెతకండి, నిర్వహించండి' } },
  { href: '/attendance', hold: 4000, cap: { en: 'Attendance — one-tap marking, instant alerts', te: 'హాజరు — ఒక్క నొక్కుతో, తక్షణ అలర్ట్‌లు' } },
  { href: '/marks', hold: 4000, cap: { en: 'Marks & Results — subject-wise entry', te: 'మార్కులు & ఫలితాలు — సబ్జెక్ట్ వారీగా' } },
  { href: '/fees', hold: 5000, feeHistory: true, cap: { en: 'Fees — installments, balance & payment history', te: 'ఫీజులు — వాయిదాలు, బ్యాలెన్స్ & చెల్లింపు చరిత్ర' } },
  { href: '/notices', hold: 4000, cap: { en: 'Notice Board — send to all parents on WhatsApp', te: 'నోటీసు బోర్డు — తల్లిదండ్రులకు వాట్సాప్‌లో పంపండి' } },
  { href: '/reports', hold: 4000, cap: { en: 'Reports — fees, attendance & exam analytics', te: 'రిపోర్టులు — ఫీజు, హాజరు & పరీక్ష విశ్లేషణ' } },
  { href: '/users', hold: 4500, cap: { en: 'User Management — accounts, classes & school logo', te: 'యూజర్ నిర్వహణ — ఖాతాలు, తరగతులు & స్కూల్ లోగో' } },
];

const sleep = (p, ms) => p.waitForTimeout(ms);

async function setCaption(page, intro, text) {
  await page.evaluate(
    ([intro, text]) => {
      let el = document.getElementById('__demo_caption');
      if (!el) {
        el = document.createElement('div');
        el.id = '__demo_caption';
        el.style.cssText =
          'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:2147483647;' +
          'background:rgba(15,45,110,.94);color:#fff;padding:12px 22px;border-radius:14px;' +
          'font:600 18px/1.35 Inter,system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.35);' +
          'max-width:80vw;text-align:center;pointer-events:none;transition:opacity .25s';
        document.body.appendChild(el);
      }
      el.innerHTML =
        (intro ? `<div style="font-size:13px;opacity:.7;font-weight:700;letter-spacing:.5px">${intro}</div>` : '') +
        `<div>${text}</div>`;
    },
    [intro, text],
  );
}

async function record(lang) {
  const dir = join(OUT, lang);
  mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: VW, height: VH },
    recordVideo: { dir, size: { width: VW, height: VH } },
  });
  const page = await context.newPage();

  console.log(`[${lang}] opening ${BASE}`);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await sleep(page, 2500);

  // Switch language if needed (button shows the *other* language's name).
  if (lang === 'te') {
    await page.getByRole('button', { name: 'తెలుగు' }).first().click().catch(() => {});
    await sleep(page, 1000);
  }

  // Title card
  await setCaption(page, INTRO[lang], lang === 'te' ? 'ప్రారంభిస్తోంది…' : 'Starting the tour…');
  await sleep(page, 2200);

  // Log in as Head Master (one-click demo).
  console.log(`[${lang}] logging in as Head Master`);
  await page.getByRole('button', { name: HM_LABEL[lang] }).first().click();
  await page.waitForURL('**/dashboard', { timeout: 20000 }).catch(() => {});
  await sleep(page, 3500);

  for (const step of FLOW) {
    console.log(`[${lang}] -> ${step.href}`);
    await page.locator(`aside a[href="${step.href}"]`).first().click().catch(() => {});
    await sleep(page, 1200);
    await setCaption(page, INTRO[lang], step.cap[lang]);
    await sleep(page, 1200);

    // A couple of natural interactions.
    if (step.search) {
      const box = page.locator('input[placeholder]').first();
      await box.click().catch(() => {});
      for (const ch of 'Reddy') {
        await page.keyboard.type(ch);
        await sleep(page, 200);
      }
      await sleep(page, 2000);
      await box.fill('').catch(() => {}); // back to the full list
      await sleep(page, 1500);
    }
    if (step.feeHistory) {
      // open the first payment-history popup, then close it
      await page.getByText('📜').first().click().catch(() => {});
      await sleep(page, 2600);
      await page.keyboard.press('Escape').catch(() => {});
      await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
      await sleep(page, 600);
    }

    // gentle scroll to reveal the page
    await page.mouse.move(VW / 2, VH / 2);
    await page.mouse.wheel(0, 320);
    await sleep(page, Math.max(1200, step.hold - 1500));
    await page.mouse.wheel(0, -320);
    await sleep(page, 700);
  }

  // Outro
  await setCaption(
    page,
    INTRO[lang],
    lang === 'te' ? 'విద్యాసేతు — మీ స్కూల్ కోసం 🙏' : 'VidyaSetu — built for your school 🙏',
  );
  await sleep(page, 2600);

  await context.close(); // finalizes & flushes the video file
  await browser.close();

  // Rename the single video to a friendly name.
  const files = readdirSync(dir).filter((f) => f.endsWith('.webm'));
  if (files.length) {
    const target = join(dir, `vidyasetu-headmaster-${lang}.webm`);
    if (existsSync(target)) return;
    renameSync(join(dir, files[0]), target);
    console.log(`[${lang}] saved ${target}`);
  }
}

for (const lang of LANGS) {
  await record(lang);
}
console.log('Done. Videos are in ./demo-videos');
