import { AI_PERSONALITIES, getAiPersonality, SEAT_CONFIG, TYPE_COLORS, CASH_TARGET } from "/shared/constants.js";

const connectionLabel = document.querySelector("#connection-label");
const roomLabel = document.querySelector("#room-label");
const messageBanner = document.querySelector("#message-banner");
const animationLayer = document.querySelector("#animation-layer");

const landingScreen = document.querySelector("#landing-screen");
const lobbyScreen = document.querySelector("#lobby-screen");
const gameScreen = document.querySelector("#game-screen");

const createForm = document.querySelector("#create-form");
const createSeatSelect = document.querySelector("#create-seat");
const createAiSetup = document.querySelector("#create-ai-setup");
const joinForm = document.querySelector("#join-form");
const reconnectButton = document.querySelector("#reconnect-button");
const readyButton = document.querySelector("#ready-button");
const startButton = document.querySelector("#start-button");
const endTurnButton = document.querySelector("#end-turn-button");

const seatGrid = document.querySelector("#seat-grid");
const turnTitle = document.querySelector("#turn-title");
const turnMeta = document.querySelector("#turn-meta");
const saleBar = document.querySelector("#sale-bar");
const saleActions = document.querySelector("#sale-actions");
const dealerGrid = document.querySelector("#dealer-grid");
const deckCount = document.querySelector("#deck-count");
const discardCount = document.querySelector("#discard-count");
const actionsCount = document.querySelector("#actions-count");
const winnerTitle = document.querySelector("#winner-title");
const winnerCopy = document.querySelector("#winner-copy");
const logList = document.querySelector("#log-list");
const handTitle = document.querySelector("#hand-title");
const handGrid = document.querySelector("#hand-grid");
const libraryGrid = document.querySelector("#library-grid");
const searchInput = document.querySelector("#search-input");

const sessionStorageKey = "dealership-wars-session";
const typeColors = TYPE_COLORS;

const createSeatDefaults = SEAT_CONFIG.map((seat) => ({
  seatIndex: seat.seatIndex,
  control: seat.seatIndex === 0 ? "human" : "ai",
  personalityId: AI_PERSONALITIES[seat.seatIndex % AI_PERSONALITIES.length].id
}));

let createSeatSetupState = [...createSeatDefaults];

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const getCardGraphicPath = (card) => `/client/assets/cards/${String(card.id).padStart(2, "0")}-${slugify(card.name)}.svg`;

const readCreateSeatSetup = () => createSeatSetupState.map((seat) => {
  const card = createAiSetup.querySelector(`[data-seat-index="${seat.seatIndex}"]`);
  return {
    seatIndex: seat.seatIndex,
    control: card?.querySelector("[data-seat-field='control']")?.value ?? seat.control,
    personalityId: card?.querySelector("[data-seat-field='personality']")?.value ?? seat.personalityId
  };
});

const syncCreateSeatSetup = () => {
  createSeatSetupState = readCreateSeatSetup();
};

const renderCreateSeatSetup = () => {
  const hostSeatIndex = Number(createSeatSelect.value);
  createAiSetup.innerHTML = "";

  createSeatSetupState.forEach((seat) => {
    const seatConfig = SEAT_CONFIG[seat.seatIndex];
    const isHostSeat = seat.seatIndex === hostSeatIndex;
    const control = isHostSeat ? "human" : seat.control;
    const personality = getAiPersonality(seat.personalityId);
    const node = document.createElement("article");
    node.className = "ai-seat-card";
    node.dataset.seatIndex = String(seat.seatIndex);
    node.innerHTML = `
      <div class="ai-seat-heading">
        <strong>${seatConfig.dealership}</strong>
        <span>${seatConfig.key}</span>
      </div>
      <label>
        <span>Control</span>
        <select data-seat-field="control"${isHostSeat ? " disabled" : ""}>
          <option value="human"${control === "human" ? " selected" : ""}>Human seat</option>
          <option value="ai"${control === "ai" ? " selected" : ""}>AI player</option>
        </select>
      </label>
      <label>
        <span>AI personality</span>
        <select data-seat-field="personality"${control === "human" ? " disabled" : ""}>
          ${AI_PERSONALITIES.map((option) =>
            `<option value="${option.id}"${option.id === personality.id ? " selected" : ""}>${option.name}</option>`
          ).join("")}
        </select>
      </label>
      <p>${personality.tagline}</p>
    `;
    createAiSetup.append(node);
  });

  createAiSetup.querySelectorAll("select").forEach((input) => {
    input.addEventListener("change", () => {
      syncCreateSeatSetup();
      renderCreateSeatSetup();
    });
  });
};

