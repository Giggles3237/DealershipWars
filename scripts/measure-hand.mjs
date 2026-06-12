// Measures hand card geometry vs the viewport to diagnose bottom clipping.
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
await page.getByRole('button', { name: 'Reveal My Hand' }).click();
await page.waitForTimeout(1200);

const metrics = await page.evaluate(() => {
  const hand = document.querySelector('.hand-dock-cards');
  const cards = [...document.querySelectorAll('.hand-dock-cards .game-card')];

  return {
    innerHeight: window.innerHeight,
    hand: hand.getBoundingClientRect().toJSON(),
    handScroll: { scrollHeight: hand.scrollHeight, clientHeight: hand.clientHeight },
    cards: cards.map((card) => {
      const rect = card.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, height: rect.height };
    })
  };
});

console.log(JSON.stringify(metrics, null, 2));

await page.screenshot({ path: 'scripts/shots/hand-before.png', clip: { x: 200, y: 600, width: 1000, height: 300 } });

await browser.close();
await server.close();
process.exit(0);
