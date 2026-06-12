// Captures close-ups of the avatars for art review.
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import chromiumBinary from '@sparticuz/chromium';

const server = await createServer({ logLevel: 'error', server: { port: 5199 } });
await server.listen();

const browser = await chromium.launch({
  executablePath: await chromiumBinary.executablePath(),
  args: chromiumBinary.args
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Open the Store' }).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: 'Reveal My Hand' }).click();
await page.mouse.move(700, 80);
await page.waitForTimeout(2000);

// Measure the canvas (FIT-scaled inside its flex region) to map game coords.
const canvasRect = await page.evaluate(() => document.querySelector('canvas').getBoundingClientRect().toJSON());
const scale = canvasRect.width / 1280;
const seats = [
  { name: 'p1', x: 640, y: 118 },
  { name: 'p2', x: 112, y: 408 },
  { name: 'p3', x: 640, y: 668 },
  { name: 'p4', x: 1168, y: 408 }
];

for (const seat of seats) {
  const cx = canvasRect.x + seat.x * scale;
  const cy = canvasRect.y + seat.y * scale;
  await page.screenshot({
    path: `scripts/shots/avatar-${seat.name}.png`,
    clip: {
      x: Math.max(0, cx - 130),
      y: Math.max(0, cy - 120),
      width: 260,
      height: 280
    }
  });
}

await browser.close();
await server.close();
console.log('avatar close-ups saved');
process.exit(0);