let socket = null;
let session = loadSavedSession();
let view = null;
let libraryCards = [];
let pendingReconnectAttempt = false;
let previousPublicState = null;
let animationQueue = [];
let animationInProgress = false;
const pendingMessages = [];

const getWsUrl = () => {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
};

const showMessage = (text, tone = "info") => {
  if (!text) {
    messageBanner.hidden = true;
    messageBanner.textContent = "";
    messageBanner.className = "message-banner";
    return;
  }

  messageBanner.hidden = false;
  messageBanner.textContent = text;
  messageBanner.className = `message-banner is-${tone}`;
};

const setConnectionState = (label) => {
  connectionLabel.textContent = label;
};

const persistSession = () => {
  if (!session) {
    localStorage.removeItem(sessionStorageKey);
    return;
  }

  localStorage.setItem(sessionStorageKey, JSON.stringify(session));
};

function loadSavedSession() {
  try {
    const saved = localStorage.getItem(sessionStorageKey);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

const send = (type, payload = {}) => {
  if (!socket || socket.readyState === WebSocket.CLOSED) {
    showMessage("WebSocket is not connected yet.", "error");
    return;
  }

  if (socket.readyState === WebSocket.CONNECTING) {
    pendingMessages.push({ type, payload });
    return;
  }

  socket.send(JSON.stringify({ type, payload }));
};

const connectSocket = () => {
  if (socket && [WebSocket.OPEN, WebSocket.CONNECTING].includes(socket.readyState)) {
    return;
  }

  setConnectionState("Connecting");
  socket = new WebSocket(getWsUrl());

  socket.addEventListener("open", () => {
    setConnectionState("Connected");
    showMessage("", "info");

    if (session && pendingReconnectAttempt) {
      send("join_room", {
        roomCode: session.roomCode,
        reconnectToken: session.reconnectToken
      });
    }

    while (pendingMessages.length) {
      const next = pendingMessages.shift();
      socket.send(JSON.stringify(next));
    }
  });

  socket.addEventListener("close", () => {
    setConnectionState("Disconnected");
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);

    if (message.type === "session") {
      session = {
        roomCode: message.payload.roomCode,
        playerId: message.payload.playerId,
        reconnectToken: message.payload.reconnectToken,
        seatIndex: message.payload.seatIndex
      };
      view = message.payload.state;
      previousPublicState = null;
      pendingReconnectAttempt = false;
      persistSession();
      roomLabel.textContent = session.roomCode;
      showMessage(`Connected to room ${session.roomCode}.`, "info");
      render();
      return;
    }

    if (message.type === "state_sync") {
      const lastPublicState = view?.publicState ?? previousPublicState;
      view = message.payload;
      const animationEvents = buildAnimationEvents(lastPublicState, view.publicState);
      previousPublicState = view.publicState;
      render();
      enqueueAnimations(animationEvents);
      return;
    }

    if (message.type === "error") {
      showMessage(message.payload.message, "error");
      return;
    }
  });
};

const fetchLibrary = async () => {
  const response = await fetch("/api/cards");
  libraryCards = await response.json();
  renderLibrary();
};

const createTextNode = (tagName, className, text) => {
  const node = document.createElement(tagName);
  if (className) {
    node.className = className;
  }
  node.textContent = text;
  return node;
};

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const wait = (ms) => new Promise((resolve) => {
  window.setTimeout(resolve, ms);
});

const getCardsByZone = (seat) => [
  ...(seat.customers ?? []).map((card) => ({ card, zone: "showroom" })),
  ...(seat.salespeople ?? []).map((card) => ({ card, zone: "sales team" })),
  ...(seat.vehicles ?? []).map((card) => ({ card, zone: "lot" }))
];

const getCardUidSet = (seat) => new Set(getCardsByZone(seat).map(({ card }) => card.uid));

const findSeatByPlayerId = (state, playerId) =>
  state?.seats?.find((seat) => seat.playerId === playerId) ?? null;

const findSeatMentionedInLog = (state, logEntry, excludedPlayerId = null) => {
  const normalized = logEntry.toLowerCase();
  return [...(state?.seats ?? [])]
    .filter((seat) => seat.playerId && seat.playerId !== excludedPlayerId)
    .sort((left, right) => (right.playerName?.length ?? 0) - (left.playerName?.length ?? 0))
    .find((seat) => {
      const names = [seat.playerName, seat.dealership].filter(Boolean).map((value) => value.toLowerCase());
      return names.some((name) => normalized.includes(name));
    }) ?? null;
};

const findActorForLog = (state, logEntry) => {
  const normalized = logEntry.toLowerCase();
  return [...(state?.seats ?? [])]
    .filter((seat) => seat.playerId && seat.playerName)
    .sort((left, right) => right.playerName.length - left.playerName.length)
    .find((seat) => normalized.startsWith(seat.playerName.toLowerCase())) ?? null;
};

const findNewTableCard = (previousState, nextState, actorPlayerId) => {
  if (!previousState || !nextState) {
    return null;
  }

  const actorSeat = findSeatByPlayerId(nextState, actorPlayerId);
  const previousSeat = findSeatByPlayerId(previousState, actorPlayerId);
  if (!actorSeat || !previousSeat) {
    return null;
  }

  const previousCardUids = getCardUidSet(previousSeat);
  return getCardsByZone(actorSeat).find(({ card }) => !previousCardUids.has(card.uid)) ?? null;
};

const findCardForLog = (previousState, nextState, actorSeat, logEntry) => {
  const newTableCard = actorSeat ? findNewTableCard(previousState, nextState, actorSeat.playerId) : null;
  if (newTableCard) {
    return newTableCard.card;
  }

  const discardTop = nextState?.discardTop;
  if (discardTop && logEntry.toLowerCase().includes(discardTop.name.toLowerCase())) {
    return discardTop;
  }

  return libraryCards.find((card) => logEntry.toLowerCase().includes(card.name.toLowerCase())) ?? discardTop ?? null;
};

const getNewLogEntries = (previousState, nextState) => {
  if (!previousState || !nextState?.log?.length) {
    return [];
  }

  const previousHead = previousState.log?.[0];
  const cutoffIndex = previousHead ? nextState.log.indexOf(previousHead) : -1;
  const entries = cutoffIndex === -1 ? nextState.log.slice(0, 1) : nextState.log.slice(0, cutoffIndex);
  return entries.reverse();
};

const buildResourceEvents = (previousState, nextState) => {
  if (!previousState || !nextState) {
    return [];
  }

  return nextState.seats.flatMap((nextSeat) => {
    const previousSeat = previousState.seats.find((seat) => seat.playerId === nextSeat.playerId);
    if (!previousSeat || !nextSeat.playerId) {
      return [];
    }

    const events = [];
    if (previousSeat.cash !== nextSeat.cash) {
      events.push({ type: "resource", playerId: nextSeat.playerId, resource: "cash", positive: nextSeat.cash > previousSeat.cash });
    }

    if (previousSeat.reputation !== nextSeat.reputation) {
      events.push({ type: "resource", playerId: nextSeat.playerId, resource: "reputation", positive: nextSeat.reputation > previousSeat.reputation });
    }

    return events;
  });
};

const buildAnimationEvents = (previousState, nextState) => {
  if (!previousState || !nextState || nextState.status !== "active") {
    return [];
  }

  const logEvents = getNewLogEntries(previousState, nextState).map((logEntry) => {
    const actorSeat = findActorForLog(nextState, logEntry);
    const targetSeat = findSeatMentionedInLog(nextState, logEntry, actorSeat?.playerId);
    const card = findCardForLog(previousState, nextState, actorSeat, logEntry);
    const newTableCard = actorSeat ? findNewTableCard(previousState, nextState, actorSeat.playerId) : null;

    return {
      type: "play",
      message: logEntry,
      actorPlayerId: actorSeat?.playerId ?? null,
      targetPlayerId: targetSeat?.playerId ?? null,
      card,
      zone: newTableCard?.zone ?? null,
      tone: logEntry.toLowerCase().includes("lost") || logEntry.toLowerCase().includes("against") ? "danger" : "neutral"
    };
  });

  return [...logEvents, ...buildResourceEvents(previousState, nextState)];
};

const clearPulseClass = (selector, className) => {
  document.querySelectorAll(selector).forEach((node) => node.classList.remove(className));
};

const pulseDealer = (playerId, className) => {
  if (!playerId) {
    return;
  }

  const panel = document.querySelector(`[data-player-id="${playerId}"]`);
  if (!panel) {
    return;
  }

  panel.classList.remove(className);
  void panel.offsetWidth;
  panel.classList.add(className);
};

const pulseResource = (playerId, resource) => {
  if (!playerId || !resource) {
    return;
  }

  const chip = document.querySelector(`[data-player-id="${playerId}"] [data-resource="${resource}"]`);
  if (!chip) {
    return;
  }

  chip.classList.remove("is-popping");
  void chip.offsetWidth;
  chip.classList.add("is-popping");
};

const renderSpotlight = (event) => {
  animationLayer.innerHTML = "";
  const card = event.card;
  const node = document.createElement("div");
  node.className = "play-spotlight";

  const cardFrame = document.createElement("div");
  cardFrame.className = "spotlight-card-frame";
  if (card) {
    const image = document.createElement("img");
    image.src = getCardGraphicPath(card);
    image.alt = `${card.name} card graphic`;
    cardFrame.append(image);
  } else {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Table move";
    cardFrame.append(empty);
  }

  const copy = document.createElement("div");
  copy.className = "spotlight-copy";
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = event.zone ? `Into the ${event.zone}` : "Live play";
  const title = document.createElement("h3");
  title.textContent = card?.name ?? "Dealership move";
  const message = document.createElement("p");
  message.textContent = event.message;
  copy.append(eyebrow, title, message);
  node.append(cardFrame, copy);
  animationLayer.append(node);
};

const playAnimationEvent = async (event) => {
  if (event.type === "resource") {
    pulseDealer(event.playerId, event.positive ? "is-rewarded" : "is-targeted");
    pulseResource(event.playerId, event.resource);
    await wait(450);
    return;
  }

  if (event.type !== "play") {
    return;
  }

  clearPulseClass(".dealer-panel", "is-acting");
  clearPulseClass(".dealer-panel", "is-targeted");
  clearPulseClass(".dealer-panel", "is-rewarded");
  pulseDealer(event.actorPlayerId, "is-acting");
  pulseDealer(event.targetPlayerId, event.tone === "danger" ? "is-targeted" : "is-rewarded");
  renderSpotlight(event);
  await wait(1180);
  animationLayer.innerHTML = "";
};

const drainAnimationQueue = async () => {
  if (animationInProgress) {
    return;
  }

  animationInProgress = true;
  while (animationQueue.length) {
    const next = animationQueue.shift();
    await playAnimationEvent(next);
  }
  animationInProgress = false;
};

const enqueueAnimations = (events) => {
  if (!events.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  animationQueue.push(...events.slice(0, 6));
  drainAnimationQueue();
};

const render = () => {
  const inRoom = Boolean(session && view);
  landingScreen.hidden = inRoom;
  roomLabel.textContent = session?.roomCode ?? "None";

  if (!inRoom) {
    lobbyScreen.hidden = true;
    gameScreen.hidden = true;
    return;
  }

  const state = view.publicState;
  const isLobby = state.status === "lobby";
  const isGame = state.status === "active" || state.status === "finished";

  lobbyScreen.hidden = !isLobby;
  gameScreen.hidden = !isGame;

  if (isLobby) {
    renderLobby();
  }

  if (isGame) {
    renderGame();
  }
};

const renderLobby = () => {
  const state = view.publicState;
  const self = view.self;

  seatGrid.innerHTML = "";
  state.seats.forEach((seat) => {
    const seatCard = document.createElement("article");
    seatCard.className = `seat-card${seat.playerId === self?.playerId ? " is-self" : ""}`;
    seatCard.append(
      createTextNode("p", "eyebrow", seat.dealership),
      createTextNode("h3", "", seat.playerName ?? "Open Seat"),
      createTextNode("p", "seat-meta", seat.title)
    );

    const badges = document.createElement("div");
    badges.className = "seat-badges";
    badges.append(createTextNode("span", "badge", seat.occupied ? "Occupied" : "Open"));
    if (seat.isAi) {
      badges.append(createTextNode("span", "badge is-ai", "AI"));
    }
    if (seat.ready) {
      badges.append(createTextNode("span", "badge is-ready", "Ready"));
    }
    if (seat.occupied && !seat.connected && !seat.isAi) {
      badges.append(createTextNode("span", "badge is-offline", "Disconnected"));
    }
    if (seat.playerId === self?.playerId) {
      badges.append(createTextNode("span", "badge", "You"));
    }
    seatCard.append(badges);
    seatGrid.append(seatCard);
  });

  const selfSeat = state.seats.find((seat) => seat.playerId === self?.playerId);
  readyButton.textContent = selfSeat?.ready ? "Unready" : "Ready Up";
  startButton.disabled = !(self?.playerId === state.hostPlayerId && state.seats.every((seat) => seat.occupied && seat.ready));
};

const renderTableauCard = (card, kindLabel) => {
  const node = document.createElement("div");
  node.className = "mini-card";
  node.dataset.cardUid = card.uid;
  const detail =
    card.type === "Vehicle"
      ? `${card.profit} cash${card.tags?.length ? ` · ${card.tags.join(", ")}` : ""}`
      : card.type === "Customer"
        ? `+${card.bonus} on sale${card.wants?.length ? ` · wants ${card.wants.join(", ")}` : ""}`
        : card.effect;
  node.innerHTML = `<small>${kindLabel}</small><strong>${card.name}</strong><span class="mini-detail">${detail}</span>`;
  return node;
};

const renderTableauRow = (label, cards, capText, kindLabel) => {
  const row = document.createElement("div");
  row.className = "tableau-row";
  const heading = document.createElement("div");
  heading.className = "row-label";
  heading.innerHTML = `<span>${label}</span><small>${capText}</small>`;
  row.append(heading);

  const cardsWrap = document.createElement("div");
  cardsWrap.className = "row-cards";
  if (!cards.length) {
    const empty = document.createElement("div");
    empty.className = "row-empty";
    empty.textContent = "Empty";
    cardsWrap.append(empty);
  } else {
    cards.forEach((card) => cardsWrap.append(renderTableauCard(card, kindLabel)));
  }
  row.append(cardsWrap);
  return row;
};

const renderDealerPanel = (seat) => {
  const state = view.publicState;
  const self = view.self;
  const isActive = seat.playerId === state.currentPlayerId;
  const isSelf = seat.playerId === self?.playerId;

  const panel = document.createElement("article");
  panel.className = `panel dealer-panel${isActive ? " is-active" : ""}${isSelf ? " is-self" : ""}`;
  panel.dataset.seatIndex = String(seat.seatIndex);
  if (seat.playerId) {
    panel.dataset.playerId = seat.playerId;
  }

  const meta = seat.isAi
    ? `AI: ${seat.personalityName}`
    : seat.occupied
      ? seat.connected
        ? "Connected"
        : "Disconnected"
      : "Open seat";
  const safePlayerName = escapeHtml(seat.playerName ?? "Open Seat");

  panel.innerHTML = `
    <div class="dealer-head">
      <div>
        <p class="eyebrow">${seat.dealership}</p>
        <h3>${safePlayerName}${isSelf ? " (You)" : ""}</h3>
        <p class="seat-meta">${meta} · ${seat.handCount} card${seat.handCount === 1 ? "" : "s"} in hand</p>
      </div>
      <div class="resource-chips">
        <span class="chip chip-cash" title="Cash">$ ${seat.cash}</span>
        <span class="chip chip-rep" title="Reputation">★ ${seat.reputation}</span>
        ${seat.carBonus ? `<span class="chip chip-bonus" title="Every car sells for this much more">🚗 +${seat.carBonus}</span>` : ""}
      </div>
    </div>
  `;

  panel.querySelector(".chip-cash")?.setAttribute("data-resource", "cash");
  panel.querySelector(".chip-rep")?.setAttribute("data-resource", "reputation");

  panel.append(renderTableauRow("Showroom", seat.customers, `${seat.customers.length}/${seat.customerCap} customers`, "Customer"));
  panel.append(renderTableauRow("Sales Team", seat.salespeople, `${seat.salespeople.length}/2 hired`, "Salesperson"));
  panel.append(renderTableauRow("Lot", seat.vehicles, `${seat.vehicles.length} in stock`, "Vehicle"));
  return panel;
};

const renderSaleBar = () => {
  const state = view.publicState;
  const self = view.self;
  const currentIsSelf = state.currentPlayerId === self?.playerId;
  const sales = (view.legalActions ?? []).filter((entry) => entry.action.kind === "close-sale");

  if (!currentIsSelf || state.winner || !sales.length) {
    saleBar.hidden = true;
    saleActions.innerHTML = "";
    return;
  }

  saleBar.hidden = false;
  saleActions.innerHTML = "";
  sales.forEach((entry) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "action-button";
    button.textContent = entry.action.label;
    button.addEventListener("click", () => {
      send("play_card", { cardUid: null, action: entry.action });
    });
    saleActions.append(button);
  });
};

const renderGame = () => {
  const state = view.publicState;
  const self = view.self;
  const currentSeat = state.seats.find((seat) => seat.playerId === state.currentPlayerId);
  const currentIsSelf = state.currentPlayerId === self?.playerId;

  turnTitle.textContent = currentSeat ? `${currentSeat.dealership}: ${currentSeat.playerName}` : "Waiting for turn owner";
  turnMeta.textContent = state.winner
    ? state.winner.reason
    : `${currentIsSelf ? "Your turn." : "Waiting on another dealer."} ${state.actionsRemaining} play${state.actionsRemaining === 1 ? "" : "s"} remaining. First to ${CASH_TARGET} cash wins.`;

  deckCount.textContent = String(state.deckCount);
  discardCount.textContent = String(state.discardCount);
  actionsCount.textContent = String(state.actionsRemaining);
  winnerTitle.textContent = state.winner ? state.winner.name : "No winner yet";
  winnerCopy.textContent = state.winner
    ? state.winner.reason
    : `Recruit customers, stock cars, close sales, and race to ${CASH_TARGET} cash.`;

  dealerGrid.innerHTML = "";
  state.seats.forEach((seat) => {
    dealerGrid.append(renderDealerPanel(seat));
  });

  logList.innerHTML = "";
  state.log.forEach((entry) => {
    const item = document.createElement("li");
    item.textContent = entry;
    logList.append(item);
  });

  handTitle.textContent = self ? `${self.name} hand` : "Your cards";
  renderSaleBar();
  renderHand();
  renderLibrary();

  endTurnButton.disabled = !currentIsSelf || Boolean(state.winner);
};

const renderCardGraphic = (card, className = "card-graphic") => {
  const image = document.createElement("img");
  image.className = className;
  image.src = getCardGraphicPath(card);
  image.alt = `${card.name} card graphic`;
  image.loading = "lazy";
  image.decoding = "async";
  return image;
};

const renderHand = () => {
  handGrid.innerHTML = "";
  const self = view.self;
  const legalActions = view.legalActions ?? [];

  if (!self?.hand?.length) {
    handGrid.innerHTML = '<div class="empty-state">Your hand is empty right now.</div>';
    return;
  }

  self.hand.forEach((card) => {
    const cardNode = document.createElement("article");
    cardNode.className = "hand-card";
    const actions = legalActions.filter((entry) => entry.cardUid === card.uid);
    cardNode.append(renderCardGraphic(card, "card-graphic hand-card-graphic"));

    cardNode.insertAdjacentHTML("beforeend", `
      <div class="card-topline">
        <span class="card-type" style="background:${typeColors[card.type] ?? "#555"}">${card.type}</span>
        <strong>${card.value}</strong>
      </div>
      <h3>${card.name}</h3>
      <p class="card-copy">${card.effect}</p>
      <p class="card-copy">${card.notes}</p>
    `);

    const actionsWrap = document.createElement("div");
    actionsWrap.className = "card-actions";

    if (!actions.length) {
      const disabled = document.createElement("button");
      disabled.type = "button";
      disabled.className = "secondary-button";
      disabled.disabled = true;
      disabled.textContent = "No legal play";
      actionsWrap.append(disabled);
    } else {
      actions.forEach((entry) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "action-button";
        button.textContent = entry.action.label;
        button.addEventListener("click", () => {
          send("play_card", {
            cardUid: entry.cardUid,
            action: entry.action
          });
        });
        actionsWrap.append(button);
      });
    }

    cardNode.append(actionsWrap);
    handGrid.append(cardNode);
  });
};

