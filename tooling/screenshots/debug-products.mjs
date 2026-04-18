import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

page.on('console', (msg) => console.log('[browser]', msg.type(), msg.text()));
page.on('pageerror', (err) => console.log('[pageerror]', err.message));
page.on('response', (r) => {
  if (r.status() >= 400) console.log('[>=400]', r.status(), r.url());
});

await page.goto('http://localhost:3200/login');
await page.fill('input#email', 'nadine@lespaniersde.local');
await page.fill('input#password', 'DemoNadine2026!');
await page.click('button[type="submit"]');
await page.waitForURL((u) => u.pathname.startsWith('/producer'), { timeout: 15000 });
console.log('Landed on:', page.url());

await page.goto('http://localhost:3200/producer/products', { waitUntil: 'networkidle', timeout: 30000 });
console.log('After /producer/products, URL:', page.url());
const title = await page.title();
const h1 = await page.locator('h1').first().textContent().catch(() => 'no h1');
console.log('Title:', title);
console.log('H1:', h1);

await browser.close();
