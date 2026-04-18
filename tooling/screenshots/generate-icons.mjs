import { chromium } from 'playwright';
import path from 'node:path';

const OUT = path.resolve(process.cwd(), '../../apps/web/public/icons');

const html = (size) => `<!DOCTYPE html>
<html><head><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${size}px; height: ${size}px; background: #16A34A; }
  .wrap {
    width: ${size}px; height: ${size}px;
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, #16A34A 0%, #15803D 100%);
    border-radius: ${size * 0.2}px;
  }
  .logo {
    color: #FEFDF8;
    font-family: -apple-system, 'SF Pro Display', Inter, system-ui, sans-serif;
    font-weight: 800;
    font-size: ${size * 0.42}px;
    letter-spacing: -${size * 0.01}px;
    text-shadow: 0 ${size * 0.015}px ${size * 0.04}px rgba(0,0,0,0.15);
  }
</style></head><body><div class="wrap"><span class="logo">LP</span></div></body></html>`;

const browser = await chromium.launch();

for (const size of [192, 512]) {
  const ctx = await browser.newContext({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.setContent(html(size));
  await page.waitForTimeout(150);
  const out = path.join(OUT, `icon-${size}.png`);
  await page.screenshot({ path: out, omitBackground: false, clip: { x: 0, y: 0, width: size, height: size } });
  console.log(`OK icon-${size}.png`);
  await ctx.close();
}

// Apple touch icon 180x180 avec padding (sinon safari tronque)
for (const size of [180]) {
  const ctx = await browser.newContext({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.setContent(html(size));
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(OUT, `apple-touch-icon.png`), clip: { x: 0, y: 0, width: size, height: size } });
  console.log('OK apple-touch-icon.png');
  await ctx.close();
}

await browser.close();
