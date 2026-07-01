import { BASE_ACTIONS_PER_TURN, MAX_LOG, OPENING_HAND_SIZE, SEAT_CONFIG, TEAM_CONFIG, WIN_TARGET } from "./constants.js";
import { cloneDeck, getNumericCardValue } from "./cards.js";
import { serializePrivateView, serializePublicState, stableStringify } from "./game-serialization.js";

const sabotageNames = new Set([
  "Bad Survey",
  "Chargeback",
  "Recall Campaign",
  "Employee Quits",
  "Internet Lead Ghosts You"
]);

const cloneState = (state) => structuredClone(state);
const opposingTeamIndex = (teamIndex) => (teamIndex === 0 ? 1 : 0);
const getPlayer = (state, playerId) => state.players.find((player) => player.id === playerId);
const getCurrentPlayer = (state) => getPlayer(state, state.currentPlayerId);
const getDeal = (state, teamIndex, slotIndex) => state.teams[teamIndex].slots[slotIndex];
const getCardValue = (card) => getNumericCardValue(card);
const cardLabel = (card) => `${card.name} (${card.type})`;

const pushLog = (state, message) => {
  state.log.unshift(message);
  state.log = state.log.slice(0, MAX_LOG);
};

const drawCards = (state, player, count) => {
  const drawn = [];

  for (let index = 0; index < count; index += 1) {
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

const getVehiclesForDeal = (deal) => {
  if (!deal) {
    return [];
  }

  return [deal.vehicle, ...deal.extraVehicles].filter(Boolean);
};

const getVehicleCount = (deal) => getVehiclesForDeal(deal).length;

const getEffectiveVehicleName = (deal, vehicleCard) => {
  if (!vehicleCard) {
    return null;
  }

  if (vehicleCard.name === "Service Loaner" && deal.employee?.name === "Product Genius") {
    return "Certified Pre-Owned";
  }

  return vehicleCard.name;
};

const getEffectiveVehicleValue = (deal, vehicleCard) => {
  if (!vehicleCard) {
    return 0;
  }

  if (vehicleCard.name === "Service Loaner" && deal.employee?.name === "Product Genius") {
    return 4;
  }

  return getCardValue(vehicleCard);
};

const dealCanTakeVehicle = (deal) => {
  if (!deal || !deal.vehicle) {
    return true;
  }

  return deal.client?.name === "Corporate Fleet Buyer" && getVehicleCount(deal) < 3;
};

const ensureDeal = (state, teamIndex, slotIndex, ownerPlayerId) => {
  const existing = getDeal(state, teamIndex, slotIndex);
  if (existing) {
    return existing;
  }

  const deal = {
    teamIndex,
    slotIndex,
    ownerPlayerId,
    slotLabel: TEAM_CONFIG[teamIndex].slotLabels[slotIndex],
    client: null,
    vehicle: null,
    extraVehicles: [],
    employee: null,
    attachments: [],
    pendingSinceTeamTurn: null,
    superstarShieldUsed: false
  };

  state.teams[teamIndex].slots[slotIndex] = deal;
  return deal;
};

const getActiveTeamEmployeeNames = (state, teamIndex) =>
  state.teams[teamIndex].slots
    .filter(Boolean)
    .map((deal) => deal.employee?.name)
    .filter(Boolean);

const getTeamVehiclePenalty = (state, teamIndex) => {
  const penalty = state.teams[teamIndex].vehiclePenalty;
  if (!penalty) {
    return 0;
  }

  const casterTeam = state.teams[penalty.casterTeamIndex];
  if (casterTeam.teamTurns >= penalty.expiresAtCasterTurn) {
    state.teams[teamIndex].vehiclePenalty = null;
    return 0;
  }

  return penalty.amount;
};

const getGlobalSaleBonus = (state, teamIndex) => {
  let bonus = 0;

  state.teams[teamIndex].slots.filter(Boolean).forEach((deal) => {
    if (deal.employee?.name === "Finance Coordinator") {
      bonus += 1;
    }

    if (deal.employee?.name === "Client Advisor") {
      bonus += 2;
    }

    if (deal.employee?.name === "F&I Manager") {
      bonus += 3;
    }
  });

  return bonus;
};

const applyComboBonuses = (deal) => {
  let bonus = 0;
  const clientName = deal.client?.name;
  const vehicleNames = getVehiclesForDeal(deal).map((card) => getEffectiveVehicleName(deal, card));
  const employeeName = deal.employee?.name;

  if (clientName === "First-Time Buyer" && vehicleNames.some((name) => ["Base Model Sedan", "BMW X1"].includes(name))) {
    bonus += 2;
  }
  if (clientName === "College Graduate" && deal.attachments.some((card) => card.name === "Factory Incentive")) {
    bonus += 2;
  }
  if (clientName === "Family of Five" && vehicleNames.includes("BMW X5")) {
    bonus += 6;
  } else if (clientName === "Family of Five" && vehicleNames.includes("BMW X3")) {
    bonus += 4;
  }
  if (clientName === "Empty Nester" && vehicleNames.some((name) => ["MINI Cooper", "BMW M2"].includes(name))) {
    bonus += 3;
  }
  if (clientName === "Lease Return Customer" && vehicleNames.some((name) => name?.startsWith("BMW"))) {
    bonus += 4;
  }
  if (clientName === "Lease Return Customer" && vehicleNames.includes("Certified Pre-Owned")) {
    bonus += 2;
  }
  if (clientName === "BMW Enthusiast" && vehicleNames.includes("BMW M3")) {
    bonus += 8;
  } else if (clientName === "BMW Enthusiast" && vehicleNames.includes("BMW M2")) {
    bonus += 6;
  } else if (clientName === "BMW Enthusiast" && vehicleNames.includes("BMW 330i")) {
    bonus += 3;
  }
  if (clientName === "MINI Fanatic" && vehicleNames.includes("MINI Cooper")) {
    bonus += 8;
  }
  if (clientName === "Business Owner" && vehicleNames.includes("BMW iX")) {
    bonus += 6;
  } else if (clientName === "Business Owner" && vehicleNames.includes("BMW X5")) {
    bonus += 5;
  }
  if (clientName === "Referral Customer" && vehicleNames.length) {
    bonus += 3;
  }
  if (clientName === "Luxury Shopper" && vehicleNames.includes("Unicorn Allocation")) {
    bonus += 10;
  }
  if (clientName === "Dream Customer" && vehicleNames.length) {
    bonus += 5;
  }
  if (clientName === "Corporate Fleet Buyer" && vehicleNames.length === 3) {
    bonus += 12;
  }
  if (employeeName === "Product Genius" && vehicleNames.some((name) => name?.startsWith("BMW"))) {
    bonus += 2;
  }
  if (employeeName === "Used Car Manager" && vehicleNames.includes("High Mileage Trade")) {
    bonus += 5;
  }
  if (employeeName === "New Hire") {
    bonus += 1;
  }

  return bonus;
};

const computeDealValue = (state, deal) => {
  let total = 0;

  if (deal.client) {
    total += getCardValue(deal.client);
  }

  getVehiclesForDeal(deal).forEach((vehicleCard) => {
    total += Math.max(1, getEffectiveVehicleValue(deal, vehicleCard) - getTeamVehiclePenalty(state, deal.teamIndex));
  });

  if (deal.employee) {
    total += getCardValue(deal.employee);
  }

  total += deal.attachments.reduce((sum, attachment) => sum + getCardValue(attachment), 0);
  total += applyComboBonuses(deal);
  total += getGlobalSaleBonus(state, deal.teamIndex);

  return total;
};

const isDealComplete = (deal) => Boolean(deal?.client && getVehicleCount(deal) > 0 && deal.employee);
const isDealRushEligible = (deal) => Boolean(deal?.client && getVehicleCount(deal) > 0);

const removeDealIfEmpty = (state, teamIndex, slotIndex) => {
  const deal = getDeal(state, teamIndex, slotIndex);
  if (!deal) {
    return;
  }

  const hasCards = Boolean(deal.client || deal.vehicle || deal.extraVehicles.length || deal.employee || deal.attachments.length);
  if (!hasCards) {
    state.teams[teamIndex].slots[slotIndex] = null;
  }
};

const updateDealCompletion = (state, teamIndex, slotIndex) => {
  const deal = getDeal(state, teamIndex, slotIndex);
  if (!deal) {
    return;
  }

  if (isDealComplete(deal)) {
    if (deal.pendingSinceTeamTurn === null) {
      deal.pendingSinceTeamTurn = state.teams[teamIndex].teamTurns;
      pushLog(state, `${TEAM_CONFIG[teamIndex].slotLabels[slotIndex]} is now pending delivery for ${TEAM_CONFIG[teamIndex].name}.`);
    }
  } else {
    deal.pendingSinceTeamTurn = null;
  }
};

const attachCardToDeal = (state, teamIndex, slotIndex, card, ownerPlayerId) => {
  const deal = ensureDeal(state, teamIndex, slotIndex, ownerPlayerId);

  if (card.type === "Client") {
    deal.client = card;
  } else if (card.type === "Vehicle") {
    if (!deal.vehicle) {
      deal.vehicle = card;
    } else if (deal.client?.name === "Corporate Fleet Buyer" && getVehicleCount(deal) < 3) {
      deal.extraVehicles.push(card);
    } else {
      return false;
    }
  } else if (card.type === "Employee") {
    deal.employee = card;
  } else {
    deal.attachments.push(card);
  }

  updateDealCompletion(state, teamIndex, slotIndex);
  return true;
};

const checkForWinner = (state) => {
  const winningTeam = state.teams.find((team) => team.profit >= WIN_TARGET);
  if (winningTeam) {
    state.status = "finished";
    state.winner = {
      name: TEAM_CONFIG[state.teams.indexOf(winningTeam)].name,
      reason: `${TEAM_CONFIG[state.teams.indexOf(winningTeam)].name} crossed ${WIN_TARGET} profit.`
    };
    return;
  }

  const activeDeals = state.teams.some((team) => team.slots.some(Boolean));
  if (!state.deck.length && state.players.every((player) => player.hand.length === 0) && !activeDeals) {
    const winnerTeamIndex = state.teams[0].profit === state.teams[1].profit
      ? null
      : state.teams[0].profit > state.teams[1].profit
        ? 0
        : 1;

    state.status = "finished";
    state.winner = winnerTeamIndex === null
      ? {
          name: "Tie game",
          reason: "The deck ran out, all deals resolved, and both teams finished tied on profit."
        }
      : {
          name: TEAM_CONFIG[winnerTeamIndex].name,
          reason: `The deck ran dry, all deals resolved, and ${TEAM_CONFIG[winnerTeamIndex].name} finished ahead on profit.`
        };
  }
};

const deliverDeal = (state, teamIndex, slotIndex, reason) => {
  const deal = getDeal(state, teamIndex, slotIndex);
  if (!deal) {
    return;
  }

  const team = state.teams[teamIndex];
  const profit = computeDealValue(state, deal);
  const deliveredVehicles = getVehiclesForDeal(deal).map((vehicle) => getEffectiveVehicleName(deal, vehicle)).join(", ");

  team.profit += profit;
  team.deliveredDeals.push({
    label: `${deal.client?.name ?? "No Client"} + ${deliveredVehicles || "No Vehicle"}`,
    profit
  });
  team.lastDeliveredSale = profit;
  team.lastDeliveredClientName = deal.client?.name ?? null;
  team.deliveredThisTurn = true;

  const keepClient = deal.attachments.some((card) => card.name === "Customer For Life");
  const owner = getPlayer(state, deal.ownerPlayerId);

  if (keepClient && owner && deal.client) {
    owner.hand.push(deal.client);
  } else if (deal.client) {
    discardCards(state, [deal.client]);
  }

  discardCards(state, [...getVehiclesForDeal(deal), deal.employee, ...deal.attachments]);
  state.teams[teamIndex].slots[slotIndex] = null;
  pushLog(state, `${TEAM_CONFIG[teamIndex].slotLabels[slotIndex]} delivered for ${profit} profit. ${reason}`);
  checkForWinner(state);
};

const resolvePendingDeliveries = (state, teamIndex) => {
  state.teams[teamIndex].slots.forEach((deal, slotIndex) => {
    if (deal && deal.pendingSinceTeamTurn !== null && state.teams[teamIndex].teamTurns > deal.pendingSinceTeamTurn) {
      deliverDeal(state, teamIndex, slotIndex, "The deal survived to the next allied turn.");
    }
  });
};

const teamHasGsmShield = (state, teamIndex) =>
  getActiveTeamEmployeeNames(state, teamIndex).includes("GSM") && !state.teams[teamIndex].sabotageBlockedThisTurn;

const absorbTeamSabotage = (state, teamIndex, cardName) => {
  if (!teamHasGsmShield(state, teamIndex)) {
    return false;
  }

  state.teams[teamIndex].sabotageBlockedThisTurn = true;
  pushLog(state, `${TEAM_CONFIG[teamIndex].name}'s GSM blocked ${cardName}.`);
  return true;
};

const absorbDealProtection = (state, teamIndex, slotIndex, targetKind, cardName) => {
  const deal = getDeal(state, teamIndex, slotIndex);
  if (!deal) {
    return true;
  }
  if (teamHasGsmShield(state, teamIndex)) {
    state.teams[teamIndex].sabotageBlockedThisTurn = true;
    pushLog(state, `${TEAM_CONFIG[teamIndex].name}'s GSM blocked ${cardName}.`);
    return true;
  }
  if (targetKind === "client" && deal.employee?.name === "Receptionist") {
    pushLog(state, `Receptionist protected ${deal.client?.name ?? "the client"} from ${cardName}.`);
    return true;
  }
  if (deal.employee?.name === "Superstar Employee" && !deal.superstarShieldUsed) {
    deal.superstarShieldUsed = true;
    pushLog(state, `Superstar Employee burned its one-time save against ${cardName}.`);
    return true;
  }
  return false;
};

const gainTeamProfit = (state, teamIndex, amount, reason) => {
  state.teams[teamIndex].profit += amount;
  pushLog(state, `${TEAM_CONFIG[teamIndex].name} ${amount >= 0 ? "gained" : "lost"} ${Math.abs(amount)} profit. ${reason}`);
  checkForWinner(state);
};

const hasMiniActive = (state, teamIndex) =>
  state.teams[teamIndex].slots.some((deal) =>
    getVehiclesForDeal(deal).some((vehicle) => getEffectiveVehicleName(deal, vehicle) === "MINI Cooper")
  );

const getOpponentDealOptions = (state, teamIndex, filterFn) =>
  state.teams[opposingTeamIndex(teamIndex)].slots
    .map((deal, slotIndex) => ({ deal, slotIndex }))
    .filter(({ deal, slotIndex }) => deal && filterFn(deal, slotIndex));

const getOwnDealOptions = (state, teamIndex, filterFn) =>
  state.teams[teamIndex].slots
    .map((deal, slotIndex) => ({ deal, slotIndex }))
    .filter(({ deal, slotIndex }) => filterFn(deal, slotIndex));

const maybeTriggerServiceAdvisor = (state) => {
  state.teams.forEach((_, teamIndex) => {
    if (getActiveTeamEmployeeNames(state, teamIndex).includes("Service Advisor")) {
      gainTeamProfit(state, teamIndex, 1, "Service Advisor converted the event chaos into value.");
    }
  });
};

const findManufacturerAudit = (state, dealerPrincipalTeamIndex) => {
  for (const player of state.players) {
    if (player.teamIndex === dealerPrincipalTeamIndex) {
      continue;
    }

    const auditIndex = player.hand.findIndex((card) => card.name === "Manufacturer Audit");
    if (auditIndex !== -1) {
      const [auditCard] = player.hand.splice(auditIndex, 1);
      discardCards(state, [auditCard]);
      pushLog(state, `${player.name} fired Manufacturer Audit and canceled Dealer Principal.`);
      return true;
    }
  }
  return false;
};

const teamHasActiveReferralCustomer = (state, teamIndex) =>
  state.teams[teamIndex].slots.some((deal) => deal?.client?.name === "Referral Customer");

const normalizeAction = (action) => stableStringify(action);

const buildCardActions = (state, player, card) => {
  const ownTeamIndex = player.teamIndex;
  const enemyTeamIndex = opposingTeamIndex(ownTeamIndex);

  if (card.name === "Manufacturer Audit") {
    return [];
  }
  if (card.type === "Client") {
    return TEAM_CONFIG[ownTeamIndex].slotLabels
      .map((label, slotIndex) => ({ label, slotIndex }))
      .filter(({ slotIndex }) => !getDeal(state, ownTeamIndex, slotIndex)?.client)
      .map(({ label, slotIndex }) => ({
        label: `${getDeal(state, ownTeamIndex, slotIndex) ? "Add to" : "Start"} ${label}`,
        kind: "attach",
        slotIndex
      }));
  }
  if (card.type === "Vehicle") {
    return TEAM_CONFIG[ownTeamIndex].slotLabels
      .map((label, slotIndex) => ({ label, slotIndex }))
      .filter(({ slotIndex }) => dealCanTakeVehicle(getDeal(state, ownTeamIndex, slotIndex)))
      .map(({ label, slotIndex }) => ({
        label: `${getDeal(state, ownTeamIndex, slotIndex) ? "Add to" : "Start"} ${label}`,
        kind: "attach",
        slotIndex
      }));
  }
  if (card.type === "Employee") {
    if (card.name === "Porter") {
      return [{ label: "Play utility", kind: "draw-one" }];
    }
    if (card.name === "BDC Agent") {
      return [{ label: "Find client", kind: "search-client" }];
    }
    if (card.name === "Sales Manager") {
      return [{ label: "Grant extra action", kind: "extra-action" }];
    }
    return getOwnDealOptions(state, ownTeamIndex, (deal) => !deal?.employee).map(({ slotIndex }) => ({
      label: `Staff ${TEAM_CONFIG[ownTeamIndex].slotLabels[slotIndex]}`,
      kind: "attach",
      slotIndex
    }));
  }
  if (card.type === "Legendary") {
    if (card.name === "Dealer Principal") {
      return getOwnDealOptions(state, ownTeamIndex, (deal) => Boolean(deal)).map(({ slotIndex }) => ({
        label: `Force deliver ${TEAM_CONFIG[ownTeamIndex].slotLabels[slotIndex]}`,
        kind: "dealer-principal",
        slotIndex
      }));
    }
    return [];
  }
  if (card.name === "Bad Survey") {
    return [{
      label: `Hit ${TEAM_CONFIG[enemyTeamIndex].name}`,
      kind: "team-profit",
      teamIndex: enemyTeamIndex,
      amount: -5,
      isSabotage: true,
      reason: "Bad Survey cratered profit."
    }];
  }
  if (card.name === "Chargeback") {
    return state.teams[enemyTeamIndex].lastDeliveredSale
      ? [{ label: `Charge back ${TEAM_CONFIG[enemyTeamIndex].name}`, kind: "chargeback", teamIndex: enemyTeamIndex }]
      : [];
  }
  if (card.name === "Factory Incentive" || card.name === "Market Adjustment") {
    return getOwnDealOptions(state, ownTeamIndex, (deal) => {
      if (!getVehicleCount(deal)) {
        return false;
      }
      if (card.name === "Market Adjustment" && getVehiclesForDeal(deal).some((vehicle) => vehicle.name === "Base Model Sedan")) {
        return false;
      }
      return true;
    }).map(({ slotIndex }) => ({
      label: `Boost ${TEAM_CONFIG[ownTeamIndex].slotLabels[slotIndex]}`,
      kind: "attach",
      slotIndex
    }));
  }
  if (card.name === "Recall Campaign") {
    return state.teams[enemyTeamIndex].slots.some((deal) => getVehicleCount(deal) > 0)
      ? [{ label: `Debuff ${TEAM_CONFIG[enemyTeamIndex].name}`, kind: "recall", teamIndex: enemyTeamIndex }]
      : [];
  }
  if (card.name === "Employee Quits") {
    return getOpponentDealOptions(state, ownTeamIndex, (deal) => Boolean(deal.employee)).map(({ slotIndex }) => ({
      label: `Strip ${TEAM_CONFIG[enemyTeamIndex].slotLabels[slotIndex]}`,
      kind: "remove-employee",
      teamIndex: enemyTeamIndex,
      slotIndex
    }));
  }
  if (card.name === "Massive Trade") {
    return [{ label: "Dig for vehicles", kind: "massive-trade" }];
  }
  if (card.name === "Viral Social Post") {
    const total = hasMiniActive(state, ownTeamIndex) ? 7 : 5;
    return [{
      label: `Gain ${total} profit`,
      kind: "team-profit",
      teamIndex: ownTeamIndex,
      amount: total,
      reason: "Viral Social Post spiked showroom buzz."
    }];
  }
  if (card.name === "Internet Lead Ghosts You") {
    return getOpponentDealOptions(state, ownTeamIndex, (deal) => Boolean(deal.client)).map(({ slotIndex }) => ({
      label: `Ghost ${TEAM_CONFIG[enemyTeamIndex].slotLabels[slotIndex]}`,
      kind: "remove-client",
      teamIndex: enemyTeamIndex,
      slotIndex
    }));
  }
  if (card.name === "Google Review Hero") {
    return getOwnDealOptions(state, ownTeamIndex, (deal) => Boolean(deal?.employee)).map(({ slotIndex }) => ({
      label: `Attach to ${TEAM_CONFIG[ownTeamIndex].slotLabels[slotIndex]}`,
      kind: "attach",
      slotIndex
    }));
  }
  if (card.name === "End-of-Month Rush") {
    return getOwnDealOptions(state, ownTeamIndex, (deal) => isDealRushEligible(deal)).map(({ slotIndex }) => ({
      label: `Deliver ${TEAM_CONFIG[ownTeamIndex].slotLabels[slotIndex]}`,
      kind: "rush-delivery",
      slotIndex
    }));
  }
  if (card.name === "Customer For Life") {
    return getOwnDealOptions(state, ownTeamIndex, (deal) => Boolean(deal?.client && deal.client.name !== "Dream Customer")).map(({ slotIndex }) => ({
      label: `Attach to ${TEAM_CONFIG[ownTeamIndex].slotLabels[slotIndex]}`,
      kind: "attach",
      slotIndex
    }));
  }
  if (card.name === "Record Month") {
    const bonus = state.teams[ownTeamIndex].deliveredThisTurn ? 13 : 10;
    return [{
      label: `Gain ${bonus} profit`,
      kind: "team-profit",
      teamIndex: ownTeamIndex,
      amount: bonus,
      reason: "Record Month added immediate scoreboard pressure."
    }];
  }
  return [];
};

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
  players: [],
  teams: TEAM_CONFIG.map(() => ({
    profit: 0,
    deliveredDeals: [],
    slots: [null, null, null],
    teamTurns: 0,
    extraActionsNextTurn: 0,
    sabotageBlockedThisTurn: false,
    lastDeliveredSale: null,
    lastDeliveredClientName: null,
    deliveredThisTurn: false,
    vehiclePenalty: null
  }))
});