const renderLibrary = () => {
  libraryGrid.innerHTML = "";
  const query = searchInput.value.trim().toLowerCase();
  const cards = libraryCards.filter((card) => {
    if (!query) {
      return true;
    }

    const haystack = [card.name, card.type, card.effect, card.notes, card.artwork, card.value].join(" ").toLowerCase();
    return haystack.includes(query);
  });

  cards.forEach((card) => {
    const node = document.createElement("article");
    node.className = "library-card";
    node.append(renderCardGraphic(card));
    node.insertAdjacentHTML("beforeend", `
      <div class="card-topline">
        <span class="card-type" style="background:${typeColors[card.type] ?? "#555"}">${card.type}</span>
        <strong>${card.value}</strong>
      </div>
      <h3>${card.name}</h3>
      <p class="card-copy">${card.effect}</p>
      <p class="card-copy">${card.notes}</p>
    `);
    libraryGrid.append(node);
  });

  if (!cards.length) {
    libraryGrid.innerHTML = '<div class="empty-state">No cards matched that search.</div>';
  }
};

createForm.addEventListener("submit", (event) => {
  event.preventDefault();
  syncCreateSeatSetup();
  const hostSeatIndex = Number(createSeatSelect.value);
  connectSocket();
  send("create_room", {
    playerName: document.querySelector("#create-name").value.trim(),
    seatIndex: hostSeatIndex,
    aiSeats: createSeatSetupState
      .filter((seat) => seat.seatIndex !== hostSeatIndex && seat.control === "ai")
      .map((seat) => ({
        seatIndex: seat.seatIndex,
        personalityId: seat.personalityId,
        name: getAiPersonality(seat.personalityId).name
      }))
  });
});

