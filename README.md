# Dealership Wars

A 4-player, team-based digital card game inspired by the automotive retail industry. Two
dealerships sit around a conference table, build vehicle deals, sabotage each other, and
race to **$100 profit**.

Built as a digital board game: a Phaser 3 table scene (animated cards, cartoon employee
avatars, deal slots) with a React HUD, all driven by a single Zustand game store.

## How to play

- **4 players, 2 teams.** Partners sit opposite each other and share a profit score and a
  3-slot deal pipeline.
- **On your turn:** draw 1 card, play 1 card, pass clockwise (pass-the-device local play).
- **Build deals:** a deal needs a Client + Vehicle + Employee. Once complete it goes
  **Pending Delivery** and must survive until the start of your team's next turn. If it
  survives, it delivers and the profit is banked.
- **Sabotage:** ghost their internet leads, poach their employees, file chargebacks, plant
  one-star surveys, launch recall campaigns.
- **Protect:** Receptionists guard clients, Sales Managers guard vehicles, the GSM blocks
  everything aimed at their deal, and the Superstar Employee soaks the first hit.
- **Legendaries:** the **Dealer Principal** slams the table and forces a deal through
  instantly ("I've made my decision.") — unless the other team responds with the
  **Manufacturer Audit** ("We have concerns.").

A team wins at 100 profit, or by highest profit once the deck is exhausted and all deals
have resolved.

## Development

```bash
npm install
npm run dev      # local dev server
npm run build    # production build (deployed to GitHub Pages from main)
npm run sim      # headless rules engine smoke test (50 simulated games)
```

## Project layout

| Path | Purpose |
| --- | --- |
| `src/data/cards.json` | The full 54-card deck (Clients, Vehicles, Employees, Events, Legendaries) — no cards are hardcoded in app code |
| `src/game/rules.js` | Pure rules: profit math, protection, deal status, win threshold |
| `src/game/store.js` | Zustand store: turn flow, deal pipeline, sabotage resolution, the Dealer Principal reaction window, and an FX event queue |
| `src/game/TableScene.js` | Phaser 3 scene: the table, deal slots, avatars with idle/reaction animations, and all card/event animations |
| `src/game/PhaserGame.jsx` | React wrapper that mounts the Phaser canvas |
| `src/App.jsx` | React HUD: scoreboard, hand tray, target picker, pass screen, reaction overlay |
| `scripts/simulate.mjs` | Bot that plays full games against the store and asserts invariants |
| `scripts/browser-check.mjs` | Optional headless-browser smoke test (`npm i --no-save playwright-core @sparticuz/chromium` first) |