export const addPlayerToGame = (state, player) => {
  const next = cloneState(state);
  next.players.push({
    id: player.id,
    name: player.name,
    seatIndex: player.seatIndex,
    teamIndex: SEAT_CONFIG[player.seatIndex].teamIndex,
    isAi: Boolean(player.isAi),
    personalityId: player.personalityId ?? null,
    ready: Boolean(player.isAi),
    connected: !player.isAi,
    reconnectToken: player.reconnectToken,
    hand: []
  });
  if (!next.hostPlayerId) {
    next.hostPlayerId = player.id;
  }
  pushLog(next, `${player.name} joined ${SEAT_CONFIG[player.seatIndex].name}${player.isAi ? " as an AI player" : ""}.`);
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

  const player = getCurrentPlayer(state);
  const team = state.teams[player.teamIndex];
  state.turnNumber += 1;
  team.teamTurns += 1;
  team.sabotageBlockedThisTurn = false;
  team.deliveredThisTurn = false;

  resolvePendingDeliveries(state, player.teamIndex);
  if (state.winner) {
    return state;
  }

  drawCards(state, player, 1);
  state.actionsRemaining = BASE_ACTIONS_PER_TURN + team.extraActionsNextTurn;
  team.extraActionsNextTurn = 0;
  pushLog(state, `${player.name} started a turn, drew 1 card, and has ${state.actionsRemaining} action${state.actionsRemaining === 1 ? "" : "s"}.`);
  checkForWinner(state);
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
  });
  state.teams = TEAM_CONFIG.map(() => ({
    profit: 0,
    deliveredDeals: [],
    slots: [null, null, null],
    teamTurns: 0,
    extraActionsNextTurn: 0,
    sabotageBlockedThisTurn: false,
    lastDeliveredSale: null,
    lastDeliveredClientName: null,
    deliveredThisTurn: false,
    vehiclePenalty: null
  }));

  state.players
    .sort((left, right) => left.seatIndex - right.seatIndex)
    .forEach((player) => drawCards(state, player, OPENING_HAND_SIZE));

  pushLog(state, "A fresh Dealership Wars match has started.");
  return beginTurn(state);
};

