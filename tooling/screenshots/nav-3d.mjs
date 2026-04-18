import { chromium, devices } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../../docs/screenshots');
const BASE = 'http://localhost:3200';

async function login(page, email, password) {
  await page.goto(`${BASE}/login`);
  await page.fill('input#email', email);
  await page.fill('input#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 });
}

(async () => {
  const browser = await chromium.launch();

  // ─── Mobile portrait iPhone 13 (390x844) ──────────────────────────────
  const mobile = await browser.newContext({
    ...devices['iPhone 13'],
    colorScheme: 'dark',
    permissions: ['geolocation'],
    geolocation: { latitude: 43.6047, longitude: 1.4442 }, // Toulouse
  });
  const p1 = await mobile.newPage();
  await login(p1, 'nadine@lespaniersde.local', 'DemoNadine2026!');

  // Go direct to navigate page with a mock delivery id (the page handles id=new)
  await p1.goto(`${BASE}/producer/route/navigate?delivery_id=new`, { waitUntil: 'networkidle', timeout: 30000 });
  await p1.waitForTimeout(2000);

  // Force dark theme
  await p1.evaluate(() => {
    try { localStorage.setItem('theme', 'dark'); } catch (e) {}
    document.documentElement.classList.add('dark');
  });
  await p1.waitForTimeout(500);

  // Capture "before start"
  await p1.screenshot({ path: path.join(OUT, '34-nav-3d-mobile-idle.png'), fullPage: false });
  console.log('OK 34-nav-3d-mobile-idle.png (avant démarrage)');

  // Click Démarrer
  const startBtn = p1.getByRole('button', { name: /démarrer/i });
  if (await startBtn.count() > 0) {
    try {
      await startBtn.first().click();
      console.log('  → clic Démarrer (GPS simulé Toulouse)');
      await p1.waitForTimeout(4500);
      await p1.screenshot({ path: path.join(OUT, '35-nav-3d-mobile-active.png'), fullPage: false });
      console.log('OK 35-nav-3d-mobile-active.png (nav active)');
    } catch (e) {
      console.error('  démarrage failed:', e.message.split('\n')[0]);
    }
  } else {
    console.log('  (pas de bouton Démarrer — page idle capturée uniquement)');
  }
  await mobile.close();

  // ─── Mobile landscape (844x390) ───────────────────────────────────────
  const landscape = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: devices['iPhone 13'].userAgent,
    colorScheme: 'dark',
    permissions: ['geolocation'],
    geolocation: { latitude: 43.6047, longitude: 1.4442 },
  });
  const p2 = await landscape.newPage();
  await login(p2, 'nadine@lespaniersde.local', 'DemoNadine2026!');
  await p2.goto(`${BASE}/producer/route/navigate?delivery_id=new`, { waitUntil: 'networkidle', timeout: 30000 });
  await p2.evaluate(() => {
    try { localStorage.setItem('theme', 'dark'); } catch (e) {}
    document.documentElement.classList.add('dark');
  });
  await p2.waitForTimeout(1500);

  const startBtn2 = p2.getByRole('button', { name: /démarrer/i });
  if (await startBtn2.count() > 0) {
    try {
      await startBtn2.first().click();
      await p2.waitForTimeout(4500);
    } catch (e) {}
  }
  await p2.screenshot({ path: path.join(OUT, '36-nav-3d-mobile-landscape.png'), fullPage: false });
  console.log('OK 36-nav-3d-mobile-landscape.png');
  await landscape.close();

  await browser.close();
  console.log('Done.');
})();
