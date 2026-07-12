import {
  BASE_CUSTOMER_CAP,
  BASE_HAND_LIMIT,
  BASE_PLAYS_PER_TURN,
  CARDS_DRAWN_PER_TURN,
  CASH_TARGET,
  MAX_LOG,
  MAX_TURNS,
  OPENING_HAND_SIZE,
  SALES_TEAM_CAP,
  SEAT_CONFIG
} from "./constants.js";
import { baseCards, cloneDeck, getNumericCardValue, shuffleCards } from "./cards.js";
import { serializePrivateView, serializePublicState, stableStringify } from "./game-serialization.js";

const sabotageNames = new Set(baseCards.filter((card) => card.type === "Sabotage").map((card) => card.name));

const cloneState = (state) => structuredClone(state);
const getPlayer = (state, playerId) => state.players.find((player) => player.id === playerId);
const getCurrentPlayer = (state) => getPlayer(state, state.currentPlayerId);
const getRivals = (state, player) => state.players.filter((entry) => entry.id !== player.id);
const cardLabel = (card) => `${card.name} (${card.type})`;

const pushLog = (state, message) => {
  state.log.unshift(message);
  state.log = state.log.slice(0, MAX_LOG);
};

const reshuffleDiscardIntoDeck = (state) => {
  if (state.deck.length || !state.discard.length) {
    return;
  }
  state.deck = shuffleCards(state.discard);
  state.discard = [];
  pushLog(state, "The discard pile was shuffled back into the deck.");
};

const drawCards = (state, player, count) => {
  const drawn = [];
  for (let index = 0; index < count; index += 1) {
    reshuffleDiscardIntoDeck(state);
    if (!state.deck.length) {
      break;
    }
    const card = state.deck.shift();
    player.hand.push(card);
    drawn.push(card);
  }
  return drawn;
};

const discardCards = (state, cards) => {
  cards.filter(Boolean).forEach((card) => state.discard.unshift(card));
};

const removeLowestValueCards = (state, player, count) => {
  const removed = [];
  for (let index = 0; index < count; index += 1) {
    if (!player.hand.length) {
      break;
    }
    let lowestIndex = 0;
    player.hand.forEach((card, cardIndex) => {
      if (getNumericCardValue(card) < getNumericCardValue(player.hand[lowestIndex])) {
        lowestIndex = cardIndex;
      }
    });
    const [card] = player.hand.splice(lowestIndex, 1);
    removed.push(card);
  }
  discardCards(state, removed);
  return removed;
};

const salesTeamAmount = (player, passive) =>
  player.salespeople
    .filter((card) => card.passive === passive)
    .reduce((total, card) => total + (card.amount ?? 0), 0);

const repTierBonus = (player) => (player.reputation >= 8 ? 2 : player.reputation >= 4 ? 1 : 0);

const saleComboBonus = (customer, vehicle) =>
  (customer.wants ?? []).some((tag) => (vehicle.tags ?? []).includes(tag)) ? 2 : 0;

const computeSaleValue = (player, customer, vehicle) =>
  (vehicle.profit ?? 0) +
  (customer.bonus ?? 0) +
  saleComboBonus(customer, vehicle) +
  player.carBonus +
  salesTeamAmount(player, "on-sale-cash") +
  repTierBonus(player);

const gainCash = (state, player, amount, reason) => {
  if (!amount) {
    return;
  }
  player.cash = Math.max(0, player.cash + amount);
  pushLog(state, `${player.name} ${amount >= 0 ? "gained" : "lost"} ${Math.abs(amount)} cash. ${reason}`);
  checkForWinner(state);
};

const gainRep = (state, player, amount, reason) => {
  if (!amount) {
    return;
  }
  player.reputation = Math.max(0, player.reputation + amount);
  pushLog(state, `${player.name} ${amount >= 0 ? "gained" : "lost"} ${Math.abs(amount)} reputation. ${reason}`);
};

