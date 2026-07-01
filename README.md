# Dealership Wars Multiplayer

This workspace now contains a real client/server multiplayer architecture for Dealership Wars:

- `client/` browser UI rendered from server-sent state
- `server/` authoritative room, seat, reconnect, and WebSocket handling
- `shared/` pure game engine, rules, and serialization helpers
- `tests/` lightweight validation for room flow and rules enforcement

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
