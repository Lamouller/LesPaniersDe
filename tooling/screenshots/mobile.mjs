import { chromium, devices } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../../docs/screenshots');
const BASE = 'http://localhost:3200';

const shots = [
  { name: 'mobile-01-landing', url: '/', auth: null },
  { name: 'mobile-02-login', url: '/login', auth: null },
  { name: 'mobile-10-shop', url: '/shop', auth: 'alice@antislash.local' },
  { name: 'mobile-12-account', url: '/account', auth: 'alice@antislash.local' },
  { name: 'mobile-13-stats', url: '/account/stats', auth: 'alice@antislash.local' },
  { name: 'mobile-14-community', url: '/account/community', auth: 'alice@antislash.local' },
  { name: 'mobile-20-admin', url: '/admin', auth: 'admin@lespaniersde.local' },
  { name: 'mobile-21-admin-sales', url: '/admin/sales', auth: 'admin@lespaniersde.local' },
  { name: 'mobile-30-producer', url: '/producer', auth: 'nadine@lespaniersde.local' },
  { name: 'mobile-31-forecast', url: '/producer/forecast', auth: 'nadine@lespaniersde.local' },
  { name: 'mobile-33-products', url: '/producer/products', auth: 'nadine@lespaniersde.local' },
];

const passwords = {
  'alice@antislash.local': 'DemoAlice2026!',
  'admin@lespaniersde.local': 'DemoAdmin2026!',
  'nadine@lespaniersde.local': 'DemoNadine2026!',
};

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input#email', email);
  await page.fill('input#password', passwords[email]);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(1000);
}

async function setDark(page) {
  await page.evaluate(() => {
    try { localStorage.setItem('theme', 'dark'); } catch (e) {}
    document.documentElement.classList.add('dark');
  });
  await page.waitForTimeout(400);
}

(async () => {
  const browser = await chromium.launch();
  const iPhone = devices['iPhone 13'];
  const context = await browser.newContext({ ...iPhone, colorScheme: 'dark' });

  let currentUser = null;

  for (const shot of shots) {
    const page = await context.newPage();
    try {
      if (shot.auth !== currentUser) {
        await context.clearCookies();
        if (shot.auth) await login(page, shot.auth);
        currentUser = shot.auth;
      }
      await page.goto(`${BASE}${shot.url}`, { waitUntil: 'networkidle', timeout: 30000 });
      await setDark(page);
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(OUT, `${shot.name}.png`), fullPage: true });
      console.log(`OK ${shot.name}.png`);
    } catch (e) {
      console.error(`FAIL ${shot.name}: ${e.message.split('\n')[0]}`);
    } finally {
      await page.close();
    }
  }

  // Capture spéciale /producer/route avec carte Leaflet OSRM active
  console.log('--- Capture OSRM route avec polyline ---');
  const bigContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  });
  await bigContext.clearCookies();
  const routePage = await bigContext.newPage();
  await login(routePage, 'nadine@lespaniersde.local');
  await routePage.goto(`${BASE}/producer/route`, { waitUntil: 'networkidle', timeout: 30000 });
  await setDark(routePage);
  await routePage.waitForTimeout(2000);

  // Cliquer "Optimiser" si le bouton existe
  const optimizeBtn = routePage.getByRole('button', { name: /optimiser/i });
  if (await optimizeBtn.count() > 0) {
    try {
      await optimizeBtn.first().click();
      console.log('  → clic Optimiser');
      await routePage.waitForTimeout(4500); // attendre OSRM + tracé polyline
    } catch (e) { console.error('  optimize click failed:', e.message.split('\n')[0]); }
  } else {
    console.log('  (pas de bouton Optimiser trouvé, capture telle quelle)');
  }

  await routePage.screenshot({ path: path.join(OUT, '33-producer-route-osrm.png'), fullPage: true });
  console.log('OK 33-producer-route-osrm.png');

  await browser.close();
  console.log('Done.');
})();