const bestCustomerIndex = (customers) => {
  let best = -1;
  customers.forEach((customer, index) => {
    if (best === -1 || (customer.bonus ?? 0) > (customers[best].bonus ?? 0)) {
      best = index;
    }
  });
  return best;
};

const worstCustomerIndex = (customers) => {
  let worst = -1;
  customers.forEach((customer, index) => {
    if (worst === -1 || (customer.bonus ?? 0) < (customers[worst].bonus ?? 0)) {
      worst = index;
    }
  });
  return worst;
};

const checkForWinner = (state) => {
  if (state.winner) {
    return;
  }
  const champion = state.players.find((player) => player.cash >= CASH_TARGET);
  if (champion) {
    state.status = "finished";
    state.winner = {
      playerId: champion.id,
      name: champion.name,
      reason: `${champion.name} banked ${champion.cash} cash and owns the market.`
    };
  }
};

const finishByTurnLimit = (state) => {
  const ranked = [...state.players].sort(
    (left, right) => right.cash - left.cash || right.reputation - left.reputation || left.seatIndex - right.seatIndex
  );
  const leader = ranked[0];
  state.status = "finished";
  state.winner = {
    playerId: leader.id,
    name: leader.name,
    reason: `The month closed after ${MAX_TURNS} turns and ${leader.name} finished on top with ${leader.cash} cash.`
  };
};

const normalizeAction = (action) => stableStringify(action);

const resolveEffect = (state, player, effect, cardName) => {
  const rivals = getRivals(state, player);

  switch (effect.kind) {
    case "gain-cash":
      gainCash(state, player, effect.amount, `${cardName} paid off.`);
      return;
    case "gain-rep":
      gainRep(state, player, effect.amount, `${cardName} boosted the brand.`);
      return;
    case "draw": {
      const drawn = drawCards(state, player, effect.amount);
      pushLog(state, `${player.name} drew ${drawn.length} card${drawn.length === 1 ? "" : "s"} from ${cardName}.`);
      return;
    }
    case "self-discard": {
      const removed = removeLowestValueCards(state, player, effect.amount);
      if (removed.length) {
        pushLog(state, `${player.name} discarded ${removed.map((card) => card.name).join(", ")} to ${cardName}.`);
      }
      return;
    }
    case "extra-plays":
      state.actionsRemaining += effect.amount;
      pushLog(state, `${player.name} may play ${effect.amount} additional card${effect.amount === 1 ? "" : "s"} this turn.`);
      return;
    case "raise-hand-limit":
      player.handLimit += effect.amount;
      pushLog(state, `${player.name}'s hand size limit is now ${player.handLimit}.`);
      return;
    case "raise-customer-cap":
      player.customerCap += effect.amount;
      pushLog(state, `${player.name}'s showroom now holds ${player.customerCap} customers.`);
      return;
    case "car-value-bonus":
      player.carBonus += effect.amount;
      pushLog(state, `${player.name}'s cars are now worth ${effect.amount} more when sold.`);
      return;
    case "scry": {
      reshuffleDiscardIntoDeck(state);
      const looked = state.deck.splice(0, effect.amount);
      if (!looked.length) {
        pushLog(state, `${player.name} played ${cardName}, but the deck was empty.`);
        return;
      }
      let keepIndex = 0;
      looked.forEach((card, index) => {
        if (getNumericCardValue(card) > getNumericCardValue(looked[keepIndex])) {
          keepIndex = index;
        }
      });
      const [kept] = looked.splice(keepIndex, 1);
      player.hand.push(kept);
      discardCards(state, looked);
      pushLog(state, `${player.name} used ${cardName} to look at ${looked.length + 1} cards and kept one.`);
      return;
    }
    case "underdog-rep": {
      const behindEveryRival = rivals.length > 0 && rivals.every((rival) => rival.customers.length > player.customers.length);
      if (behindEveryRival) {
        gainRep(state, player, effect.amount, `${cardName} rewarded the underdog.`);
      }
      return;
    }
    case "cash-per-rival-ahead": {
      const ahead = rivals.filter((rival) => rival.customers.length > player.customers.length).length;
      if (ahead > 0) {
        gainCash(state, player, effect.amount * ahead, `${cardName} paid out for ${ahead} bigger rival${ahead === 1 ? "" : "s"}.`);
      } else {
        pushLog(state, `${player.name} played ${cardName}, but no rival has more customers.`);
      }
      return;
    }
    default:
      return;
  }
};

