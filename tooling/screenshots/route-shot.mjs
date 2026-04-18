import { chromium } from 'playwright';
import path from 'node:path';

const OUT = path.resolve(process.cwd(), '../../docs/screenshots');
const BASE = 'http://localhost:3200';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: 'dark' });

async function setDark(p) {
  await p.evaluate(() => {
    try { localStorage.setItem('theme', 'dark'); } catch (e) {}
    document.documentElement.classList.add('dark');
  });
  await p.waitForTimeout(400);
}

// Login nadine
const p = await ctx.newPage();
await p.goto(`${BASE}/login`);
await p.fill('input#email', 'nadine@lespaniersde.local');
await p.fill('input#password', 'DemoNadine2026!');
await p.click('button[type="submit"]');
await p.waitForURL((u) => u.pathname.startsWith('/producer'), { timeout: 15000 });
await p.goto(`${BASE}/producer/route`, { waitUntil: 'networkidle', timeout: 30000 });
await setDark(p);
await p.waitForTimeout(3000);

// Click Optimiser
const btn = p.getByRole('button', { name: /optimiser/i });
if (await btn.count() > 0) {
  await btn.first().click();
  console.log('clicked optimize');
  await p.waitForTimeout(5500);
}

await p.screenshot({ path: path.join(OUT, '33-producer-route-osrm.png'), fullPage: true });
console.log('OK 33-producer-route-osrm.png');

await browser.close();
