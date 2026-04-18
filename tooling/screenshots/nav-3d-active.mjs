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

async function createDeliveryAndOptimize(page) {
  // Aller sur /producer/route et optimiser
  await page.goto(`${BASE}/producer/route`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  // Clic Optimiser OSRM
  const optimize = page.getByRole('button', { name: /optimiser/i });
  if (await optimize.count() > 0) {
    await optimize.first().click();
    await page.waitForTimeout(5000);
  }
  // Clic Démarrer (navigue vers /producer/route/navigate?delivery_id=new)
  const demarrer = page.getByRole('button', { name: /démarrer la tournée|démarrer/i });
  if (await demarrer.count() > 0) {
    // Ouvre la page navigate directement avec demo=1
    const url = `${BASE}/producer/route/navigate?delivery_id=new&demo=1`;
    await page.goto(url, { waitUntil: 'networkidle' });
  }
}

const browser = await chromium.launch();

// ─── Landscape mobile (844x390) en mode démo ─────────────────────────
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
const p1 = await landscape.newPage();
await login(p1, 'nadine@lespaniersde.local', 'DemoNadine2026!');
await createDeliveryAndOptimize(p1);

await p1.evaluate(() => {
  try { localStorage.setItem('theme', 'dark'); } catch (e) {}
  document.documentElement.classList.add('dark');
});
await p1.waitForTimeout(2000);

// Clic Démarrer pour lancer simulation
const startBtn = p1.getByRole('button', { name: /démarrer/i });
if (await startBtn.count() > 0) {
  await startBtn.first().click();
  console.log('  → démarrage simulation');
  await p1.waitForTimeout(8000); // laisser la caméra s'installer en 3D
} else {
  console.log('  (pas de bouton Démarrer trouvé)');
}

await p1.screenshot({ path: path.join(OUT, '35-nav-3d-landscape-active.png'), fullPage: false });
console.log('OK 35-nav-3d-landscape-active.png');
await landscape.close();

// ─── Portrait mobile (390x844) en mode démo ─────────────────────────
const portrait = await browser.newContext({
  ...devices['iPhone 13'],
  colorScheme: 'dark',
  permissions: ['geolocation'],
  geolocation: { latitude: 43.6047, longitude: 1.4442 },
});
const p2 = await portrait.newPage();
await login(p2, 'nadine@lespaniersde.local', 'DemoNadine2026!');
await createDeliveryAndOptimize(p2);

await p2.evaluate(() => {
  try { localStorage.setItem('theme', 'dark'); } catch (e) {}
  document.documentElement.classList.add('dark');
});
await p2.waitForTimeout(2000);

const startBtn2 = p2.getByRole('button', { name: /démarrer/i });
if (await startBtn2.count() > 0) {
  await startBtn2.first().click();
  await p2.waitForTimeout(8000);
}

await p2.screenshot({ path: path.join(OUT, '34-nav-3d-portrait-active.png'), fullPage: false });
console.log('OK 34-nav-3d-portrait-active.png');
await portrait.close();

await browser.close();
console.log('Done.');
