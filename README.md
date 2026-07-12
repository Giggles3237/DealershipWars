# Dealership Wars Multiplayer

A digital version of the original Dealership Wars card game: four rival dealerships in a free-for-all race to 30 cash, with AI dealer personalities filling any empty seat.

## How It Plays

- Each player runs their own dealership with **Cash** (the score), **Reputation**, a **Showroom** of customers (capped, expandable), a **Sales Team** of up to 2 salespeople, and a **Lot** of vehicles.
- On your turn you draw 2 cards and play up to 2 cards (cards and salespeople can grant extra plays).
- **Close a sale** by pairing a showroom Customer with a Lot vehicle: cash = vehicle profit + customer bonus + combo (+2 if the customer wants that kind of car) + permanent car-value upgrades + sales team bonuses + a reputation tier bonus (+1 at 4 rep, +2 at 8 rep). Every sale also earns 1 Reputation.
- High-end customers (VIP Client, Corporate Fleet Buyer, Dream Customer) require Reputation to recruit.
- **Sabotage** cards hit rivals directly: bad surveys, chargebacks, hand spying, customer poaching, and Market Domination steals the best customer from every rival.
- First dealership to **30 cash** wins.

The 54-card deck (`cards.json`) is rebuilt from the original tabletop deck: Customer, Vehicle, Salesperson, Action, and Sabotage cards.

## Architecture

- `client/` browser UI rendered from server-sent state
- `server/` authoritative room, seat, reconnect, WebSocket handling, and AI turn logic
- `shared/` pure game engine, rules, and serialization helpers
- `tests/` validation for room flow, rules enforcement, and full AI games

## Local Run

1. Install dependencies:
   - `npm install`
2. Start the server:
   - `npm start`
3. Open the game in a browser:
   - [http://localhost:3000](http://localhost:3000)
4. For auto-reload during development:
   - `npm run dev`
5. Run tests:
   - `npm test`

## Card Graphics

The deck art is generated from `cards.json` so each card has a matching full-card SVG with the same dealership tabletop theme and type-specific colors.

- Open the AI art planning studio:
  - [http://localhost:3000/studio](http://localhost:3000/studio)
- Generate or refresh all card graphics:
  - `npm run cards:art`
- Output folder:
  - `client/assets/cards/`
- The browser UI automatically uses the generated SVG for hand cards and the deck library.

The studio is a local production workspace for the next pass: tune shared art direction, copy per-card AI prompts, import generated art for review, track approval status, and export a JSON art brief for batch generation.

## Internet-Deployment Readiness

The architecture is ready to move to a hosted Node process later because:

- the server is the source of truth
- the client sends intents only
- hidden information is serialized per player
- reconnect uses stable `playerId` plus `reconnectToken`
- host and port come from environment variables

## Current Limitations

- reconnect persistence is browser-local convenience only and is not a full account system
- room state is currently in-memory, so restarting the Node process clears active games
- production internet deployment will still need TLS, a process host, and durable session/state strategy if you want restart survival