const resolveSabotageEffect = (state, player, target, effect, cardName) => {
  switch (effect.kind) {
    case "lose-rep":
      gainRep(state, target, -effect.amount, `${player.name}'s ${cardName} hit ${target.name}.`);
      return;
    case "lose-cash":
      gainCash(state, target, -effect.amount, `${player.name}'s ${cardName} hit ${target.name}.`);
      return;
    case "rob-hand": {
      if (!target.hand.length) {
        return;
      }
      let bestIndex = 0;
      target.hand.forEach((card, index) => {
        if (getNumericCardValue(card) > getNumericCardValue(target.hand[bestIndex])) {
          bestIndex = index;
        }
      });
      const [stolen] = target.hand.splice(bestIndex, 1);
      discardCards(state, [stolen]);
      pushLog(state, `${player.name}'s ${cardName} forced ${target.name} to discard ${stolen.name}.`);
      return;
    }
    case "lose-best-customer": {
      const index = bestCustomerIndex(target.customers);
      if (index === -1) {
        return;
      }
      const [customer] = target.customers.splice(index, 1);
      discardCards(state, [customer]);
      pushLog(state, `${customer.name} walked out of ${target.name}'s showroom thanks to ${cardName}.`);
      return;
    }
    case "lose-worst-customer": {
      const index = worstCustomerIndex(target.customers);
      if (index === -1) {
        return;
      }
      const [customer] = target.customers.splice(index, 1);
      discardCards(state, [customer]);
      pushLog(state, `${customer.name} walked out of ${target.name}'s showroom thanks to ${cardName}.`);
      return;
    }
    default:
      return;
  }
};

const resolveStealFromEachRival = (state, player, cardName) => {
  getRivals(state, player).forEach((rival) => {
    if (player.customers.length >= player.customerCap) {
      return;
    }
    const index = bestCustomerIndex(rival.customers);
    if (index === -1) {
      return;
    }
    const [customer] = rival.customers.splice(index, 1);
    player.customers.push(customer);
    pushLog(state, `${player.name}'s ${cardName} stole ${customer.name} from ${rival.name}.`);
  });
};

const sabotageEffectApplies = (player, target, effect) => {
  switch (effect.kind) {
    case "lose-rep":
      return target.reputation > 0;
    case "lose-cash":
      return target.cash > 0;
    case "rob-hand":
      return target.hand.length > 0;
    case "lose-best-customer":
    case "lose-worst-customer":
      return target.customers.length > 0;
    default:
      return false;
  }
};

const buildCardActions = (state, player, card) => {
  if (card.type === "Customer") {
    if (player.customers.length >= player.customerCap) {
      return [];
    }
    if ((card.repRequirement ?? 0) > player.reputation) {
      return [];
    }
    return [{ label: "Recruit to showroom", kind: "recruit" }];
  }

  if (card.type === "Vehicle") {
    return [{ label: "Stock on lot", kind: "stock" }];
  }

  if (card.type === "Salesperson") {
    if (player.salespeople.length >= SALES_TEAM_CAP) {
      return [];
    }
    return [{ label: "Hire to sales team", kind: "hire" }];
  }

  if (card.type === "Action") {
    return [{ label: "Play action", kind: "action" }];
  }

  if (card.type === "Sabotage") {
    const effects = card.effects ?? [];
    if (effects.some((effect) => effect.kind === "steal-customer-each")) {
      const canSteal =
        player.customers.length < player.customerCap &&
        getRivals(state, player).some((rival) => rival.customers.length > 0);
      return canSteal ? [{ label: "Raid every rival", kind: "sabotage-all" }] : [];
    }
    return getRivals(state, player)
      .filter((rival) => effects.some((effect) => sabotageEffectApplies(player, rival, effect)))
      .map((rival) => ({
        label: `Target ${rival.name}`,
        kind: "sabotage",
        targetPlayerId: rival.id
      }));
  }

  return [];
};

