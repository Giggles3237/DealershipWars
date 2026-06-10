import { create } from 'zustand';
import cardsData from '../data/cards.json';
import {
  DEAL_SLOTS_PER_TEAM,
  DEAL_STATUS,
  PLAYERS_PER_GAME,
  PLAYER_SEATS,
  STARTING_HAND_SIZE,
  TEAM_CONFIG,
  WINNING_PROFIT,
  calculateDealProfit,
  getDealProtection,
  getOpponentTeamId,
  getTeamByPlayerIndex,
  isDealComplete,
  shuffle
} from './rules';

let fxCounter = 0;
let dealCounter = 0;

function pushFx(fxList, type, payload = {}) {
  fxCounter += 1;
  fxList.push({ id: fxCounter, type, ...payload });
}

function createDeck() {
  return shuffle(
    cardsData.cards.map((card, index) => ({
      ...card,
      id: `card-${index + 1}-${card.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
    }))
  );
}

function createDeal(slotIndex, teamId, ownerPlayerId) {
  dealCounter += 1;

  return {
    id: `deal-${dealCounter}`,
    slotIndex,
    teamId,
    ownerPlayerId,
    client: null,
    vehicle: null,
    employee: null,
    events: [],
    status: DEAL_STATUS.BUILDING,
    pendingSinceTurn: null,
    vehiclePenalty: 0,
    protectionUsed: false
  };
}

function cloneDeal(deal) {
  return deal ? { ...deal, events: [...deal.events] } : null;
}

function cloneTeams(teams) {
  return teams.map((team) => ({ ...team, slots: team.slots.map(cloneDeal) }));
}

function clonePlayers(players) {
  return players.map((player) => ({ ...player, hand: [...player.hand] }));
}

function dealLabel(team, slotIndex) {
  return `${team.slotPrefix || team.shortName.slice(-1)}${slotIndex + 1}`;
}

function getDealName(deal) {
  return deal.client?.name || deal.vehicle?.name || 'a deal';
}

function discardDealCards(deal, discard) {
  ['client', 'vehicle', 'employee'].forEach((role) => {
    if (deal[role]) {
      discard.push(deal[role]);
    }
  });
  discard.push(...deal.events);
}

function refreshDealStatus(deal, turnNumber, fxList) {
  if (!deal) {
    return;
  }

  if (isDealComplete(deal) && deal.status === DEAL_STATUS.BUILDING) {
    deal.status = DEAL_STATUS.PENDING;
    deal.pendingSinceTurn = turnNumber;
    pushFx(fxList, 'status', { teamId: deal.teamId, slotIndex: deal.slotIndex, status: DEAL_STATUS.PENDING });
  } else if (!isDealComplete(deal) && deal.status === DEAL_STATUS.PENDING) {
    deal.status = DEAL_STATUS.BUILDING;
    deal.pendingSinceTurn = null;
    pushFx(fxList, 'status', { teamId: deal.teamId, slotIndex: deal.slotIndex, status: DEAL_STATUS.BUILDING });
  }
}

function deliverDeal(teams, players, discard, teamId, slotIndex, fxList, log, reason) {
  const team = teams.find((entry) => entry.id === teamId);
  const deal = team.slots[slotIndex];

  if (!deal) {
    return 0;
  }

  const profit = calculateDealProfit(deal);
  const total = profit ? profit.total : 0;

  team.profit += total;
  team.lastDeliveredProfit = total;
  team.deliveredCount += 1;
  team.slots[slotIndex] = null;

  if (deal.events.some((card) => card.name === 'Customer For Life') && deal.client) {
    const owner = players.find((player) => player.id === deal.ownerPlayerId);

    if (owner) {
      owner.hand.push({ ...deal.client });
      log.push(`Customer For Life: ${deal.client.name} returns to ${owner.name}'s hand.`);
      const clientCard = deal.client;
      deal.client = null;
      discardDealCards(deal, discard);
      deal.client = clientCard;
      pushFx(fxList, 'deliver', { teamId, slotIndex, profit: total, dealName: getDealName(deal), reason });
      return total;
    }
  }

  discardDealCards(deal, discard);
  pushFx(fxList, 'deliver', { teamId, slotIndex, profit: total, dealName: getDealName(deal), reason });
  return total;
}

function applyServiceAdvisorPassive(teams, fxList, log) {
  teams.forEach((team) => {
    const hasAdvisor = team.slots.some((deal) => deal?.employee?.passive === 'eventProfit');

    if (hasAdvisor) {
      team.profit += 1;
      pushFx(fxList, 'profit', { teamId: team.id, amount: 1 });
      log.push(`Service Advisor upsells: ${team.name} gains +1 profit.`);
    }
  });
}

function checkProfitWin(state) {
  const winner = state.teams.find((team) => team.profit >= WINNING_PROFIT);

  if (winner && !state.winnerTeamId) {
    state.winnerTeamId = winner.id;
    state.phase = 'gameover';
    state.log.push(`${winner.name} hits ${winner.profit} profit. The store is closed. They win!`);
    pushFx(state.fx, 'win', { teamId: winner.id });
  }
}

function findStealDestination(team) {
  const slotIndex = team.slots.findIndex((deal) => deal && !deal.client);
  return slotIndex >= 0 ? slotIndex : -1;
}

export function getCardTargets(state, playerIndex, card) {
  const player = state.players[playerIndex];
  const team = state.teams.find((entry) => entry.id === player.teamId);
  const opponent = state.teams.find((entry) => entry.id === getOpponentTeamId(player.teamId));
  const targets = [];

  const ownSlot = (slotIndex, label) => ({
    type: 'slot',
    teamId: team.id,
    slotIndex,
    label
  });
  const opponentSlot = (slotIndex, label) => ({
    type: 'slot',
    teamId: opponent.id,
    slotIndex,
    label
  });

  if (card.category === 'Client' || card.category === 'Vehicle') {
    const role = card.category === 'Client' ? 'client' : 'vehicle';

    team.slots.forEach((deal, slotIndex) => {
      if (!deal) {
        targets.push(ownSlot(slotIndex, `Start deal in slot ${dealLabel(team, slotIndex)}`));
      } else if (!deal[role]) {
        targets.push(ownSlot(slotIndex, `Add to ${dealLabel(team, slotIndex)} (${getDealName(deal)})`));
      }
    });

    return targets;
  }

  if (card.category === 'Employee') {
    team.slots.forEach((deal, slotIndex) => {
      if (deal && !deal.employee) {
        targets.push(ownSlot(slotIndex, `Work deal ${dealLabel(team, slotIndex)} (${getDealName(deal)})`));
      }
    });

    return targets;
  }

  if (card.effect === 'dealerPrincipal') {
    team.slots.forEach((deal, slotIndex) => {
      if (deal?.client && deal?.vehicle) {
        targets.push(ownSlot(slotIndex, `Force ${dealLabel(team, slotIndex)} (${getDealName(deal)}) through`));
      }
    });

    return targets;
  }

  if (card.effect === 'manufacturerAudit') {
    return [];
  }

  if (card.effect === 'attach') {
    team.slots.forEach((deal, slotIndex) => {
      if (deal) {
        targets.push(ownSlot(slotIndex, `Attach to ${dealLabel(team, slotIndex)} (${getDealName(deal)})`));
      }
    });

    return targets;
  }

  if (card.effect === 'rushDelivery') {
    team.slots.forEach((deal, slotIndex) => {
      if (deal?.status === DEAL_STATUS.PENDING) {
        targets.push(ownSlot(slotIndex, `Deliver ${dealLabel(team, slotIndex)} (${getDealName(deal)}) now`));
      }
    });

    return targets;
  }

  if (card.effect === 'ghostLead' || card.effect === 'stealClient') {
    opponent.slots.forEach((deal, slotIndex) => {
      if (deal?.client) {
        targets.push(opponentSlot(slotIndex, `Target ${dealLabel(opponent, slotIndex)} (${deal.client.name})`));
      }
    });

    return targets;
  }

  if (card.effect === 'employeeQuits') {
    opponent.slots.forEach((deal, slotIndex) => {
      if (deal?.employee) {
        targets.push(opponentSlot(slotIndex, `Target ${dealLabel(opponent, slotIndex)} (${deal.employee.name})`));
      }
    });

    return targets;
  }

  // Team-wide or untargeted events are always playable.
  return [{ type: 'auto', label: `Play ${card.name}` }];
}

export function canPlayAnything(state, playerIndex) {
  return state.players[playerIndex].hand.some((card) => getCardTargets(state, playerIndex, card).length > 0);
}

function createInitialState() {
  const deck = createDeck();
  let cursor = 0;

  const players = Array.from({ length: PLAYERS_PER_GAME }, (_, index) => {
    const hand = deck.slice(cursor, cursor + STARTING_HAND_SIZE);
    cursor += STARTING_HAND_SIZE;

    return {
      id: `player-${index + 1}`,
      name: PLAYER_SEATS[index].name,
      persona: PLAYER_SEATS[index].persona,
      seat: PLAYER_SEATS[index].seat,
      teamId: getTeamByPlayerIndex(index).id,
      hand
    };
  });

  const teams = TEAM_CONFIG.map((team) => ({
    ...team,
    profit: 0,
    deliveredCount: 0,
    lastDeliveredProfit: 0,
    slots: Array.from({ length: DEAL_SLOTS_PER_TEAM }, () => null)
  }));

  return {
    players,
    teams,
    deck: deck.slice(cursor),
    discard: [],
    activePlayerIndex: 0,
    turnNumber: 1,
    phase: 'title',
    hasDrawn: false,
    hasPlayed: false,
    reaction: null,
    winnerTeamId: null,
    inspectedCard: null,
    log: ['Two stores. One market. May the best dealership win.'],
    fx: []
  };
}

export const useGame = create((set, get) => ({
  ...createInitialState(),

  startGame() {
    fxCounter = 0;
    dealCounter = 0;
    set({ ...createInitialState(), phase: 'pass' });
  },

  // Tap any card on the table (or in hand) to read it full size.
  inspectCard(card) {
    set({ inspectedCard: card });
  },

  clearInspected() {
    set({ inspectedCard: null });
  },

  revealTurn() {
    set((state) => {
      if (state.phase !== 'pass') {
        return state;
      }

      const players = clonePlayers(state.players);
      const teams = cloneTeams(state.teams);
      const discard = [...state.discard];
      const fxList = [...state.fx];
      const log = [...state.log];
      const player = players[state.activePlayerIndex];
      const team = teams.find((entry) => entry.id === player.teamId);

      pushFx(fxList, 'turn', { playerIndex: state.activePlayerIndex });

      // Delivery timer: pending deals that survived since the team's previous turn deliver now.
      team.slots.forEach((deal, slotIndex) => {
        if (deal?.status === DEAL_STATUS.PENDING && deal.pendingSinceTurn < state.turnNumber) {
          const total = deliverDeal(teams, players, discard, team.id, slotIndex, fxList, log, 'survived');
          log.push(`${team.name} delivers ${dealLabel(team, slotIndex)} for ${total} profit!`);
        }
      });

      const next = {
        ...state,
        players,
        teams,
        discard,
        fx: fxList.slice(-40),
        log: log.slice(-30),
        phase: 'turn'
      };

      checkProfitWin(next);
      return next;
    });
  },

  drawCard() {
    set((state) => {
      if (state.phase !== 'turn' || state.hasDrawn || state.reaction) {
        return state;
      }

      const players = clonePlayers(state.players);
      const player = players[state.activePlayerIndex];
      const deck = [...state.deck];
      const fxList = [...state.fx];
      const log = [...state.log];

      if (deck.length) {
        player.hand.push(deck.shift());
        pushFx(fxList, 'draw', { playerIndex: state.activePlayerIndex });
        log.push(`${player.name} draws a card.`);
      } else {
        log.push(`The deck is empty. ${player.name} draws nothing.`);
      }

      return { ...state, players, deck, hasDrawn: true, fx: fxList.slice(-40), log: log.slice(-30) };
    });
  },

  playCardToSlot(cardId, slotIndex) {
    set((state) => {
      if (state.phase !== 'turn' || !state.hasDrawn || state.hasPlayed || state.reaction) {
        return state;
      }

      const players = clonePlayers(state.players);
      const teams = cloneTeams(state.teams);
      const player = players[state.activePlayerIndex];
      const team = teams.find((entry) => entry.id === player.teamId);
      const card = player.hand.find((entry) => entry.id === cardId);
      const fxList = [...state.fx];
      const log = [...state.log];
      let deck = state.deck;

      if (!card || !['Client', 'Vehicle', 'Employee'].includes(card.category)) {
        return state;
      }

      let deal = team.slots[slotIndex];

      if (!deal) {
        if (card.category === 'Employee') {
          return state;
        }

        deal = createDeal(slotIndex, team.id, player.id);
        team.slots[slotIndex] = deal;
      }

      const role = card.category.toLowerCase();

      if (deal[role]) {
        return state;
      }

      player.hand = player.hand.filter((entry) => entry.id !== cardId);
      deal[role] = card;
      pushFx(fxList, 'playToSlot', {
        playerIndex: state.activePlayerIndex,
        card: { name: card.name, category: card.category },
        teamId: team.id,
        slotIndex
      });
      log.push(`${player.name} plays ${card.name} to deal ${dealLabel(team, slotIndex)}.`);

      if (card.effect === 'porterDraw' && deck.length) {
        deck = [...deck];
        player.hand.push(deck.shift());
        pushFx(fxList, 'draw', { playerIndex: state.activePlayerIndex });
        log.push(`The Porter hustles: ${player.name} draws an extra card.`);
      }

      if (card.effect === 'bdcFetch') {
        const clientIndex = deck.findIndex((entry) => entry.category === 'Client');

        if (clientIndex >= 0) {
          deck = [...deck];
          const [found] = deck.splice(clientIndex, 1);
          player.hand.push(found);
          pushFx(fxList, 'draw', { playerIndex: state.activePlayerIndex });
          log.push(`BDC Agent sets an appointment: ${player.name} finds ${found.name}.`);
        }
      }

      refreshDealStatus(deal, state.turnNumber, fxList);

      if (deal.status === DEAL_STATUS.PENDING && deal.pendingSinceTurn === state.turnNumber) {
        log.push(`Deal ${dealLabel(team, slotIndex)} is pending delivery. It must survive one table rotation!`);
      }

      const next = {
        ...state,
        players,
        teams,
        deck,
        hasPlayed: true,
        fx: fxList.slice(-40),
        log: log.slice(-30)
      };

      return next;
    });
  },

  playEvent(cardId, target) {
    set((state) => {
      if (state.phase !== 'turn' || !state.hasDrawn || state.hasPlayed || state.reaction) {
        return state;
      }

      const players = clonePlayers(state.players);
      const teams = cloneTeams(state.teams);
      const player = players[state.activePlayerIndex];
      const team = teams.find((entry) => entry.id === player.teamId);
      const opponent = teams.find((entry) => entry.id === getOpponentTeamId(player.teamId));
      const card = player.hand.find((entry) => entry.id === cardId);
      const fxList = [...state.fx];
      const log = [...state.log];
      let deck = state.deck;
      const discard = [...state.discard];

      if (!card || (card.category !== 'Event' && card.effect !== 'dealerPrincipal')) {
        return state;
      }

      if (card.effect === 'manufacturerAudit') {
        log.push('Manufacturer Audit can only be played in response to a Dealer Principal.');
        return { ...state, log: log.slice(-30) };
      }

      player.hand = player.hand.filter((entry) => entry.id !== cardId);

      // Dealer Principal opens a reaction window for the opposing team before resolving.
      if (card.effect === 'dealerPrincipal') {
        pushFx(fxList, 'dealerPrincipal', { playerIndex: state.activePlayerIndex });
        log.push(`${player.name} SLAMS the Dealer Principal on the table. "I've made my decision."`);

        return {
          ...state,
          players,
          teams,
          hasPlayed: true,
          reaction: {
            card,
            playerIndex: state.activePlayerIndex,
            teamId: team.id,
            respondingTeamId: opponent.id,
            slotIndex: target.slotIndex
          },
          fx: fxList.slice(-40),
          log: log.slice(-30)
        };
      }

      const effect = card.effect;
      let cardToDiscard = card;

      if (effect === 'badSurvey') {
        opponent.profit -= 5;
        pushFx(fxList, 'badSurvey', { playerIndex: state.activePlayerIndex, teamId: opponent.id });
        log.push(`${player.name} plants a one-star review. ${opponent.name} loses 5 profit.`);
      } else if (effect === 'chargeback') {
        if (opponent.lastDeliveredProfit > 0) {
          const penalty = Math.max(5, Math.floor(opponent.lastDeliveredProfit / 2));
          opponent.profit -= penalty;
          opponent.lastDeliveredProfit = 0;
          pushFx(fxList, 'chargeback', { playerIndex: state.activePlayerIndex, teamId: opponent.id, amount: penalty });
          log.push(`Chargeback! ${opponent.name} loses ${penalty} profit.`);
        } else {
          log.push(`${player.name} files a Chargeback, but ${opponent.name} has no recent delivery. It fizzles.`);
        }
      } else if (effect === 'recall') {
        let hit = 0;

        opponent.slots.forEach((deal) => {
          if (deal?.vehicle) {
            const protection = getDealProtection(deal);

            if (protection.vehicle || protection.sabotage) {
              if (deal.employee?.protects === 'all') {
                deal.protectionUsed = true;
              }
              return;
            }

            deal.vehiclePenalty += 2;
            hit += 1;
          }
        });

        pushFx(fxList, 'recall', { playerIndex: state.activePlayerIndex, teamId: opponent.id });
        log.push(
          hit
            ? `Recall Campaign! ${hit} of ${opponent.name}'s vehicles lose 2 value.`
            : `Recall Campaign hits, but ${opponent.name}'s lot is covered. No effect.`
        );
      } else if (effect === 'employeeQuits') {
        const deal = opponent.slots[target.slotIndex];

        if (deal?.employee) {
          const protection = getDealProtection(deal);

          if (protection.sabotage) {
            if (deal.employee?.protects === 'all') {
              deal.protectionUsed = true;
            }
            pushFx(fxList, 'blocked', { teamId: opponent.id, slotIndex: target.slotIndex });
            log.push(`${player.name} tries to poach, but deal ${dealLabel(opponent, target.slotIndex)} is protected.`);
          } else {
            discard.push(deal.employee);
            log.push(`${deal.employee.name} quits ${opponent.name} mid-deal! Box of desk stuff and everything.`);
            deal.employee = null;
            pushFx(fxList, 'employeeQuits', { teamId: opponent.id, slotIndex: target.slotIndex });
            refreshDealStatus(deal, state.turnNumber, fxList);
          }
        }
      } else if (effect === 'ghostLead') {
        const deal = opponent.slots[target.slotIndex];

        if (deal?.client) {
          const protection = getDealProtection(deal);

          if (protection.client || protection.sabotage) {
            if (deal.employee?.protects === 'all') {
              deal.protectionUsed = true;
            }
            pushFx(fxList, 'blocked', { teamId: opponent.id, slotIndex: target.slotIndex });
            log.push(`${deal.client.name} almost ghosted, but deal ${dealLabel(opponent, target.slotIndex)} was protected.`);
          } else {
            discardDealCards(deal, discard);
            opponent.slots[target.slotIndex] = null;
            pushFx(fxList, 'destroy', {
              teamId: opponent.id,
              slotIndex: target.slotIndex,
              dealName: deal.client.name,
              kind: 'ghost'
            });
            log.push(`${deal.client.name} ghosts ${opponent.name}. Deal ${dealLabel(opponent, target.slotIndex)} collapses!`);
          }
        }
      } else if (effect === 'stealClient') {
        const deal = opponent.slots[target.slotIndex];

        if (deal?.client) {
          const protection = getDealProtection(deal);

          if (protection.client || protection.sabotage) {
            if (deal.employee?.protects === 'all') {
              deal.protectionUsed = true;
            }
            pushFx(fxList, 'blocked', { teamId: opponent.id, slotIndex: target.slotIndex });
            log.push(`${deal.client.name} takes the call but stays put. Deal was protected.`);
          } else {
            const stolen = deal.client;
            deal.client = null;
            refreshDealStatus(deal, state.turnNumber, fxList);

            const destination = findStealDestination(team);

            if (destination >= 0) {
              team.slots[destination].client = stolen;
              refreshDealStatus(team.slots[destination], state.turnNumber, fxList);
              pushFx(fxList, 'steal', {
                fromTeamId: opponent.id,
                fromSlot: target.slotIndex,
                toTeamId: team.id,
                toSlot: destination,
                cardName: stolen.name
              });
              log.push(`${stolen.name} walks across the table to ${team.name}'s deal ${dealLabel(team, destination)}!`);
            } else {
              player.hand.push(stolen);
              pushFx(fxList, 'steal', {
                fromTeamId: opponent.id,
                fromSlot: target.slotIndex,
                toTeamId: team.id,
                toSlot: -1,
                cardName: stolen.name
              });
              log.push(`${stolen.name} defects to ${team.name} and waits in ${player.name}'s hand.`);
            }
          }
        }
      } else if (effect === 'attach') {
        const deal = team.slots[target.slotIndex];

        if (deal) {
          deal.events.push(card);
          cardToDiscard = null;
          pushFx(fxList, 'attach', {
            teamId: team.id,
            slotIndex: target.slotIndex,
            cardName: card.name
          });
          log.push(`${player.name} attaches ${card.name} to deal ${dealLabel(team, target.slotIndex)}.`);
        }
      } else if (effect === 'rushDelivery') {
        const deal = team.slots[target.slotIndex];

        if (deal?.status === DEAL_STATUS.PENDING) {
          const total = deliverDeal(teams, players, discard, team.id, target.slotIndex, fxList, log, 'rush');
          log.push(`End-of-Month Rush! ${team.name} delivers ${dealLabel(team, target.slotIndex)} for ${total} profit.`);
        }
      } else if (effect === 'instantProfit') {
        team.profit += card.value;
        pushFx(fxList, 'profit', { teamId: team.id, amount: card.value });
        log.push(`${player.name} plays ${card.name}: ${team.name} gains ${card.value} profit.`);
      } else if (effect === 'massiveTrade') {
        deck = [...deck];
        const kept = [];
        const tossed = [];

        while (deck.length && kept.length < 3) {
          const next = deck.shift();

          if (next.category === 'Vehicle') {
            kept.push(next);
          } else {
            tossed.push(next);
          }
        }

        player.hand.push(...kept);
        discard.push(...tossed);
        pushFx(fxList, 'draw', { playerIndex: state.activePlayerIndex });
        log.push(`Massive Trade! ${player.name} pulls ${kept.length} vehicle(s) out of the deck.`);
      }

      if (cardToDiscard) {
        discard.push(cardToDiscard);
      }

      pushFx(fxList, 'eventPlayed', {
        playerIndex: state.activePlayerIndex,
        cardName: card.name,
        category: card.category
      });

      applyServiceAdvisorPassive(teams, fxList, log);

      const next = {
        ...state,
        players,
        teams,
        deck,
        discard,
        hasPlayed: true,
        fx: fxList.slice(-40),
        log: log.slice(-30)
      };

      checkProfitWin(next);
      return next;
    });
  },

  // The responding team chose to attempt a Manufacturer Audit.
  respondWithAudit() {
    set((state) => {
      if (!state.reaction) {
        return state;
      }

      const players = clonePlayers(state.players);
      const teams = cloneTeams(state.teams);
      const discard = [...state.discard];
      const fxList = [...state.fx];
      const log = [...state.log];
      const { reaction } = state;

      const responder = players.find(
        (player) => player.teamId === reaction.respondingTeamId && player.hand.some((card) => card.effect === 'manufacturerAudit')
      );

      if (!responder) {
        log.push('Nobody on the team is holding a Manufacturer Audit. The decision stands.');
        return resolveDealerPrincipal({ ...state, players, teams, discard, fx: fxList, log });
      }

      const audit = responder.hand.find((card) => card.effect === 'manufacturerAudit');
      responder.hand = responder.hand.filter((card) => card.id !== audit.id);
      discard.push(audit, reaction.card);

      pushFx(fxList, 'audit', { playerIndex: players.indexOf(responder) });
      log.push(`${responder.name} slams the Manufacturer Audit. "We have concerns." Dealer Principal is CANCELED.`);

      return {
        ...state,
        players,
        teams,
        discard,
        reaction: null,
        fx: fxList.slice(-40),
        log: log.slice(-30)
      };
    });
  },

  allowDealerPrincipal() {
    set((state) => {
      if (!state.reaction) {
        return state;
      }

      return resolveDealerPrincipal({
        ...state,
        players: clonePlayers(state.players),
        teams: cloneTeams(state.teams),
        discard: [...state.discard],
        fx: [...state.fx],
        log: [...state.log]
      });
    });
  },

  endTurn() {
    set((state) => {
      if (state.phase !== 'turn' || !state.hasDrawn || state.reaction) {
        return state;
      }

      if (!state.hasPlayed && canPlayAnything(state, state.activePlayerIndex)) {
        return state;
      }

      const fxList = [...state.fx];
      const log = [...state.log];
      const nextPlayerIndex = (state.activePlayerIndex + 1) % state.players.length;
      const next = {
        ...state,
        activePlayerIndex: nextPlayerIndex,
        turnNumber: state.turnNumber + 1,
        hasDrawn: false,
        hasPlayed: false,
        phase: 'pass',
        fx: fxList.slice(-40),
        log: log.slice(-30)
      };

      // Deck exhausted and nothing can resolve anymore: highest profit wins.
      const noPending = state.teams.every((team) => team.slots.every((deal) => deal?.status !== DEAL_STATUS.PENDING));
      const anyoneCanPlay = state.players.some((_, playerIndex) => canPlayAnything(state, playerIndex));

      if (!state.deck.length && !anyoneCanPlay && noPending && !state.winnerTeamId) {
        const [teamA, teamB] = state.teams;
        next.phase = 'gameover';

        if (teamA.profit === teamB.profit) {
          next.winnerTeamId = 'tie';
          next.log = [...log, 'The deck is gone, the deals are done, and it ends in a dead heat. A tie!'].slice(-30);
        } else {
          const winner = teamA.profit > teamB.profit ? teamA : teamB;
          next.winnerTeamId = winner.id;
          next.log = [...log, `Deck exhausted. ${winner.name} wins with ${winner.profit} profit.`].slice(-30);
          pushFx(next.fx, 'win', { teamId: winner.id });
        }

        return next;
      }

      next.log = [...next.log, `${state.players[nextPlayerIndex].name} is up. Pass the device!`].slice(-30);
      return next;
    });
  },

  getTargetsForCard(cardId) {
    const state = get();
    const player = state.players[state.activePlayerIndex];
    const card = player.hand.find((entry) => entry.id === cardId);

    if (!card) {
      return [];
    }

    return getCardTargets(state, state.activePlayerIndex, card);
  }
}));

// Handy for debugging and headless UI tests.
if (typeof window !== 'undefined') {
  window.__game = useGame;
}

function resolveDealerPrincipal(state) {
  const { reaction } = state;
  const team = state.teams.find((entry) => entry.id === reaction.teamId);
  const deal = team.slots[reaction.slotIndex];
  const fxList = state.fx;
  const log = state.log;

  state.discard.push(reaction.card);

  if (deal) {
    // PRD: the chosen deal becomes immune and delivers instantly.
    const total = deliverDeal(state.teams, state.players, state.discard, team.id, reaction.slotIndex, fxList, log, 'principal');
    log.push(`The Dealer Principal forces it through. ${team.name} delivers instantly for ${total} profit!`);
  } else {
    log.push('The Dealer Principal points at an empty desk. Awkward. Nothing delivers.');
  }

  const next = {
    ...state,
    reaction: null,
    fx: fxList.slice(-40),
    log: log.slice(-30)
  };

  checkProfitWin(next);
  return next;
}
