import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../../docs/screenshots');
const BASE = 'http://localhost:3200';

// Toutes les captures par défaut en dark mode.
// Le `-light` en suffixe force le light mode (pour avoir un couple d'exemples).
const shots = [
  // Public
  { name: '01-landing', url: '/', auth: null, theme: 'dark' },
  { name: '01-landing-light', url: '/', auth: null, theme: 'light' },
  { name: '03-login', url: '/login', auth: null, theme: 'dark' },
  { name: '03-login-light', url: '/login', auth: null, theme: 'light' },

  // Client (alice) — dark
  { name: '10-shop', url: '/shop', auth: 'alice@antislash.local', theme: 'dark' },
  { name: '12-account', url: '/account', auth: 'alice@antislash.local', theme: 'dark' },
  { name: '13-account-stats', url: '/account/stats', auth: 'alice@antislash.local', theme: 'dark' },
  { name: '14-account-community', url: '/account/community', auth: 'alice@antislash.local', theme: 'dark' },

  // Client (alice) — light
  { name: '10-shop-light', url: '/shop', auth: 'alice@antislash.local', theme: 'light' },
  { name: '12-account-light', url: '/account', auth: 'alice@antislash.local', theme: 'light' },
  { name: '13-account-stats-light', url: '/account/stats', auth: 'alice@antislash.local', theme: 'light' },
  { name: '14-account-community-light', url: '/account/community', auth: 'alice@antislash.local', theme: 'light' },

  // Admin — dark
  { name: '20-admin-dashboard', url: '/admin', auth: 'admin@lespaniersde.local', theme: 'dark' },
  { name: '21-admin-sales', url: '/admin/sales', auth: 'admin@lespaniersde.local', theme: 'dark' },
  { name: '22-admin-forecast', url: '/admin/forecast', auth: 'admin@lespaniersde.local', theme: 'dark' },
  { name: '23-admin-producers', url: '/admin/producers', auth: 'admin@lespaniersde.local', theme: 'dark' },

  // Admin — light
  { name: '20-admin-dashboard-light', url: '/admin', auth: 'admin@lespaniersde.local', theme: 'light' },
  { name: '21-admin-sales-light', url: '/admin/sales', auth: 'admin@lespaniersde.local', theme: 'light' },
  { name: '22-admin-forecast-light', url: '/admin/forecast', auth: 'admin@lespaniersde.local', theme: 'light' },
  { name: '23-admin-producers-light', url: '/admin/producers', auth: 'admin@lespaniersde.local', theme: 'light' },

  // Producer (nadine) — dark
  { name: '30-producer-dashboard', url: '/producer', auth: 'nadine@lespaniersde.local', theme: 'dark' },
  { name: '31-producer-forecast', url: '/producer/forecast', auth: 'nadine@lespaniersde.local', theme: 'dark' },
  { name: '32-producer-catalog', url: '/producer/catalog', auth: 'nadine@lespaniersde.local', theme: 'dark' },

  // Producer (nadine) — light
  { name: '30-producer-dashboard-light', url: '/producer', auth: 'nadine@lespaniersde.local', theme: 'light' },
  { name: '31-producer-forecast-light', url: '/producer/forecast', auth: 'nadine@lespaniersde.local', theme: 'light' },
  { name: '32-producer-catalog-light', url: '/producer/catalog', auth: 'nadine@lespaniersde.local', theme: 'light' },
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

async function setTheme(page, theme) {
  await page.evaluate((t) => {
    try { localStorage.setItem('theme', t); } catch (e) {}
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    if (t === 'dark') root.classList.add('dark');
  }, theme);
  await page.waitForTimeout(400);
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  });

  let currentUser = null;

  for (const shot of shots) {
    const page = await context.newPage();
    try {
      if (shot.auth !== currentUser) {
        await context.clearCookies();
        if (shot.auth) {
          await login(page, shot.auth);
        }
        currentUser = shot.auth;
      }
      await page.goto(`${BASE}${shot.url}`, { waitUntil: 'networkidle', timeout: 30000 });
      await setTheme(page, shot.theme);
      await page.waitForTimeout(1200);
      const filePath = path.join(OUT, `${shot.name}.png`);
      await page.screenshot({ path: filePath, fullPage: true });
      console.log(`OK ${shot.name}.png — ${shot.url} [${shot.theme}]`);
    } catch (e) {
      console.error(`FAIL ${shot.name}: ${e.message.split('\n')[0]}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log('Done.');
})();