const buildSaleActions = (state, player) =>
  player.customers.flatMap((customer) =>
    player.vehicles.map((vehicle) => ({
      cardUid: null,
      cardName: "Close Sale",
      cardType: "Sale",
      cardValue: String(computeSaleValue(player, customer, vehicle)),
      action: {
        label: `Sell ${vehicle.name} to ${customer.name} (+${computeSaleValue(player, customer, vehicle)} cash)`,
        kind: "close-sale",
        customerUid: customer.uid,
        vehicleUid: vehicle.uid
      }
    }))
  );

export const createGameState = ({ roomCode, hostPlayerId = null }) => ({
  roomCode,
  hostPlayerId,
  createdAt: new Date().toISOString(),
  startedAt: null,
  status: "lobby",
  turnNumber: 0,
  currentSeatIndex: 0,
  currentPlayerId: null,
  actionsRemaining: 0,
  deck: [],
  discard: [],
  log: [],
  winner: null,
  players: []
});

const freshDealership = () => ({
  cash: 0,
  reputation: 0,
  carBonus: 0,
  handLimit: BASE_HAND_LIMIT,
  customerCap: BASE_CUSTOMER_CAP,
  customers: [],
  salespeople: [],
  vehicles: [],
  salesClosed: 0
});

export const addPlayerToGame = (state, player) => {
  const next = cloneState(state);
  next.players.push({
    id: player.id,
    name: player.name,
    seatIndex: player.seatIndex,
    dealership: SEAT_CONFIG[player.seatIndex].dealership,
    isAi: Boolean(player.isAi),
    personalityId: player.personalityId ?? null,
    ready: Boolean(player.isAi),
    connected: !player.isAi,
    reconnectToken: player.reconnectToken,
    hand: [],
    ...freshDealership()
  });
  if (!next.hostPlayerId) {
    next.hostPlayerId = player.id;
  }
  pushLog(next, `${player.name} took over ${SEAT_CONFIG[player.seatIndex].dealership}${player.isAi ? " as an AI dealer" : ""}.`);
  return next;
};

export const updatePlayerPresence = (state, playerId, connected) => {
  const next = cloneState(state);
  const player = getPlayer(next, playerId);
  if (player) {
    player.connected = connected;
  }
  return next;
};

export const updatePlayerReady = (state, playerId, ready) => {
  const next = cloneState(state);
  const player = getPlayer(next, playerId);
  if (!player) {
    throw new Error("Player not found.");
  }
  if (player.isAi) {
    throw new Error("AI seats are always ready.");
  }
  if (next.status !== "lobby") {
    throw new Error("Game already started.");
  }
  player.ready = ready;
  pushLog(next, `${player.name} is ${ready ? "ready" : "not ready"} in the lobby.`);
  return next;
};

export const canAutoStart = (state) =>
  state.players.length === SEAT_CONFIG.length &&
  SEAT_CONFIG.every((seat) => state.players.some((player) => player.seatIndex === seat.seatIndex)) &&
  state.players.every((player) => player.ready);

export const beginTurn = (inputState) => {
  const state = cloneState(inputState);
  if (state.winner) {
    return state;
  }

  state.turnNumber += 1;
  if (state.turnNumber > MAX_TURNS) {
    finishByTurnLimit(state);
    return state;
  }

  const player = getCurrentPlayer(state);

  const turnCash = salesTeamAmount(player, "turn-cash");
  if (turnCash) {
    gainCash(state, player, turnCash, "The service drive kept humming.");
    if (state.winner) {
      return state;
    }
  }

  const drawCount = CARDS_DRAWN_PER_TURN + salesTeamAmount(player, "turn-draw");
  drawCards(state, player, drawCount);
  state.actionsRemaining = BASE_PLAYS_PER_TURN + salesTeamAmount(player, "extra-play");
  pushLog(state, `${player.name} started a turn, drew ${drawCount} cards, and can play ${state.actionsRemaining} card${state.actionsRemaining === 1 ? "" : "s"}.`);
  return state;
};

