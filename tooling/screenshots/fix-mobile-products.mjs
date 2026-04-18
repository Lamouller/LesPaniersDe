import { chromium, devices } from 'playwright';
import path from 'node:path';

const OUT = path.resolve(process.cwd(), '../../docs/screenshots');
const BASE = 'http://localhost:3200';

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], colorScheme: 'dark' });

async function setDark(p) {
  await p.evaluate(() => {
    try { localStorage.setItem('theme', 'dark'); } catch (e) {}
    document.documentElement.classList.add('dark');
  });
  await p.waitForTimeout(400);
}

const p = await ctx.newPage();
await p.goto(`${BASE}/login`);
await p.fill('input#email', 'nadine@lespaniersde.local');
await p.fill('input#password', 'DemoNadine2026!');
await p.click('button[type="submit"]');
await p.waitForURL((u) => u.pathname.startsWith('/producer'), { timeout: 15000 });
await p.goto(`${BASE}/producer/products`, { waitUntil: 'networkidle', timeout: 30000 });
await setDark(p);
await p.waitForTimeout(1500);
await p.screenshot({ path: path.join(OUT, 'mobile-33-products.png'), fullPage: true });
console.log('OK mobile-33-products.png');
await browser.close();
