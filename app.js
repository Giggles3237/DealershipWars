const baseCardsData = window.DEALERSHIP_WARS_CARDS ?? [];

const heroDeckCount = document.querySelector("#hero-deck-count");
const heroDiscardCount = document.querySelector("#hero-discard-count");
const heroTurnCount = document.querySelector("#hero-turn-count");
const turnTitle = document.querySelector("#turn-title");
const turnMeta = document.querySelector("#turn-meta");
const newGameButton = document.querySelector("#new-game-button");
const endTurnButton = document.querySelector("#end-turn-button");
const runAiButton = document.querySelector("#run-ai-button");
const scoreboard = document.querySelector("#scoreboard");
const team0Slots = document.querySelector("#team-0-slots");
const team1Slots = document.querySelector("#team-1-slots");
const team0Players = document.querySelector("#team-0-players");
const team1Players = document.querySelector("#team-1-players");
const winnerBanner = document.querySelector("#winner-banner");
const tableSummary = document.querySelector("#table-summary");
const logList = document.querySelector("#log-list");
const handTitle = document.querySelector("#hand-title");
const handCaption = document.querySelector("#hand-caption");
const handGrid = document.querySelector("#hand-grid");
const playerSetupGrid = document.querySelector("#player-setup-grid");

const cardsGrid = document.querySelector("#cards-grid");
const searchInput = document.querySelector("#search-input");
const sortSelect = document.querySelector("#sort-select");
const filterContainer = document.querySelector("#type-filters");
const summaryStrip = document.querySelector("#summary-strip");
const visibleCount = document.querySelector("#visible-count");
const resetButton = document.querySelector("#reset-button");
const libraryCardTemplate = document.querySelector("#library-card-template");

const WIN_TARGET = 100;
const OPENING_HAND_SIZE = 5;
const BASE_ACTIONS_PER_TURN = 2;
const MAX_LOG = 14;
const AI_DELAY_MS = 700;

const TEAM_CONFIG = [
  {
    name: "Team A",
    label: "North Showroom",
    slotLabels: ["A1", "A2", "A3"]
  },
  {
    name: "Team B",
    label: "South Showroom",
    slotLabels: ["B1", "B2", "B3"]
  }
];

const PLAYER_CONFIG = [
  { name: "Player 1", title: "Sales Lead", teamIndex: 0, isHuman: true, personalityId: "closer" },
  { name: "Player 2", title: "Desk Shark", teamIndex: 1, isHuman: false, personalityId: "desk-shark" },
  { name: "Player 3", title: "Lot Hawk", teamIndex: 0, isHuman: false, personalityId: "lot-hawk" },
  { name: "Player 4", title: "CSI Saint", teamIndex: 1, isHuman: false, personalityId: "csi-saint" }
];

const AI_PERSONALITIES = [
  {
    id: "closer",
    name: "The Closer",
    title: "Sales Lead",
    tagline: "Pushes complete deals and immediate profit.",
    weights: {
      delivery: 52,
      ownProfit: 30,
      completion: 38,
      sabotage: 6
    }
  },
  {
    id: "desk-shark",
    name: "Desk Shark",
    title: "Desk Manager",
    tagline: "Squeezes gross with incentives, add-ons, and delivery pressure.",
    weights: {
      delivery: 28,
      ownProfit: 22,
      attachment: 28,
      vehicle: 18,
      employee: 10
    }
  },
  {
    id: "lot-hawk",
    name: "Lot Hawk",
    title: "Used Car Manager",
    tagline: "Builds inventory-heavy deals and digs for vehicles.",
    weights: {
      vehicle: 34,
      massiveTrade: 42,
      attachment: 12,
      sabotage: 8
    }
  },
  {
    id: "bdc-hustler",
    name: "BDC Hustler",
    title: "BDC Ace",
    tagline: "Wants fresh clients and lead flow before anything else.",
    weights: {
      client: 34,
      searchClient: 48,
      completion: 18,
      ownProfit: 8
    }
  },
  {
    id: "f-and-i-wizard",
    name: "F&I Wizard",
    title: "F&I Manager",
    tagline: "Likes finance staff, protection, and value attachments.",
    weights: {
      employee: 24,
      protection: 26,
      attachment: 24,
      ownProfit: 14
    }
  },
  {
    id: "saboteur",
    name: "Back Lot Saboteur",
    title: "Recon Specialist",
    tagline: "Throws surveys, chargebacks, and chaos at the other showroom.",
    weights: {
      sabotage: 54,
      denyDelivery: 34,
      enemyProfit: 22
    }
  },
  {
    id: "csi-saint",
    name: "CSI Saint",
    title: "Customer Experience Manager",
    tagline: "Protects deals, keeps clients happy, and plays the long game.",
    weights: {
      protection: 44,
      client: 16,
      employee: 18,
      ownProfit: 10,
      sabotage: -14
    }
  }
];

const typeColors = {
  All: "#b44f2a",
  Client: "#d66a3d",
  Vehicle: "#456e9f",
  Employee: "#2b8c67",
  Event: "#8d4aa8",
  Legendary: "#bc8a1f"
};

const sabotageNames = new Set([
  "Bad Survey",
  "Chargeback",
  "Recall Campaign",
  "Employee Quits",
  "Internet Lead Ghosts You"
]);

let baseCards = [];
let state = null;
let activeType = "All";
let nextUid = 1;
let dragCardUid = null;
let aiTurnTimer = null;
let aiFrameHandle = null;
let playerSetup = PLAYER_CONFIG.map((player) => ({ ...player }));

const getPersonality = (personalityId) =>
  AI_PERSONALITIES.find((personality) => personality.id === personalityId) ?? AI_PERSONALITIES[0];

const isGeneratedSeatName = (name, seatIndex) =>
  name === `Player ${seatIndex + 1}` || AI_PERSONALITIES.some((personality) => personality.name === name);

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const numericValue = (value) => {
  if (value === "Auto-Win") {
    return 999;
  }

  return Number(value);
};

const cloneCard = (card) => ({
  ...card,
  uid: `card-${nextUid++}`
});

const shuffle = (cards) => {
  const deck = [...cards];

  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }

  return deck;
};

const currentPlayer = () => state.players[state.currentPlayerIndex];
const currentTeam = () => state.teams[currentPlayer().teamIndex];
const opposingTeamIndex = (teamIndex) => (teamIndex === 0 ? 1 : 0);
const isAiTurn = () => state && !state.winner && !currentPlayer().isHuman;
const cardLabel = (card) => `${card.name} (${card.type})`;

const clearAiTurnTimer = () => {
  if (aiTurnTimer) {
    clearTimeout(aiTurnTimer);
    aiTurnTimer = null;
  }

  if (aiFrameHandle) {
    cancelAnimationFrame(aiFrameHandle);
    aiFrameHandle = null;
  }
};

const logEvent = (message) => {
  state.log.unshift(message);
  state.log = state.log.slice(0, MAX_LOG);
};

