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

async function clickIfPossible(locator, timeout = 2500) {
  try {
    if (await locator.isVisible()) {
      await locator.click({ timeout });
      return true;
    }
  } catch {
    // Layout races are fine for a smoke test; page errors are tracked separately.
  }
  return false;
}

async function dismissInspect() {
  if (await clickIfPossible(page.locator('.inspect-overlay'))) {
    await page.waitForTimeout(250);
  }
}

await shot('01-title');
await page.getByRole('button', { name: 'Open the Store' }).click();
await page.waitForTimeout(800);
await shot('02-pass');
await page.getByRole('button', { name: 'Reveal My Hand' }).click();
await page.waitForTimeout(1200);
await shot('03-turn');

// Play a few turns: draw, pick the first playable card+target, end turn.
// The bot recovers from whatever state it lands in rather than assuming
// a strict sequence; its job is to exercise the UI and surface page errors.
for (let turn = 0; turn < 8; turn += 1) {
  if (await clickIfPossible(page.getByRole('button', { name: 'Reveal My Hand' }))) {
    await page.waitForTimeout(1000);
  }

  await dismissInspect();

  if (await clickIfPossible(page.getByRole('button', { name: /Draw \d+ Cards?/ }))) {
    await page.waitForTimeout(900);
  }

  // Try hand cards until the play budget is spent or nothing has a target.
  for (let play = 0; play < 2; play += 1) {
    const handCards = page.locator('.hand-dock-cards .game-card');
    const count = await handCards.count();
    let played = false;

    for (let index = 0; index < count; index += 1) {
      await dismissInspect();

      if (!(await clickIfPossible(handCards.nth(index), 1500))) {
        continue;
      }

      await page.waitForTimeout(250);

      if (await clickIfPossible(page.locator('.target-button').first())) {
        await page.waitForTimeout(1100);
        played = true;
        break;
      }

      await clickIfPossible(page.locator('.hud-actions').getByRole('button', { name: 'Cancel', exact: true }));
    }

    if (!played) {
      break;
    }
  }

  if (turn === 3) {
    await shot('04-midgame');
  }

  await dismissInspect();
  await clickIfPossible(page.getByRole('button', { name: 'End Turn' }));
  await page.waitForTimeout(600);
}

if (await clickIfPossible(page.getByRole('button', { name: 'Reveal My Hand' }))) {
  await page.waitForTimeout(1000);
}
await dismissInspect();
await shot('05-late');

// Verify tap-to-inspect: click a mini card on the table, expect the reader overlay.
const dealSpot = await page.evaluate(() => {
  const state = window.__game.getState();

  if (state.phase !== 'turn') {
    return null;
  }

  const rows = { 'team-a': { y: 300, xs: [430, 640, 850] }, 'team-b': { y: 494, xs: [430, 640, 850] } };
  const rect = document.querySelector('canvas').getBoundingClientRect();

  for (const team of state.teams) {
    for (let slotIndex = 0; slotIndex < team.slots.length; slotIndex += 1) {
      const deal = team.slots[slotIndex];

      if (deal?.client) {
        const row = rows[team.id];
        const canvasX = row.xs[slotIndex] - 52;
        const canvasY = row.y - 18;
        return {
          name: deal.client.name,
          x: rect.x + (canvasX / 1280) * rect.width,
          y: rect.y + (canvasY / 800) * rect.height
        };
      }
    }
  }

  return null;
});

if (dealSpot) {
  await page.mouse.click(dealSpot.x, dealSpot.y);
  await page.waitForTimeout(400);
  const overlayVisible = await page.locator('.inspect-overlay').isVisible().catch(() => false);
  const overlayName = overlayVisible ? await page.locator('.inspect-overlay .card-name').textContent() : '';
  await shot('06-inspect');

  if (!overlayVisible || overlayName !== dealSpot.name) {
    errors.push(`inspect overlay failed: visible=${overlayVisible} name="${overlayName}" expected "${dealSpot.name}"`);
  } else {
    await page.locator('.inspect-overlay').click();
    await page.waitForTimeout(300);
    console.log(`inspect check OK (${dealSpot.name})`);
  }
} else {
  console.log('inspect check skipped: no deal with a client on the table this run');
}

await browser.close();
await server.close();

if (errors.length) {
  console.error('BROWSER ERRORS:');
  errors.forEach((entry) => console.error(' -', entry));
  process.exit(1);
}

console.log('OK: browser session completed with no page errors.');
process.exit(0);
