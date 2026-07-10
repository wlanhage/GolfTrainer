// Esri World Imagery tile grid rendering, shared by preview/snap/trace.
// Reuses the Playwright install from ../../pr-screenshots.
import { createRequire } from 'node:module';

const TILE = 256;

// HTML page: absolutely-positioned tiles covering the georef frame, with an
// optional SVG overlay (polygon, labels, marks) on top.
export function tileGridHtml(georef, overlaySvg = '') {
  const { zoom, originX, originY, widthPx, heightPx } = georef;
  const imgs = [];
  for (let tx = Math.floor(originX / TILE); tx * TILE < originX + widthPx; tx++) {
    for (let ty = Math.floor(originY / TILE); ty * TILE < originY + heightPx; ty++) {
      imgs.push(
        `<img src="https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${ty}/${tx}"` +
          ` style="position:absolute;left:${tx * TILE - originX}px;top:${ty * TILE - originY}px;width:${TILE}px;height:${TILE}px">`
      );
    }
  }
  return `<!doctype html><body style="margin:0;position:relative;width:${widthPx}px;height:${heightPx}px;background:#000">
${imgs.join('\n')}
<svg width="${widthPx}" height="${heightPx}" style="position:absolute;left:0;top:0">${overlaySvg}</svg></body>`;
}

// Render pages sequentially in one browser; prints each output path.
export async function renderPagesToPngs(pages) {
  if (pages.length === 0) return;
  const require = createRequire(new URL('../../pr-screenshots/package.json', import.meta.url));
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 1200 } });
    for (const { html, outPath } of pages) {
      await page.setContent(html, { waitUntil: 'networkidle' });
      await page.locator('body').screenshot({ path: outPath });
      console.log(outPath);
    }
  } finally {
    await browser.close();
  }
}
