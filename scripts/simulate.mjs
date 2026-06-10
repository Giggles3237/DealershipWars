// Headless smoke test: plays full games against the Zustand store with a
// naive "play the first valid target" bot and checks core invariants.
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, logLevel: 'error' });
const storeModule = await server.ssrLoadModule('/src/game/store.js');
const rulesModule = await server.ssrLoadModule('/src/game/rules.js');

const { useGame, getCardTargets, canPlayAnything } = storeModule;
const { DEAL_STATUS } = rulesModule;

function countCards(state) {
  let total = state.deck.length + state.discard.length;

  state.players.forEach((player) => {
    total += player.hand.length;
  });

  state.teams.forEach((team) => {
    team.slots.forEach((deal) => {
      if (deal) {
        total += ['client', 'vehicle', 'employee'].filter((role) => deal[role]).length;
        total += deal.events.length;
      }
    });
  });

  if (state.reaction) {
    total += 1;
  }

  return total;
}

function assert(condition, message, state) {
  if (!condition) {
    console.error('FAIL:', message);
    if (state) {
      console.error('turn', state.turnNumber, 'phase', state.phase);
    }
    process.exit(1);
  }
}

let totalDeliveries = 0;
let totalSabotages = 0;
let principals = 0;
let audits = 0;

for (let run = 0; run < 50; run += 1) {
  const game = useGame.getState();
  game.startGame();

  let safety = 0;

  while (useGame.getState().phase !== 'gameover' && safety < 2000) {
    safety += 1;
    const state = useGame.getState();

    if (state.reaction) {
      // Alternate between auditing and allowing to exercise both paths.
      if (run % 2 === 0) {
        state.respondWithAudit();
        audits += 1;
      } else {
        state.allowDealerPrincipal();
      }
      continue;
    }

    if (state.phase === 'pass') {
      state.revealTurn();
      continue;
    }

    if (state.phase !== 'turn') {
      break;
    }

    if (!state.hasDrawn) {
      state.drawCard();
      continue;
    }

    if (!state.hasPlayed) {
      const player = state.players[state.activePlayerIndex];
      let played = false;

      for (const card of player.hand) {
        const targets = getCardTargets(state, state.activePlayerIndex, card);

        if (!targets.length) {
          continue;
        }

        const target = targets[Math.floor(Math.random() * targets.length)];

        if (['Client', 'Vehicle', 'Employee'].includes(card.category)) {
          state.playCardToSlot(card.id, target.slotIndex);
        } else {
          if (card.effect === 'dealerPrincipal') {
            principals += 1;
          }
          if (['ghostLead', 'stealClient', 'employeeQuits', 'badSurvey', 'chargeback', 'recall'].includes(card.effect)) {
            totalSabotages += 1;
          }
          state.playEvent(card.id, target.type === 'auto' ? null : { teamId: target.teamId, slotIndex: target.slotIndex });
        }

        played = true;
        break;
      }

      if (played) {
        const after = useGame.getState();
        assert(after.hasPlayed || after.phase === 'gameover', 'play action should set hasPlayed', after);
        continue;
      }

      assert(!canPlayAnything(state, state.activePlayerIndex), 'bot found nothing but store says playable exists', state);
    }

    const before = useGame.getState();
    before.endTurn();
    const after = useGame.getState();
    assert(after !== before || after.phase === 'gameover', 'endTurn should advance', after);

    // Card conservation: every card stays accounted for across all zones.
    assert(countCards(after) === 54, `card count drifted: ${countCards(after)}`, after);
  }

  const final = useGame.getState();
  assert(final.phase === 'gameover', `game ${run} did not finish (safety=${safety})`, final);
  assert(final.winnerTeamId, 'game over should have a winner or tie', final);

  final.teams.forEach((team) => {
    totalDeliveries += team.deliveredCount;
    team.slots.forEach((deal) => {
      if (deal) {
        assert([DEAL_STATUS.BUILDING, DEAL_STATUS.PENDING].includes(deal.status), 'slots only hold live deals', final);
      }
    });
  });
}

console.log('OK: 50 simulated games completed.');
console.log(`deliveries=${totalDeliveries} sabotages=${totalSabotages} dealerPrincipals=${principals} audits=${audits}`);

await server.close();
process.exit(0);
