// Loads the built app in headless Chromium, clicks through a few turns,
// and fails on any page error.
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import chromiumBinary from '@sparticuz/chromium';

const server = await createServer({ logLevel: 'error', server: { port: 5199 } });
await server.listen();

const executablePath = await chromiumBinary.executablePath();
const browser = await chromium.launch({
  executablePath,
  args: chromiumBinary.args
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') {
    errors.push(`console: ${message.text()}`);
  }
});

await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

async function shot(name) {
  await page.screenshot({ path: `scripts/shots/${name}.png` });
}

await shot('01-title');
await page.getByRole('button', { name: 'Open the Store' }).click();
await page.waitForTimeout(800);
await shot('02-pass');
await page.getByRole('button', { name: 'Reveal My Hand' }).click();
await page.waitForTimeout(1200);
await shot('03-turn');

// Play a few turns: draw, pick first playable card+target, end turn.
try {
for (let turn = 0; turn < 8; turn += 1) {
  const draw = page.getByRole('button', { name: 'Draw 1 Card' });

  if (await draw.isVisible().catch(() => false)) {
    await draw.click();
    await page.waitForTimeout(700);
  }

  // Try each hand card until one offers a target.
  const handCards = page.locator('.hud-hand .game-card');
  const count = await handCards.count();

  for (let index = 0; index < count; index += 1) {
    await handCards.nth(index).click();
    await page.waitForTimeout(200);
    const target = page.locator('.target-button').first();

    if (await target.isVisible().catch(() => false)) {
      await target.click();
      await page.waitForTimeout(1100);
      break;
    }

    const cancel = page.getByRole('button', { name: 'Cancel' });
    if (await cancel.isVisible().catch(() => false)) {
      await cancel.click();
    }
  }

  if (turn === 3) {
    await shot('04-midgame');
  }

  const endTurn = page.getByRole('button', { name: 'End Turn' });
  await endTurn.click();
  await page.waitForTimeout(400);
  const reveal = page.getByRole('button', { name: 'Reveal My Hand' });
  if (await reveal.isVisible().catch(() => false)) {
    await reveal.click();
  }
  await page.waitForTimeout(900);
}
} catch (error) {
  await shot('99-error');
  console.error('Failure screenshot saved. Collected page errors:');
  errors.forEach((entry) => console.error(' -', entry));
  throw error;
}

await shot('05-late');

await browser.close();
await server.close();

if (errors.length) {
  console.error('BROWSER ERRORS:');
  errors.forEach((entry) => console.error(' -', entry));
  process.exit(1);
}

console.log('OK: browser session completed with no page errors.');
process.exit(0);