export const startGame = (inputState) => {
  const state = cloneState(inputState);
  if (state.status !== "lobby") {
    throw new Error("Game already started.");
  }
  if (!canAutoStart(state)) {
    throw new Error("Four seated, ready players are required.");
  }

  state.status = "active";
  state.startedAt = new Date().toISOString();
  state.deck = cloneDeck();
  state.discard = [];
  state.log = [];
  state.winner = null;
  state.turnNumber = 0;
  state.actionsRemaining = 0;
  state.currentSeatIndex = 0;
  state.currentPlayerId = state.players.find((player) => player.seatIndex === 0)?.id ?? null;

  state.players.forEach((player) => {
    player.hand = [];
    Object.assign(player, freshDealership());
  });

  state.players
    .sort((left, right) => left.seatIndex - right.seatIndex)
    .forEach((player) => drawCards(state, player, OPENING_HAND_SIZE));

  pushLog(state, `A fresh Dealership Wars match has started. First dealership to ${CASH_TARGET} cash wins.`);
  return beginTurn(state);
};

export const buildLegalActions = (state, playerId) => {
  const player = getPlayer(state, playerId);
  if (!player || state.status !== "active" || state.winner || state.currentPlayerId !== playerId || state.actionsRemaining <= 0) {
    return [];
  }

  const handActions = player.hand.flatMap((card) =>
    buildCardActions(state, player, card).map((action) => ({
      cardUid: card.uid,
      cardName: card.name,
      cardType: card.type,
      cardValue: card.value,
      action
    }))
  );

  return [...handActions, ...buildSaleActions(state, player)];
};

const consumeAction = (state) => {
  state.actionsRemaining = Math.max(0, state.actionsRemaining - 1);
};

const removeCardFromHand = (player, cardUid) => {
  const cardIndex = player.hand.findIndex((card) => card.uid === cardUid);
  if (cardIndex === -1) {
    return null;
  }
  const [card] = player.hand.splice(cardIndex, 1);
  return card;
};

const assertCanAct = (state, playerId) => {
  if (state.status !== "active") {
    throw new Error("Game has not started.");
  }
  if (state.winner) {
    throw new Error("Game is already finished.");
  }
  if (state.currentPlayerId !== playerId) {
    throw new Error("It is not your turn.");
  }
  if (state.actionsRemaining <= 0) {
    throw new Error("No plays remaining.");
  }
};

