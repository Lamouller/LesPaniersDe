import { chromium } from 'playwright';
import path from 'node:path';

const OUT = path.resolve(process.cwd(), '../../docs/screenshots');
const BASE = 'http://localhost:3200';

async function setDark(p) {
  await p.evaluate(() => {
    try { localStorage.setItem('theme', 'dark'); } catch (e) {}
    document.documentElement.classList.add('dark');
  });
  await p.waitForTimeout(400);
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: 'dark',
});

// 03-login (public)
const p1 = await context.newPage();
await p1.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await setDark(p1);
await p1.waitForTimeout(1500);
await p1.screenshot({ path: path.join(OUT, '03-login.png'), fullPage: true });
console.log('OK 03-login.png');

// 21-admin-sales
const p2 = await context.newPage();
await p2.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await p2.fill('input#email', 'admin@lespaniersde.local');
await p2.fill('input#password', 'DemoAdmin2026!');
await p2.click('button[type="submit"]');
await p2.waitForURL((u) => u.pathname.startsWith('/admin'), { timeout: 15000 });
await p2.goto(`${BASE}/admin/sales`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await setDark(p2);
await p2.waitForTimeout(3000);
await p2.screenshot({ path: path.join(OUT, '21-admin-sales.png'), fullPage: true });
console.log('OK 21-admin-sales.png');

await browser.close();