joinForm.addEventListener("submit", (event) => {
  event.preventDefault();
  connectSocket();
  const seatValue = document.querySelector("#join-seat").value;
  send("join_room", {
    roomCode: document.querySelector("#join-room-code").value.trim().toUpperCase(),
    playerName: document.querySelector("#join-name").value.trim(),
    seatIndex: seatValue === "" ? null : Number(seatValue)
  });
});

reconnectButton.addEventListener("click", () => {
  if (!session?.roomCode || !session?.reconnectToken) {
    showMessage("No saved session is available on this browser.", "error");
    return;
  }

  pendingReconnectAttempt = true;
  connectSocket();
});

readyButton.addEventListener("click", () => {
  const selfSeat = view?.publicState?.seats?.find((seat) => seat.playerId === view?.self?.playerId);
  send("set_ready", { ready: !selfSeat?.ready });
});

startButton.addEventListener("click", () => send("start_game"));
endTurnButton.addEventListener("click", () => send("end_turn"));
createSeatSelect.addEventListener("change", renderCreateSeatSetup);
searchInput.addEventListener("input", renderLibrary);

if (session?.roomCode && session?.reconnectToken) {
  pendingReconnectAttempt = true;
}

connectSocket();
fetchLibrary();
renderCreateSeatSetup();