export const applyAction = (inputState, playerId, submitted) => {
  const state = cloneState(inputState);
  assertCanAct(state, playerId);

  const player = getPlayer(state, playerId);
  const legalActions = buildLegalActions(state, playerId);
  const legal = legalActions.find((candidate) =>
    (candidate.cardUid ?? null) === (submitted.cardUid ?? null) &&
    normalizeAction(candidate.action) === normalizeAction(submitted.action)
  );

  if (!legal) {
    throw new Error("Illegal action.");
  }

  const action = legal.action;

  if (action.kind === "close-sale") {
    const customerIndex = player.customers.findIndex((entry) => entry.uid === action.customerUid);
    const vehicleIndex = player.vehicles.findIndex((entry) => entry.uid === action.vehicleUid);
    if (customerIndex === -1 || vehicleIndex === -1) {
      throw new Error("That sale is no longer available.");
    }
    const customer = player.customers[customerIndex];
    const [vehicle] = player.vehicles.splice(vehicleIndex, 1);
    const saleValue = computeSaleValue(player, customer, vehicle);

    player.salesClosed += 1;
    discardCards(state, [vehicle]);
    if (customer.loyal) {
      pushLog(state, `${customer.name} stayed loyal to ${player.name}'s showroom.`);
    } else {
      player.customers.splice(customerIndex, 1);
      discardCards(state, [customer]);
    }

    consumeAction(state);
    gainCash(state, player, saleValue, `${player.name} sold ${vehicle.name} to ${customer.name}.`);
    if (!state.winner) {
      gainRep(state, player, 1, "A happy customer drove off the lot.");
    }
    return state;
  }

  const card = removeCardFromHand(player, submitted.cardUid);
  if (!card) {
    throw new Error("Card not found in hand.");
  }

  if (action.kind === "recruit") {
    player.customers.push(card);
    consumeAction(state);
    pushLog(state, `${player.name} recruited ${card.name} into the showroom.`);
    if (card.rep) {
      gainRep(state, player, card.rep, `${card.name} likes this dealership.`);
    }
    const recruitCash = salesTeamAmount(player, "on-customer-cash");
    if (recruitCash) {
      gainCash(state, player, recruitCash, "The sales team worked the new lead.");
    }
    return state;
  }

  if (action.kind === "stock") {
    player.vehicles.push(card);
    consumeAction(state);
    pushLog(state, `${player.name} stocked ${card.name} on the lot.`);
    const stockRep = salesTeamAmount(player, "on-vehicle-rep");
    if (stockRep) {
      gainRep(state, player, stockRep, "The product genius made the walkaround sing.");
    }
    return state;
  }

  if (action.kind === "hire") {
    player.salespeople.push(card);
    consumeAction(state);
    pushLog(state, `${player.name} hired ${card.name}. ${card.effect}`);
    return state;
  }

  if (action.kind === "action") {
    consumeAction(state);
    pushLog(state, `${player.name} played ${cardLabel(card)}.`);
    (card.effects ?? []).forEach((effect) => {
      if (!state.winner) {
        resolveEffect(state, player, effect, card.name);
      }
    });
    discardCards(state, [card]);
    return state;
  }

  if (action.kind === "sabotage") {
    const target = getPlayer(state, action.targetPlayerId);
    if (!target) {
      player.hand.push(card);
      throw new Error("Target player not found.");
    }
    consumeAction(state);
    pushLog(state, `${player.name} played ${cardLabel(card)} against ${target.name}.`);
    (card.effects ?? []).forEach((effect) => {
      resolveSabotageEffect(state, player, target, effect, card.name);
    });
    discardCards(state, [card]);
    return state;
  }

  if (action.kind === "sabotage-all") {
    consumeAction(state);
    pushLog(state, `${player.name} played ${cardLabel(card)}.`);
    resolveStealFromEachRival(state, player, card.name);
    discardCards(state, [card]);
    return state;
  }

  player.hand.push(card);
  throw new Error("Unknown action kind.");
};

export const endTurn = (inputState, playerId) => {
  const state = cloneState(inputState);
  if (state.status !== "active") {
    throw new Error("Game has not started.");
  }
  if (state.winner) {
    throw new Error("Game is already finished.");
  }
  if (state.currentPlayerId !== playerId) {
    throw new Error("Only the active player can end the turn.");
  }

  const player = getPlayer(state, playerId);
  const overflow = player.hand.length - player.handLimit;
  if (overflow > 0) {
    const removed = removeLowestValueCards(state, player, overflow);
    pushLog(state, `${player.name} discarded ${removed.length} card${removed.length === 1 ? "" : "s"} down to the hand limit.`);
  }

  state.currentSeatIndex = (state.currentSeatIndex + 1) % SEAT_CONFIG.length;
  state.currentPlayerId = state.players.find((entry) => entry.seatIndex === state.currentSeatIndex)?.id ?? null;
  return beginTurn(state);
};

export const getPlayerView = (state, playerId) => serializePrivateView(state, playerId, buildLegalActions(state, playerId));
export const getPublicState = (state) => serializePublicState(state);

export const isCardSabotage = (cardName) => sabotageNames.has(cardName);
export { computeSaleValue };