export const buildLegalActions = (state, playerId) => {
  const player = getPlayer(state, playerId);
  if (!player || state.status !== "active" || state.winner || state.currentPlayerId !== playerId || state.actionsRemaining <= 0) {
    return [];
  }

  return player.hand.flatMap((card) =>
    buildCardActions(state, player, card).map((action) => ({
      cardUid: card.uid,
      cardName: card.name,
      cardType: card.type,
      cardValue: card.value,
      action
    }))
  );
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
    throw new Error("No actions remaining.");
  }
};

export const applyAction = (inputState, playerId, submitted) => {
  const state = cloneState(inputState);
  assertCanAct(state, playerId);

  const player = getPlayer(state, playerId);
  const legalActions = buildLegalActions(state, playerId);
  const legal = legalActions.find((candidate) =>
    candidate.cardUid === submitted.cardUid && normalizeAction(candidate.action) === normalizeAction(submitted.action)
  );

  if (!legal) {
    throw new Error("Illegal action.");
  }

  const card = removeCardFromHand(player, submitted.cardUid);
  if (!card) {
    throw new Error("Card not found in hand.");
  }

  const action = legal.action;

  if (action.kind === "attach") {
    const attached = attachCardToDeal(state, player.teamIndex, action.slotIndex, card, player.id);
    if (!attached) {
      player.hand.push(card);
      throw new Error("Card could not be attached to that deal.");
    }
    consumeAction(state);
    pushLog(state, `${player.name} played ${cardLabel(card)} into ${TEAM_CONFIG[player.teamIndex].slotLabels[action.slotIndex]}.`);
    checkForWinner(state);
    return state;
  }

  if (action.kind === "team-profit") {
    if (action.isSabotage && absorbTeamSabotage(state, action.teamIndex, card.name)) {
      consumeAction(state);
      discardCards(state, [card]);
      maybeTriggerServiceAdvisor(state);
      return state;
    }
    if (card.name === "Bad Survey" && teamHasActiveReferralCustomer(state, action.teamIndex)) {
      consumeAction(state);
      discardCards(state, [card]);
      maybeTriggerServiceAdvisor(state);
      pushLog(state, `${player.name} played Bad Survey, but a Referral Customer deal shrugged it off.`);
      return state;
    }
    gainTeamProfit(state, action.teamIndex, action.amount, action.reason);
    consumeAction(state);
    discardCards(state, [card]);
    maybeTriggerServiceAdvisor(state);
    return state;
  }

  if (action.kind === "massive-trade") {
    let foundVehicles = 0;
    const revealed = [];
    while (state.deck.length && foundVehicles < 3) {
      const draw = state.deck.shift();
      if (draw.type === "Vehicle") {
        player.hand.push(draw);
        foundVehicles += 1;
      } else {
        revealed.push(draw);
      }
    }
    discardCards(state, revealed);
    consumeAction(state);
    discardCards(state, [card]);
    maybeTriggerServiceAdvisor(state);
    pushLog(state, `${player.name} played Massive Trade and found ${foundVehicles} vehicle card${foundVehicles === 1 ? "" : "s"}.`);
    return state;
  }

  if (action.kind === "search-client") {
    const clientIndex = state.deck.findIndex((deckCard) => deckCard.type === "Client");
    if (clientIndex !== -1) {
      const [clientCard] = state.deck.splice(clientIndex, 1);
      player.hand.push(clientCard);
      pushLog(state, `${player.name} used BDC Agent to pull ${clientCard.name} from the deck.`);
    } else {
      pushLog(state, `${player.name} used BDC Agent, but no client was left in the deck.`);
    }
    consumeAction(state);
    discardCards(state, [card]);
    return state;
  }

  if (action.kind === "draw-one") {
    drawCards(state, player, 1);
    consumeAction(state);
    discardCards(state, [card]);
    pushLog(state, `${player.name} played Porter and drew a replacement card.`);
    return state;
  }

  if (action.kind === "extra-action") {
    consumeAction(state);
    state.actionsRemaining += 1;
    discardCards(state, [card]);
    pushLog(state, `${player.name} played Sales Manager and earned an immediate extra action.`);
    return state;
  }

  if (action.kind === "dealer-principal") {
    if (findManufacturerAudit(state, player.teamIndex)) {
      consumeAction(state);
      discardCards(state, [card]);
      return state;
    }
    deliverDeal(state, player.teamIndex, action.slotIndex, "Dealer Principal forced the deal through instantly.");
    consumeAction(state);
    discardCards(state, [card]);
    return state;
  }

  if (action.kind === "rush-delivery") {
    deliverDeal(state, player.teamIndex, action.slotIndex, "End-of-Month Rush pushed the deal over the line.");
    consumeAction(state);
    discardCards(state, [card]);
    maybeTriggerServiceAdvisor(state);
    return state;
  }

  if (action.kind === "recall") {
    if (absorbTeamSabotage(state, action.teamIndex, card.name)) {
      consumeAction(state);
      discardCards(state, [card]);
      maybeTriggerServiceAdvisor(state);
      return state;
    }
    state.teams[action.teamIndex].vehiclePenalty = {
      amount: 2,
      casterTeamIndex: player.teamIndex,
      expiresAtCasterTurn: state.teams[player.teamIndex].teamTurns + 1
    };
    consumeAction(state);
    discardCards(state, [card]);
    maybeTriggerServiceAdvisor(state);
    pushLog(state, `${player.name} launched Recall Campaign against ${TEAM_CONFIG[action.teamIndex].name}.`);
    return state;
  }

  if (action.kind === "chargeback") {
    if (absorbTeamSabotage(state, action.teamIndex, card.name)) {
      consumeAction(state);
      discardCards(state, [card]);
      maybeTriggerServiceAdvisor(state);
      return state;
    }
    const targetTeam = state.teams[action.teamIndex];
    const previous = targetTeam.lastDeliveredSale ?? 0;
    const reduced = Math.max(5, Math.floor(previous / 2));
    const delta = reduced - previous;
    gainTeamProfit(state, action.teamIndex, delta, "Chargeback cut down the most recent delivered deal.");
    targetTeam.lastDeliveredSale = reduced;
    consumeAction(state);
    discardCards(state, [card]);
    maybeTriggerServiceAdvisor(state);
    return state;
  }

  if (action.kind === "remove-client") {
    if (absorbDealProtection(state, action.teamIndex, action.slotIndex, "client", card.name)) {
      consumeAction(state);
      discardCards(state, [card]);
      maybeTriggerServiceAdvisor(state);
      return state;
    }
    const deal = getDeal(state, action.teamIndex, action.slotIndex);
    if (deal?.client) {
      discardCards(state, [deal.client]);
      deal.client = null;
      updateDealCompletion(state, action.teamIndex, action.slotIndex);
      removeDealIfEmpty(state, action.teamIndex, action.slotIndex);
      pushLog(state, `${player.name} used Internet Lead Ghosts You on ${TEAM_CONFIG[action.teamIndex].slotLabels[action.slotIndex]}.`);
    }
    consumeAction(state);
    discardCards(state, [card]);
    maybeTriggerServiceAdvisor(state);
    return state;
  }

  if (action.kind === "remove-employee") {
    if (absorbDealProtection(state, action.teamIndex, action.slotIndex, "employee", card.name)) {
      consumeAction(state);
      discardCards(state, [card]);
      maybeTriggerServiceAdvisor(state);
      return state;
    }
    const deal = getDeal(state, action.teamIndex, action.slotIndex);
    if (deal?.employee) {
      discardCards(state, [deal.employee]);
      deal.employee = null;
      updateDealCompletion(state, action.teamIndex, action.slotIndex);
      removeDealIfEmpty(state, action.teamIndex, action.slotIndex);
      pushLog(state, `${player.name} forced an Employee Quits on ${TEAM_CONFIG[action.teamIndex].slotLabels[action.slotIndex]}.`);
    }
    consumeAction(state);
    discardCards(state, [card]);
    maybeTriggerServiceAdvisor(state);
    return state;
  }

  consumeAction(state);
  discardCards(state, [card]);
  return state;
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

  state.currentSeatIndex = (state.currentSeatIndex + 1) % SEAT_CONFIG.length;
  state.currentPlayerId = state.players.find((player) => player.seatIndex === state.currentSeatIndex)?.id ?? null;
  return beginTurn(state);
};

export const getPlayerView = (state, playerId) => serializePrivateView(state, playerId, buildLegalActions(state, playerId));
export const getPublicState = (state) => serializePublicState(state);

export const isCardSabotage = (cardName) => sabotageNames.has(cardName);
