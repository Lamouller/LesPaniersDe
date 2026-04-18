import { chromium } from 'playwright';
import path from 'node:path';
const OUT = path.resolve(process.cwd(), '../../docs/screenshots');
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: 'dark' });
const p = await ctx.newPage();
await p.goto('http://localhost:3200/login');
await p.fill('input#email', 'nadine@lespaniersde.local');
await p.fill('input#password', 'DemoNadine2026!');
await p.click('button[type="submit"]');
await p.waitForURL((u) => u.pathname.startsWith('/producer'), { timeout: 15000 });
await p.goto('http://localhost:3200/producer/products', { waitUntil: 'networkidle' });
await p.evaluate(() => {
  try { localStorage.setItem('theme', 'dark'); } catch (e) {}
  document.documentElement.classList.add('dark');
});
await p.waitForTimeout(3500);
await p.screenshot({ path: path.join(OUT, 'debug-products-dark.png'), fullPage: true });

await p.evaluate(() => { document.documentElement.classList.remove('dark'); try { localStorage.setItem('theme', 'light'); } catch (e) {} });
await p.waitForTimeout(800);
await p.screenshot({ path: path.join(OUT, 'debug-products-light.png'), fullPage: true });
console.log('done');
await browser.close();