const drawCards = (player, count) => {
  for (let index = 0; index < count; index += 1) {
    if (!state.deck.length) {
      break;
    }

    player.hand.push(state.deck.shift());
  }
};

const discardCards = (cards) => {
  cards.filter(Boolean).forEach((card) => state.discard.unshift(card));
};

const consumeAction = () => {
  state.actionsRemaining = Math.max(0, state.actionsRemaining - 1);
};

const getDeal = (teamIndex, slotIndex) => state.teams[teamIndex].slots[slotIndex];

const ensureDeal = (teamIndex, slotIndex, ownerPlayerId) => {
  const existingDeal = getDeal(teamIndex, slotIndex);

  if (existingDeal) {
    return existingDeal;
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

const getPlayerById = (playerId) => state.players.find((player) => player.id === playerId);
const getCardValue = (card) => numericValue(card.value);

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
  if (!deal) {
    return true;
  }

  if (!deal.vehicle) {
    return true;
  }

  return deal.client?.name === "Corporate Fleet Buyer" && getVehicleCount(deal) < 3;
};

const removeDealIfEmpty = (teamIndex, slotIndex) => {
  const deal = getDeal(teamIndex, slotIndex);

  if (!deal) {
    return;
  }

  const hasCards = Boolean(deal.client || deal.vehicle || deal.extraVehicles.length || deal.employee || deal.attachments.length);

  if (!hasCards) {
    state.teams[teamIndex].slots[slotIndex] = null;
  }
};

const attachCardToDeal = (teamIndex, slotIndex, card, ownerPlayerId) => {
  const deal = ensureDeal(teamIndex, slotIndex, ownerPlayerId);

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

  updateDealCompletion(teamIndex, slotIndex);
  return true;
};

const getActiveTeamEmployeeNames = (teamIndex) =>
  state.teams[teamIndex].slots
    .filter(Boolean)
    .map((deal) => deal.employee?.name)
    .filter(Boolean);

const getTeamVehiclePenalty = (teamIndex) => {
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

const getGlobalSaleBonus = (teamIndex) => {
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
  const vehicleNames = getVehiclesForDeal(deal).map((vehicleCard) => getEffectiveVehicleName(deal, vehicleCard));
  const employeeName = deal.employee?.name;

  if (clientName === "First-Time Buyer" && vehicleNames.some((vehicleName) => ["Base Model Sedan", "BMW X1"].includes(vehicleName))) {
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

  if (clientName === "Empty Nester" && vehicleNames.some((vehicleName) => ["MINI Cooper", "BMW M2"].includes(vehicleName))) {
    bonus += 3;
  }

  if (clientName === "Lease Return Customer" && vehicleNames.some((vehicleName) => vehicleName?.startsWith("BMW"))) {
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

  if (employeeName === "Product Genius" && vehicleNames.some((vehicleName) => vehicleName?.startsWith("BMW"))) {
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

const computeDealValue = (deal) => {
  let total = 0;

  if (deal.client) {
    total += getCardValue(deal.client);
  }

  getVehiclesForDeal(deal).forEach((vehicleCard) => {
    total += Math.max(1, getEffectiveVehicleValue(deal, vehicleCard) - getTeamVehiclePenalty(deal.teamIndex));
  });

  if (deal.employee) {
    total += getCardValue(deal.employee);
  }

  total += deal.attachments.reduce((sum, attachment) => sum + getCardValue(attachment), 0);
  total += applyComboBonuses(deal);
  total += getGlobalSaleBonus(deal.teamIndex);

  return total;
};

const isDealComplete = (deal) => Boolean(deal?.client && getVehicleCount(deal) > 0 && deal.employee);
const isDealRushEligible = (deal) => Boolean(deal?.client && getVehicleCount(deal) > 0);

const updateDealCompletion = (teamIndex, slotIndex) => {
  const deal = getDeal(teamIndex, slotIndex);

  if (!deal) {
    return;
  }

  if (isDealComplete(deal)) {
    if (deal.pendingSinceTeamTurn === null) {
      deal.pendingSinceTeamTurn = state.teams[teamIndex].teamTurns;
      logEvent(`${TEAM_CONFIG[teamIndex].slotLabels[slotIndex]} is now pending delivery for ${TEAM_CONFIG[teamIndex].name}.`);
    }
  } else {
    deal.pendingSinceTeamTurn = null;
  }
};

const deliverDeal = (teamIndex, slotIndex, reason) => {
  const deal = getDeal(teamIndex, slotIndex);

  if (!deal) {
    return;
  }

  const team = state.teams[teamIndex];
  const profit = computeDealValue(deal);
  const deliveredVehicles = getVehiclesForDeal(deal).map((vehicleCard) => getEffectiveVehicleName(deal, vehicleCard)).join(", ");

  team.profit += profit;
  team.deliveredDeals.push({
    label: `${deal.client?.name ?? "No Client"} + ${deliveredVehicles || "No Vehicle"}`,
    profit
  });
  team.lastDeliveredSale = profit;
  team.lastDeliveredClientName = deal.client?.name ?? null;
  team.deliveredThisTurn = true;

  const keepClient = deal.attachments.some((card) => card.name === "Customer For Life");
  const owner = getPlayerById(deal.ownerPlayerId);

  if (keepClient && owner && deal.client) {
    owner.hand.push(deal.client);
  } else if (deal.client) {
    discardCards([deal.client]);
  }

  discardCards([...getVehiclesForDeal(deal), deal.employee, ...deal.attachments]);
  state.teams[teamIndex].slots[slotIndex] = null;

  logEvent(`${TEAM_CONFIG[teamIndex].slotLabels[slotIndex]} delivered for ${profit} profit. ${reason}`);
  checkForWinner();
};

const resolvePendingDeliveries = (teamIndex) => {
  state.teams[teamIndex].slots.forEach((deal, slotIndex) => {
    if (deal && deal.pendingSinceTeamTurn !== null && state.teams[teamIndex].teamTurns > deal.pendingSinceTeamTurn) {
      deliverDeal(teamIndex, slotIndex, "The deal survived to the next allied turn.");
    }
  });
};

const teamHasGsmShield = (teamIndex) =>
  getActiveTeamEmployeeNames(teamIndex).includes("GSM") && !state.teams[teamIndex].sabotageBlockedThisTurn;

const absorbTeamSabotage = (teamIndex, cardName) => {
  if (!teamHasGsmShield(teamIndex)) {
    return false;
  }

  state.teams[teamIndex].sabotageBlockedThisTurn = true;
  logEvent(`${TEAM_CONFIG[teamIndex].name}'s GSM blocked ${cardName}.`);
  return true;
};

const dealProtectsClient = (deal) => deal?.employee?.name === "Receptionist";

const absorbDealProtection = (teamIndex, slotIndex, targetKind, cardName) => {
  const deal = getDeal(teamIndex, slotIndex);

  if (!deal) {
    return true;
  }

  if (teamHasGsmShield(teamIndex)) {
    state.teams[teamIndex].sabotageBlockedThisTurn = true;
    logEvent(`${TEAM_CONFIG[teamIndex].name}'s GSM blocked ${cardName}.`);
    return true;
  }

  if (targetKind === "client" && dealProtectsClient(deal)) {
    logEvent(`Receptionist protected ${deal.client?.name ?? "the client"} from ${cardName}.`);
    return true;
  }

  if (deal.employee?.name === "Superstar Employee" && !deal.superstarShieldUsed) {
    deal.superstarShieldUsed = true;
    logEvent(`Superstar Employee burned its one-time save against ${cardName}.`);
    return true;
  }

  return false;
};

const removeCardFromHand = (player, cardUid) => {
  const cardIndex = player.hand.findIndex((card) => card.uid === cardUid);

  if (cardIndex === -1) {
    return null;
  }

  const [card] = player.hand.splice(cardIndex, 1);
  return card;
};

const gainTeamProfit = (teamIndex, amount, reason) => {
  state.teams[teamIndex].profit += amount;
  logEvent(`${TEAM_CONFIG[teamIndex].name} ${amount >= 0 ? "gained" : "lost"} ${Math.abs(amount)} profit. ${reason}`);
  checkForWinner();
};

const hasMiniActive = (teamIndex) =>
  state.teams[teamIndex].slots.some((deal) =>
    getVehiclesForDeal(deal).some((vehicleCard) => getEffectiveVehicleName(deal, vehicleCard) === "MINI Cooper")
  );

const getOpponentDealOptions = (teamIndex, filterFn) =>
  state.teams[opposingTeamIndex(teamIndex)].slots
    .map((deal, slotIndex) => ({ deal, slotIndex }))
    .filter(({ deal, slotIndex }) => deal && filterFn(deal, slotIndex));

const getOwnDealOptions = (teamIndex, filterFn) =>
  state.teams[teamIndex].slots
    .map((deal, slotIndex) => ({ deal, slotIndex }))
    .filter(({ deal, slotIndex }) => filterFn(deal, slotIndex));

const maybeTriggerServiceAdvisor = () => {
  state.teams.forEach((team, teamIndex) => {
    if (getActiveTeamEmployeeNames(teamIndex).includes("Service Advisor")) {
      gainTeamProfit(teamIndex, 1, "Service Advisor converted the event chaos into value.");
    }
  });
};

const findManufacturerAudit = (dealerPrincipalTeamIndex) => {
  for (const player of state.players) {
    if (player.teamIndex === dealerPrincipalTeamIndex) {
      continue;
    }

    const auditIndex = player.hand.findIndex((card) => card.name === "Manufacturer Audit");

    if (auditIndex !== -1) {
      const [auditCard] = player.hand.splice(auditIndex, 1);
      discardCards([auditCard]);
      logEvent(`${player.name} fired Manufacturer Audit and canceled Dealer Principal.`);
      return true;
    }
  }

  return false;
};

const teamHasActiveReferralCustomer = (teamIndex) =>
  state.teams[teamIndex].slots.some((deal) => deal?.client?.name === "Referral Customer");

const playCardOnDeal = (player, card, teamIndex, slotIndex) => {
  const attached = attachCardToDeal(teamIndex, slotIndex, card, player.id);

  if (!attached) {
    player.hand.push(card);
    render();
    return;
  }

  consumeAction();
  logEvent(`${player.name} played ${cardLabel(card)} into ${TEAM_CONFIG[teamIndex].slotLabels[slotIndex]}.`);
  checkForWinner();
  render();
};

const executeCardAction = (cardUid, action) => {
  if (!state || state.winner || state.actionsRemaining <= 0) {
    return;
  }

  const player = currentPlayer();
  const card = removeCardFromHand(player, cardUid);

  if (!card) {
    return;
  }

  if (action.kind === "attach") {
    playCardOnDeal(player, card, player.teamIndex, action.slotIndex);
    return;
  }

  if (action.kind === "team-profit") {
    if (action.isSabotage && absorbTeamSabotage(action.teamIndex, card.name)) {
      consumeAction();
      discardCards([card]);
      maybeTriggerServiceAdvisor();
      render();
      return;
    }

    if (card.name === "Bad Survey" && teamHasActiveReferralCustomer(action.teamIndex)) {
      consumeAction();
      discardCards([card]);
      maybeTriggerServiceAdvisor();
      logEvent(`${player.name} played Bad Survey, but a Referral Customer deal shrugged it off.`);
      render();
      return;
    }

    gainTeamProfit(action.teamIndex, action.amount, action.reason);
    consumeAction();
    discardCards([card]);
    maybeTriggerServiceAdvisor();
    render();
    return;
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

    discardCards(revealed);
    consumeAction();
    discardCards([card]);
    maybeTriggerServiceAdvisor();
    logEvent(`${player.name} played Massive Trade and found ${foundVehicles} vehicle card${foundVehicles === 1 ? "" : "s"}.`);
    render();
    return;
  }

  if (action.kind === "search-client") {
    const clientIndex = state.deck.findIndex((deckCard) => deckCard.type === "Client");

    if (clientIndex !== -1) {
      const [clientCard] = state.deck.splice(clientIndex, 1);
      player.hand.push(clientCard);
      state.deck = shuffle(state.deck);
      logEvent(`${player.name} used BDC Agent to pull ${clientCard.name} from the deck.`);
    } else {
      logEvent(`${player.name} used BDC Agent, but no client was left in the deck.`);
    }

    consumeAction();
    discardCards([card]);
    render();
    return;
  }

  if (action.kind === "draw-one") {
    drawCards(player, 1);
    consumeAction();
    discardCards([card]);
    logEvent(`${player.name} played Porter and drew a replacement card.`);
    render();
    return;
  }

  if (action.kind === "extra-action") {
    consumeAction();
    state.actionsRemaining += 1;
    discardCards([card]);
    logEvent(`${player.name} played Sales Manager and earned an immediate extra action.`);
    render();
    return;
  }

  if (action.kind === "dealer-principal") {
    if (findManufacturerAudit(player.teamIndex)) {
      consumeAction();
      discardCards([card]);
      render();
      return;
    }

    deliverDeal(player.teamIndex, action.slotIndex, "Dealer Principal forced the deal through instantly.");
    consumeAction();
    discardCards([card]);
    render();
    return;
  }

  if (action.kind === "rush-delivery") {
    deliverDeal(player.teamIndex, action.slotIndex, "End-of-Month Rush pushed the deal over the line.");
    consumeAction();
    discardCards([card]);
    maybeTriggerServiceAdvisor();
    render();
    return;
  }

  if (action.kind === "recall") {
    if (absorbTeamSabotage(action.teamIndex, card.name)) {
      consumeAction();
      discardCards([card]);
      maybeTriggerServiceAdvisor();
      render();
      return;
    }

    state.teams[action.teamIndex].vehiclePenalty = {
      amount: 2,
      casterTeamIndex: player.teamIndex,
      expiresAtCasterTurn: state.teams[player.teamIndex].teamTurns + 1
    };
    consumeAction();
    discardCards([card]);
    maybeTriggerServiceAdvisor();
    logEvent(`${player.name} launched Recall Campaign against ${TEAM_CONFIG[action.teamIndex].name}.`);
    render();
    return;
  }

  if (action.kind === "chargeback") {
    if (absorbTeamSabotage(action.teamIndex, card.name)) {
      consumeAction();
      discardCards([card]);
      maybeTriggerServiceAdvisor();
      render();
      return;
    }

    const targetTeam = state.teams[action.teamIndex];
    const previous = targetTeam.lastDeliveredSale ?? 0;
    const reduced = Math.max(5, Math.floor(previous / 2));
    const delta = reduced - previous;
    gainTeamProfit(action.teamIndex, delta, "Chargeback cut down the most recent delivered deal.");
    targetTeam.lastDeliveredSale = reduced;
    consumeAction();
    discardCards([card]);
    maybeTriggerServiceAdvisor();
    render();
    return;
  }

  if (action.kind === "remove-client") {
    if (absorbDealProtection(action.teamIndex, action.slotIndex, "client", card.name)) {
      consumeAction();
      discardCards([card]);
      maybeTriggerServiceAdvisor();
      render();
      return;
    }

    const deal = getDeal(action.teamIndex, action.slotIndex);

    if (deal?.client) {
      discardCards([deal.client]);
      deal.client = null;
      updateDealCompletion(action.teamIndex, action.slotIndex);
      removeDealIfEmpty(action.teamIndex, action.slotIndex);
      logEvent(`${player.name} used Internet Lead Ghosts You on ${TEAM_CONFIG[action.teamIndex].slotLabels[action.slotIndex]}.`);
    }

    consumeAction();
    discardCards([card]);
    maybeTriggerServiceAdvisor();
    render();
    return;
  }

  if (action.kind === "remove-employee") {
    if (absorbDealProtection(action.teamIndex, action.slotIndex, "employee", card.name)) {
      consumeAction();
      discardCards([card]);
      maybeTriggerServiceAdvisor();
      render();
      return;
    }

    const deal = getDeal(action.teamIndex, action.slotIndex);

    if (deal?.employee) {
      discardCards([deal.employee]);
      deal.employee = null;
      updateDealCompletion(action.teamIndex, action.slotIndex);
      removeDealIfEmpty(action.teamIndex, action.slotIndex);
      logEvent(`${player.name} forced an Employee Quits on ${TEAM_CONFIG[action.teamIndex].slotLabels[action.slotIndex]}.`);
    }

    consumeAction();
    discardCards([card]);
    maybeTriggerServiceAdvisor();
    render();
    return;
  }

  consumeAction();
  discardCards([card]);
};

const buildHandActions = (player, card) => {
  const ownTeamIndex = player.teamIndex;
  const enemyTeamIndex = opposingTeamIndex(ownTeamIndex);

  if (card.name === "Manufacturer Audit") {
    return [];
  }

  if (card.type === "Client") {
    return TEAM_CONFIG[ownTeamIndex].slotLabels
      .map((label, slotIndex) => ({ label, slotIndex }))
      .filter(({ slotIndex }) => !getDeal(ownTeamIndex, slotIndex)?.client)
      .map(({ label, slotIndex }) => ({
        label: `${getDeal(ownTeamIndex, slotIndex) ? "Add to" : "Start"} ${label}`,
        kind: "attach",
        slotIndex
      }));
  }

  if (card.type === "Vehicle") {
    return TEAM_CONFIG[ownTeamIndex].slotLabels
      .map((label, slotIndex) => ({ label, slotIndex }))
      .filter(({ slotIndex }) => dealCanTakeVehicle(getDeal(ownTeamIndex, slotIndex)))
      .map(({ label, slotIndex }) => ({
        label: `${getDeal(ownTeamIndex, slotIndex) ? "Add to" : "Start"} ${label}`,
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

    return getOwnDealOptions(ownTeamIndex, (deal) => !deal?.employee)
      .map(({ slotIndex }) => ({
        label: `Staff ${TEAM_CONFIG[ownTeamIndex].slotLabels[slotIndex]}`,
        kind: "attach",
        slotIndex
      }));
  }

  if (card.type === "Legendary") {
    if (card.name === "Dealer Principal") {
      return getOwnDealOptions(ownTeamIndex, (deal) => Boolean(deal)).map(({ slotIndex }) => ({
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
    return getOwnDealOptions(ownTeamIndex, (deal) => {
      if (!getVehicleCount(deal)) {
        return false;
      }

      if (card.name === "Market Adjustment" && getVehiclesForDeal(deal).some((vehicleCard) => vehicleCard.name === "Base Model Sedan")) {
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
    return getOpponentDealOptions(ownTeamIndex, (deal) => Boolean(deal.employee)).map(({ slotIndex }) => ({
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
    const total = hasMiniActive(ownTeamIndex) ? 7 : 5;
    return [{
      label: `Gain ${total} profit`,
      kind: "team-profit",
      teamIndex: ownTeamIndex,
      amount: total,
      reason: "Viral Social Post spiked showroom buzz."
    }];
  }

  if (card.name === "Internet Lead Ghosts You") {
    return getOpponentDealOptions(ownTeamIndex, (deal) => Boolean(deal.client)).map(({ slotIndex }) => ({
      label: `Ghost ${TEAM_CONFIG[enemyTeamIndex].slotLabels[slotIndex]}`,
      kind: "remove-client",
      teamIndex: enemyTeamIndex,
      slotIndex
    }));
  }

  if (card.name === "Google Review Hero") {
    return getOwnDealOptions(ownTeamIndex, (deal) => Boolean(deal.employee)).map(({ slotIndex }) => ({
      label: `Attach to ${TEAM_CONFIG[ownTeamIndex].slotLabels[slotIndex]}`,
      kind: "attach",
      slotIndex
    }));
  }

  if (card.name === "End-of-Month Rush") {
    return getOwnDealOptions(ownTeamIndex, (deal) => isDealRushEligible(deal)).map(({ slotIndex }) => ({
      label: `Deliver ${TEAM_CONFIG[ownTeamIndex].slotLabels[slotIndex]}`,
      kind: "rush-delivery",
      slotIndex
    }));
  }

  if (card.name === "Customer For Life") {
    return getOwnDealOptions(ownTeamIndex, (deal) => Boolean(deal.client && deal.client.name !== "Dream Customer")).map(({ slotIndex }) => ({
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

const matchesSearch = (card, query) => {
  if (!query) {
    return true;
  }

  const haystack = [card.name, card.type, card.effect, card.notes, card.artwork, card.value].join(" ").toLowerCase();
  return haystack.includes(query.toLowerCase());
};

const getFilteredCards = () => {
  const query = searchInput.value.trim();

  return baseCards
    .filter((card) => activeType === "All" || card.type === activeType)
    .filter((card) => matchesSearch(card, query))
    .sort((a, b) => {
      switch (sortSelect.value) {
        case "value-desc":
          return numericValue(b.value) - numericValue(a.value) || a.id - b.id;
        case "value-asc":
          return numericValue(a.value) - numericValue(b.value) || a.id - b.id;
        case "name":
          return a.name.localeCompare(b.name);
        case "id":
        default:
          return a.id - b.id;
      }
    });
};

const renderSummary = () => {
  const allTypes = ["Client", "Vehicle", "Employee", "Event", "Legendary"];
  summaryStrip.innerHTML = "";

  allTypes.forEach((type) => {
    const total = baseCards.filter((card) => card.type === type).length;
    const item = document.createElement("article");
    item.className = "summary-card";
    item.innerHTML = `
      <h3>${type}s</h3>
      <p>${total}</p>
    `;
    summaryStrip.append(item);
  });
};

const renderFilters = () => {
  const types = ["All", "Client", "Vehicle", "Employee", "Event", "Legendary"];
  filterContainer.innerHTML = "";

  types.forEach((type) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `filter-chip${type === activeType ? " is-active" : ""}`;
    button.textContent = type;
    button.addEventListener("click", () => {
      activeType = type;
      renderFilters();
      renderLibrary();
    });
    filterContainer.append(button);
  });
};

const renderLibrary = () => {
  const visibleCards = getFilteredCards();
  cardsGrid.innerHTML = "";
  visibleCount.textContent = String(visibleCards.length);

  if (!visibleCards.length) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.textContent = "No cards match that search right now.";
    cardsGrid.append(emptyState);
    return;
  }

  visibleCards.forEach((card) => {
    const fragment = libraryCardTemplate.content.cloneNode(true);
    const cardElement = fragment.querySelector(".library-card");
    cardElement.style.setProperty("--type-color", typeColors[card.type]);
    fragment.querySelector(".card-rank").textContent = card.type;
    fragment.querySelector(".card-id").textContent = `#${String(card.id).padStart(2, "0")}`;
    fragment.querySelector(".card-type").textContent = card.type;
    fragment.querySelector(".card-name").textContent = card.name;
    fragment.querySelector(".card-value").textContent = card.value;
    fragment.querySelector(".card-art").textContent = card.artwork;
    fragment.querySelector(".card-effect").textContent = card.effect;
    fragment.querySelector(".card-notes").textContent = card.notes;
    fragment.querySelector(".card-artwork").textContent = card.artwork;
    cardsGrid.append(fragment);
  });
};

const readPlayerSetup = () => playerSetup.map((player, index) => {
  const card = playerSetupGrid.querySelector(`[data-setup-index="${index}"]`);

  if (!card) {
    return { ...player };
  }

  const nameInput = card.querySelector("[data-setup-field='name']");
  const controlInput = card.querySelector("[data-setup-field='control']");
  const personalityInput = card.querySelector("[data-setup-field='personality']");
  const personality = getPersonality(personalityInput?.value);
  const isHuman = controlInput?.value === "human";
  const enteredName = nameInput?.value.trim() ?? "";
  const fallbackName = isHuman ? `Player ${index + 1}` : personality.name;
  const name = !enteredName || isGeneratedSeatName(enteredName, index) ? fallbackName : enteredName;

  return {
    ...player,
    name,
    title: isHuman ? player.title : personality.title,
    isHuman,
    personalityId: personality.id
  };
});

const syncPlayerSetup = () => {
  playerSetup = readPlayerSetup();
};

const renderPlayerSetup = () => {
  playerSetupGrid.innerHTML = "";

  playerSetup.forEach((player, index) => {
    const personality = getPersonality(player.personalityId);
    const card = document.createElement("article");
    card.className = "setup-card";
    card.dataset.setupIndex = String(index);

    const personalityOptions = AI_PERSONALITIES.map((option) =>
      `<option value="${option.id}"${option.id === personality.id ? " selected" : ""}>${escapeHtml(option.name)}</option>`
    ).join("");

    card.innerHTML = `
      <div class="setup-card-heading">
        <div>
          <p class="eyebrow">${escapeHtml(TEAM_CONFIG[player.teamIndex].name)}</p>
          <h3>Seat ${index + 1}</h3>
        </div>
        <span>${escapeHtml(TEAM_CONFIG[player.teamIndex].label)}</span>
      </div>
      <label class="setup-field">
        <span>Name</span>
        <input data-setup-field="name" type="text" value="${escapeHtml(player.name)}" maxlength="28" />
      </label>
      <div class="setup-row">
        <label class="setup-field">
          <span>Control</span>
          <select data-setup-field="control">
            <option value="human"${player.isHuman ? " selected" : ""}>Human</option>
            <option value="ai"${player.isHuman ? "" : " selected"}>AI</option>
          </select>
        </label>
        <label class="setup-field">
          <span>Personality</span>
          <select data-setup-field="personality">
            ${personalityOptions}
          </select>
        </label>
      </div>
      <p class="personality-note">${escapeHtml(personality.tagline)}</p>
    `;

    playerSetupGrid.append(card);
  });

  playerSetupGrid.querySelectorAll("input, select").forEach((input) => {
    input.addEventListener("change", () => {
      syncPlayerSetup();
      renderPlayerSetup();
    });
  });
};

const renderScoreboard = () => {
  scoreboard.innerHTML = "";

  state.teams.forEach((team, teamIndex) => {
    const card = document.createElement("article");
    card.className = "score-card";
    card.innerHTML = `
      <div class="score-row">
        <div>
          <p class="eyebrow">${TEAM_CONFIG[teamIndex].name}</p>
          <h3>${TEAM_CONFIG[teamIndex].label}</h3>
        </div>
        <strong>${team.profit}</strong>
      </div>
      <div class="score-meta">
        <span>Delivered deals: ${team.deliveredDeals.length}</span>
        <span>Active deals: ${team.slots.filter(Boolean).length}</span>
        <span>Team turns: ${team.teamTurns}</span>
      </div>
    `;
    scoreboard.append(card);
  });
};

const getDealStatus = (deal) => {
  if (!deal) {
    return { label: "Open", className: "status-building" };
  }

  if (isDealComplete(deal)) {
    return { label: "Pending Delivery", className: "status-pending" };
  }

  if (deal.employee?.name === "Receptionist" || deal.employee?.name === "GSM" || deal.employee?.name === "Superstar Employee") {
    return { label: "Protected", className: "status-protected" };
  }

  if (getVehicleCount(deal) && getTeamVehiclePenalty(deal.teamIndex)) {
    return { label: "Threatened", className: "status-threatened" };
  }

  return { label: "Building", className: "status-building" };
};

const renderDealSlot = (teamIndex, slotIndex) => {
  const slot = document.createElement("article");
  const slotLabel = TEAM_CONFIG[teamIndex].slotLabels[slotIndex];
  const deal = getDeal(teamIndex, slotIndex);
  slot.dataset.teamIndex = String(teamIndex);
  slot.dataset.slotIndex = String(slotIndex);

  if (!deal) {
    slot.className = "deal-slot empty";
    slot.innerHTML = `
      <div>
        <strong>${slotLabel}</strong>
        <p>Open slot for a new customer or vehicle.</p>
      </div>
    `;
    return slot;
  }

  const status = getDealStatus(deal);
  const vehicleNames = getVehiclesForDeal(deal).map((vehicleCard) => getEffectiveVehicleName(deal, vehicleCard));
  const vehicleLabel = vehicleNames.length ? vehicleNames.join(", ") : "Missing";
  const attachments = deal.attachments.length
    ? `<p class="deal-notes"><strong>Attachments:</strong> ${escapeHtml(deal.attachments.map((card) => card.name).join(", "))}</p>`
    : `<p class="deal-notes"><strong>Attachments:</strong> None yet</p>`;

  slot.className = "deal-slot";
  slot.style.setProperty("--slot-color", typeColors[deal.client?.type ?? deal.vehicle?.type ?? "All"]);
  slot.innerHTML = `
    <div class="deal-header">
      <div>
        <p class="eyebrow">${slotLabel}</p>
        <h3>${escapeHtml(deal.client?.name ?? vehicleNames[0] ?? "Active Deal")}</h3>
      </div>
      <span class="status-badge ${status.className}">${status.label}</span>
    </div>
    <div class="deal-lineup">
      <span class="deal-pill ${deal.client ? "" : "missing"}"><strong>Client</strong> ${escapeHtml(deal.client?.name ?? "Missing")}</span>
      <span class="deal-pill ${vehicleNames.length ? "" : "missing"}"><strong>Vehicle</strong> ${escapeHtml(vehicleLabel)}</span>
      <span class="deal-pill ${deal.employee ? "" : "missing"}"><strong>Employee</strong> ${escapeHtml(deal.employee?.name ?? "Missing")}</span>
    </div>
    ${attachments}
    <div class="deal-stats">
      <span>Projected profit: ${computeDealValue(deal)}</span>
      <span>Owner: ${escapeHtml(getPlayerById(deal.ownerPlayerId)?.name ?? "Team")}</span>
    </div>
  `;

  return slot;
};

const renderPlayers = () => {
  team0Players.innerHTML = "";
  team1Players.innerHTML = "";

  state.players.forEach((player, playerIndex) => {
    const chip = document.createElement("article");
    chip.className = `player-chip${playerIndex === state.currentPlayerIndex ? " is-current" : ""}`;
    const personality = getPersonality(player.personalityId);
    chip.innerHTML = `
      <div class="player-row">
        <h3>${escapeHtml(player.name)}</h3>
        <span>${player.isHuman ? "Human" : "AI"} | ${player.hand.length} cards</span>
      </div>
      <p>${escapeHtml(player.isHuman ? player.title : `${personality.name} - ${personality.tagline}`)}</p>
    `;

    if (player.teamIndex === 0) {
      team0Players.append(chip);
    } else {
      team1Players.append(chip);
    }
  });
};

const renderTable = () => {
  team0Slots.innerHTML = "";
  team1Slots.innerHTML = "";
  TEAM_CONFIG[0].slotLabels.forEach((_, slotIndex) => team0Slots.append(renderDealSlot(0, slotIndex)));
  TEAM_CONFIG[1].slotLabels.forEach((_, slotIndex) => team1Slots.append(renderDealSlot(1, slotIndex)));
};

const renderLog = () => {
  logList.innerHTML = "";

  state.log.forEach((entry) => {
    const item = document.createElement("li");
    item.textContent = entry;
    logList.append(item);
  });
};

const getCurrentCardByUid = (cardUid) => currentPlayer().hand.find((card) => card.uid === cardUid);

const getAttachActionForSlot = (cardUid, teamIndex, slotIndex) => {
  const card = getCurrentCardByUid(cardUid);

  if (!card) {
    return null;
  }

  return buildHandActions(currentPlayer(), card).find(
    (action) => action.kind === "attach" && action.slotIndex === slotIndex && currentPlayer().teamIndex === teamIndex
  ) ?? null;
};

const clearDragHighlights = () => {
  document.querySelectorAll(".deal-slot").forEach((slot) => {
    slot.classList.remove("can-drop", "is-over");
  });
};

const bindDragAndDrop = () => {
  document.querySelectorAll(".hand-card[draggable='true']").forEach((cardElement) => {
    cardElement.addEventListener("dragstart", () => {
      dragCardUid = cardElement.dataset.cardUid;
      cardElement.classList.add("is-dragging");

      document.querySelectorAll(".deal-slot").forEach((slot) => {
        const teamIndex = Number(slot.dataset.teamIndex);
        const slotIndex = Number(slot.dataset.slotIndex);

        if (!Number.isNaN(teamIndex) && !Number.isNaN(slotIndex) && getAttachActionForSlot(dragCardUid, teamIndex, slotIndex)) {
          slot.classList.add("can-drop");
        }
      });
    });

    cardElement.addEventListener("dragend", () => {
      dragCardUid = null;
      cardElement.classList.remove("is-dragging");
      clearDragHighlights();
    });
  });

  document.querySelectorAll(".deal-slot").forEach((slot) => {
    slot.addEventListener("dragover", (event) => {
      const teamIndex = Number(slot.dataset.teamIndex);
      const slotIndex = Number(slot.dataset.slotIndex);

      if (dragCardUid && getAttachActionForSlot(dragCardUid, teamIndex, slotIndex)) {
        event.preventDefault();
        slot.classList.add("is-over");
      }
    });

    slot.addEventListener("dragleave", () => {
      slot.classList.remove("is-over");
    });

    slot.addEventListener("drop", (event) => {
      const teamIndex = Number(slot.dataset.teamIndex);
      const slotIndex = Number(slot.dataset.slotIndex);
      const action = dragCardUid ? getAttachActionForSlot(dragCardUid, teamIndex, slotIndex) : null;
      event.preventDefault();
      clearDragHighlights();

      if (!action) {
        dragCardUid = null;
        return;
      }

      const cardUid = dragCardUid;
      dragCardUid = null;
      executeCardAction(cardUid, action);
    });
  });
};

const renderHand = () => {
  const player = currentPlayer();
  handTitle.textContent = `${player.name} hand`;
  handCaption.textContent = player.isHuman
    ? `${TEAM_CONFIG[player.teamIndex].name} has ${state.actionsRemaining} action${state.actionsRemaining === 1 ? "" : "s"} remaining this turn. Chain plays by dragging onto the board or using the quick buttons below each card.`
    : `${player.name} is AI-controlled and will take this turn automatically.`;
  handGrid.innerHTML = "";

  if (!player.hand.length) {
    const empty = document.createElement("div");
    empty.className = "hand-empty";
    empty.textContent = "No cards in hand.";
    handGrid.append(empty);
    return;
  }

  player.hand.forEach((card) => {
    const cardElement = document.createElement("article");
    const actions = buildHandActions(player, card);
    const canDrag = player.isHuman && state.actionsRemaining > 0 && actions.some((action) => action.kind === "attach");

    cardElement.className = "hand-card";
    cardElement.style.setProperty("--type-color", typeColors[card.type]);
    cardElement.dataset.cardUid = card.uid;
    cardElement.draggable = canDrag;
    cardElement.classList.toggle("is-draggable", canDrag);

    const actionButtons = actions.length
      ? actions.map((action) =>
          `<button class="${action.kind === "attach" ? "play-button" : "mini-button"}" data-card-uid="${card.uid}" data-action='${JSON.stringify(action)}'>${action.label}</button>`
        ).join("")
      : `<button class="mini-button" type="button" disabled>No playable target</button>`;

    cardElement.innerHTML = `
      <div class="card-chrome">
        <span class="card-rank">${card.type}</span>
        <span class="card-id">#${String(card.id).padStart(2, "0")}</span>
      </div>
      <div class="card-topline">
        <span class="card-type">${card.type}</span>
        <strong class="card-value">${card.value}</strong>
      </div>
      <h3>${card.name}</h3>
      <p class="card-art">${card.artwork}</p>
      <div class="card-copy">
        <p class="hand-text">${card.effect}</p>
        <p class="hand-text"><span class="meta-label">Combo / Notes</span><br />${card.notes}</p>
      </div>
      <div class="action-list">${actionButtons}</div>
    `;

    handGrid.append(cardElement);
  });

  handGrid.querySelectorAll("button[data-card-uid]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.actionsRemaining <= 0 || !currentPlayer().isHuman) {
        return;
      }

      const action = JSON.parse(button.dataset.action);
      executeCardAction(button.dataset.cardUid, action);
    });
  });

  if (player.isHuman) {
    bindDragAndDrop();
  }
};

const renderTurnState = () => {
  const player = currentPlayer();
  const team = currentTeam();
  const opponent = state.teams[opposingTeamIndex(player.teamIndex)];

  heroDeckCount.textContent = String(state.deck.length);
  heroDiscardCount.textContent = String(state.discard.length);
  heroTurnCount.textContent = String(state.turnNumber);
  turnTitle.textContent = `${player.name} for ${TEAM_CONFIG[player.teamIndex].name}`;
  turnMeta.textContent = `${player.title} is up${player.isHuman ? "" : " on AI autopilot"}. Team ${team.profit} profit vs ${opponent.profit}. ${state.actionsRemaining} card play${state.actionsRemaining === 1 ? "" : "s"} left this turn.`;

  if (state.winner) {
    winnerBanner.textContent = `${state.winner.name} wins`;
    winnerBanner.className = "winner-yes";
    tableSummary.textContent = state.winner.reason;
  } else {
    winnerBanner.textContent = "No winner yet";
    winnerBanner.className = "";
    tableSummary.textContent = `Deck ${state.deck.length} cards left, discard pile ${state.discard.length}, active deals ${state.teams[0].slots.filter(Boolean).length + state.teams[1].slots.filter(Boolean).length}.`;
  }

  endTurnButton.disabled = Boolean(state.winner) || !player.isHuman;
  runAiButton.disabled = Boolean(state.winner) || player.isHuman;
};

const scoreBaseAction = (player, card, action) => {
  const ownTeamIndex = player.teamIndex;
  const enemyTeamIndex = opposingTeamIndex(ownTeamIndex);

  if (action.kind === "dealer-principal") {
    const targetDeal = getDeal(ownTeamIndex, action.slotIndex);
    return 300 + computeDealValue(targetDeal);
  }

  if (action.kind === "rush-delivery") {
    const targetDeal = getDeal(ownTeamIndex, action.slotIndex);
    return 240 + computeDealValue(targetDeal);
  }

  if (action.kind === "attach") {
    const deal = getDeal(ownTeamIndex, action.slotIndex);
    let score = 70 + getCardValue(card);

    if (!deal) {
      score += 10;
    }

    if (card.type === "Employee" && deal?.client && getVehicleCount(deal) > 0) {
      score += 160 + computeDealValue(deal);
    }

    if (card.type === "Vehicle" && deal?.client && deal.employee) {
      score += 160 + computeDealValue(deal);
    }

    if (card.type === "Client" && getVehicleCount(deal) > 0 && deal?.employee) {
      score += 160 + computeDealValue(deal);
    }

    if (card.name === "Receptionist" || card.name === "GSM" || card.name === "Superstar Employee") {
      score += 45;
    }

    if (card.name === "Customer For Life" && deal?.client) {
      score += 35;
    }

    if (card.name === "Factory Incentive" || card.name === "Market Adjustment") {
      score += 55;
    }

    if (deal?.client?.name === "Corporate Fleet Buyer" && card.type === "Vehicle") {
      score += 65;
    }

    return score;
  }

  if (action.kind === "team-profit") {
    const nearWinBonus = action.teamIndex === ownTeamIndex && state.teams[ownTeamIndex].profit + action.amount >= WIN_TARGET ? 200 : 0;
    const stopWinBonus = action.teamIndex === enemyTeamIndex && state.teams[enemyTeamIndex].profit >= 80 ? 85 : 0;
    return (action.amount >= 0 ? 90 : 110) + (Math.abs(action.amount) * 9) + nearWinBonus + stopWinBonus;
  }

  if (action.kind === "remove-client" || action.kind === "remove-employee") {
    const targetDeal = getDeal(action.teamIndex, action.slotIndex);
    return 140 + computeDealValue(targetDeal) + (isDealComplete(targetDeal) ? 120 : 0);
  }

  if (action.kind === "recall") {
    const enemyVehicleCount = state.teams[enemyTeamIndex].slots.reduce((sum, deal) => sum + getVehicleCount(deal), 0);
    return 90 + (enemyVehicleCount * 20);
  }

  if (action.kind === "chargeback") {
    return 130 + (state.teams[enemyTeamIndex].lastDeliveredSale ?? 0);
  }

  if (action.kind === "massive-trade") {
    const vehicleCountInHand = player.hand.filter((handCard) => handCard.type === "Vehicle").length;
    return vehicleCountInHand === 0 ? 130 : 80;
  }

  if (action.kind === "search-client") {
    const clientCountInHand = player.hand.filter((handCard) => handCard.type === "Client").length;
    return clientCountInHand === 0 ? 125 : 70;
  }

  if (action.kind === "draw-one") {
    return 60;
  }

  if (action.kind === "extra-action") {
    return 105;
  }

  return 0;
};

const scoreAiPersonalityBonus = (player, card, action) => {
  const weights = getPersonality(player.personalityId).weights;
  const ownTeamIndex = player.teamIndex;
  const enemyTeamIndex = opposingTeamIndex(ownTeamIndex);
  let bonus = 0;

  if (action.kind === "dealer-principal" || action.kind === "rush-delivery") {
    bonus += weights.delivery ?? 0;
  }

  if (action.kind === "team-profit") {
    bonus += action.teamIndex === ownTeamIndex ? (weights.ownProfit ?? 0) : (weights.enemyProfit ?? 0);
  }

  if (action.kind === "remove-client" || action.kind === "remove-employee" || action.kind === "recall" || action.kind === "chargeback") {
    bonus += weights.sabotage ?? 0;
  }

  if ((action.kind === "remove-client" || action.kind === "remove-employee") && isDealComplete(getDeal(action.teamIndex, action.slotIndex))) {
    bonus += weights.denyDelivery ?? 0;
  }

  if (action.kind === "massive-trade") {
    bonus += weights.massiveTrade ?? 0;
  }

  if (action.kind === "search-client") {
    bonus += weights.searchClient ?? 0;
  }

  if (action.kind === "attach") {
    const deal = getDeal(ownTeamIndex, action.slotIndex);
    bonus += weights.attachment ?? 0;

    if (card.type === "Client") {
      bonus += weights.client ?? 0;
    }

    if (card.type === "Vehicle") {
      bonus += weights.vehicle ?? 0;
    }

    if (card.type === "Employee") {
      bonus += weights.employee ?? 0;
    }

    if (card.name === "Receptionist" || card.name === "GSM" || card.name === "Superstar Employee") {
      bonus += weights.protection ?? 0;
    }

    if (deal && isDealComplete(deal)) {
      bonus += weights.completion ?? 0;
    }
  }

  return bonus;
};

const scoreAction = (player, card, action) =>
  scoreBaseAction(player, card, action) + scoreAiPersonalityBonus(player, card, action);

const pickAiMove = (player) => {
  let bestMove = null;

  player.hand.forEach((card) => {
    const actions = buildHandActions(player, card);

    actions.forEach((action) => {
      const score = scoreAction(player, card, action);

      if (!bestMove || score > bestMove.score) {
        bestMove = {
          cardUid: card.uid,
          action,
          score
        };
      }
    });
  });

  return bestMove;
};

const runAiTurn = () => {
  aiTurnTimer = null;
  aiFrameHandle = null;

  if (!isAiTurn()) {
    return;
  }

  if (state.actionsRemaining <= 0) {
    aiTurnTimer = setTimeout(() => {
      aiTurnTimer = null;
      endTurn();
    }, 420);
    return;
  }

  const move = pickAiMove(currentPlayer());

  if (!move) {
    aiTurnTimer = setTimeout(() => {
      aiTurnTimer = null;
      endTurn();
    }, 420);
    return;
  }

  executeCardAction(move.cardUid, move.action);
};

const maybeScheduleAiTurn = () => {
  if (!isAiTurn() || aiTurnTimer || aiFrameHandle) {
    return;
  }

  aiFrameHandle = requestAnimationFrame(() => {
    aiFrameHandle = null;
    aiTurnTimer = setTimeout(runAiTurn, AI_DELAY_MS);
  });
};

const render = () => {
  renderTurnState();
  renderScoreboard();
  renderTable();
  renderPlayers();
  renderLog();
  renderHand();
  renderLibrary();
  maybeScheduleAiTurn();
};

const checkForWinner = () => {
  const winningTeam = state.teams.find((team) => team.profit >= WIN_TARGET);

  if (winningTeam) {
    state.winner = {
      name: TEAM_CONFIG[state.teams.indexOf(winningTeam)].name,
      reason: `${TEAM_CONFIG[state.teams.indexOf(winningTeam)].name} crossed ${WIN_TARGET} profit.`
    };
    clearAiTurnTimer();
    return;
  }

  const activeDealsRemaining = state.teams.some((team) => team.slots.some(Boolean));

  if (!state.deck.length && state.players.every((player) => player.hand.length === 0) && !activeDealsRemaining) {
    const winnerTeamIndex = state.teams[0].profit === state.teams[1].profit
      ? null
      : state.teams[0].profit > state.teams[1].profit
        ? 0
        : 1;

    state.winner = winnerTeamIndex === null
      ? {
          name: "Tie game",
          reason: "The deck ran out, all deals resolved, and both teams finished level on profit."
        }
      : {
          name: TEAM_CONFIG[winnerTeamIndex].name,
          reason: `The deck ran dry, all deals resolved, and ${TEAM_CONFIG[winnerTeamIndex].name} finished ahead on profit.`
        };
    clearAiTurnTimer();
  }
};

const beginTurn = () => {
  clearAiTurnTimer();

  if (state.winner) {
    render();
    return;
  }

  const player = currentPlayer();
  const team = state.teams[player.teamIndex];
  state.turnNumber += 1;
  team.teamTurns += 1;
  team.sabotageBlockedThisTurn = false;
  team.deliveredThisTurn = false;

  resolvePendingDeliveries(player.teamIndex);
  if (state.winner) {
    render();
    return;
  }

  drawCards(player, 1);
  state.actionsRemaining = BASE_ACTIONS_PER_TURN + team.extraActionsNextTurn;
  team.extraActionsNextTurn = 0;

  logEvent(`${player.name} started a turn, drew 1 card, and has ${state.actionsRemaining} action${state.actionsRemaining === 1 ? "" : "s"}.`);
  checkForWinner();
  render();

  if (isAiTurn()) {
    maybeScheduleAiTurn();
  }
};

const endTurn = () => {
  clearAiTurnTimer();

  if (state.winner) {
    return;
  }

  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  beginTurn();
};

const startNewGame = () => {
  clearAiTurnTimer();
  dragCardUid = null;
  nextUid = 1;
  syncPlayerSetup();

  state = {
    deck: shuffle(baseCards.map(cloneCard)),
    discard: [],
    log: [],
    players: playerSetup.map((player, index) => ({
      id: `player-${index + 1}`,
      ...player,
      title: player.isHuman ? player.title : getPersonality(player.personalityId).title,
      hand: []
    })),
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
    })),
    currentPlayerIndex: 0,
    actionsRemaining: BASE_ACTIONS_PER_TURN,
    turnNumber: 0,
    winner: null
  };

  state.players.forEach((player) => drawCards(player, OPENING_HAND_SIZE));
  logEvent("A fresh Dealership Wars match has started.");
  beginTurn();
};

const bindEvents = () => {
  newGameButton.addEventListener("click", startNewGame);
  endTurnButton.addEventListener("click", () => {
    if (!currentPlayer().isHuman) {
      return;
    }

    endTurn();
  });
  runAiButton.addEventListener("click", () => {
    if (!isAiTurn()) {
      return;
    }

    clearAiTurnTimer();
    runAiTurn();
  });
  searchInput.addEventListener("input", renderLibrary);
  sortSelect.addEventListener("change", renderLibrary);
  resetButton.addEventListener("click", () => {
    activeType = "All";
    searchInput.value = "";
    sortSelect.value = "id";
    renderFilters();
    renderLibrary();
  });
};

const init = () => {
  if (!baseCardsData.length) {
    cardsGrid.innerHTML = `
      <div class="empty-state">
        The simulator could not load the deck data.
      </div>
    `;
    return;
  }

  baseCards = baseCardsData;
  renderSummary();
  renderFilters();
  renderPlayerSetup();
  bindEvents();
  startNewGame();
};

init();
