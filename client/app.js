import { AI_PERSONALITIES, getAiPersonality, SEAT_CONFIG } from "/shared/constants.js";

const connectionLabel = document.querySelector("#connection-label");
const roomLabel = document.querySelector("#room-label");
const messageBanner = document.querySelector("#message-banner");

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
const teamAProfit = document.querySelector("#team-a-profit");
const teamBProfit = document.querySelector("#team-b-profit");
const teamAPlayers = document.querySelector("#team-a-players");
const teamBPlayers = document.querySelector("#team-b-players");
const teamASlots = document.querySelector("#team-a-slots");
const teamBSlots = document.querySelector("#team-b-slots");
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
const typeColors = {
  Client: "#d66a3d",
  Vehicle: "#456e9f",
  Employee: "#2b8c67",
  Event: "#8d4aa8",
  Legendary: "#bc8a1f"
};

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
        <strong>${seatConfig.name}</strong>
        <span>${seatConfig.teamIndex === 0 ? "Team A" : "Team B"}</span>
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
      pendingReconnectAttempt = false;
      persistSession();
      roomLabel.textContent = session.roomCode;
      showMessage(`Connected to room ${session.roomCode}.`, "info");
      render();
      return;
    }

    if (message.type === "state_sync") {
      view = message.payload;
      render();
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
  const self = view.self;
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
    seatCard.innerHTML = `
      <p class="eyebrow">${seat.seatName}</p>
      <h3>${seat.playerName ?? "Open Seat"}</h3>
      <p class="seat-meta">${seat.title} · ${seat.teamIndex === 0 ? "Team A" : "Team B"}</p>
      <div class="seat-badges">
        <span class="badge">${seat.occupied ? "Occupied" : "Open"}</span>
        ${seat.isAi ? '<span class="badge is-ai">AI</span>' : ""}
        ${seat.ready ? '<span class="badge is-ready">Ready</span>' : ""}
        ${seat.occupied && !seat.connected && !seat.isAi ? '<span class="badge is-offline">Disconnected</span>' : ""}
        ${seat.playerId === self?.playerId ? '<span class="badge">You</span>' : ""}
      </div>
    `;
    seatGrid.append(seatCard);
  });

  const selfSeat = state.seats.find((seat) => seat.playerId === self?.playerId);
  readyButton.textContent = selfSeat?.ready ? "Unready" : "Ready Up";
  startButton.disabled = !(self?.playerId === state.hostPlayerId && state.seats.every((seat) => seat.occupied && seat.ready));
};

const renderPlayerChip = (seat) => {
  const chip = document.createElement("article");
  const isActive = seat.playerId === view.publicState.currentPlayerId;
  chip.className = `player-chip${isActive ? " is-active" : ""}`;
  chip.innerHTML = `
    <div class="player-row">
      <h3>${seat.playerName ?? seat.seatName}</h3>
      <span>${seat.handCount} cards</span>
    </div>
    <p class="seat-meta">${seat.seatName} - ${seat.isAi ? `AI: ${seat.personalityName}` : seat.connected ? "Connected" : "Disconnected"}</p>
  `;
  return chip;
};

const renderDealSlot = (deal, slotLabel) => {
  const slot = document.createElement("article");
  slot.className = `deal-card${deal?.pendingSinceTeamTurn !== null ? " is-pending" : ""}`;

  if (!deal) {
    slot.innerHTML = `
      <p class="eyebrow">${slotLabel}</p>
      <h3>Empty deal slot</h3>
      <p class="slot-copy">Start a client, vehicle, or employee stack here during your turn.</p>
    `;
    return slot;
  }

  const cards = [];
  if (deal.client) {
    cards.push(renderMiniCard("Client", deal.client.name));
  }
  [deal.vehicle, ...deal.extraVehicles].filter(Boolean).forEach((vehicle) => {
    cards.push(renderMiniCard("Vehicle", vehicle.name));
  });
  if (deal.employee) {
    cards.push(renderMiniCard("Employee", deal.employee.name));
  }
  deal.attachments.forEach((attachment) => {
    cards.push(renderMiniCard("Event", attachment.name));
  });

  slot.innerHTML = `
    <p class="eyebrow">${slotLabel}</p>
    <h3>${deal.client?.name ?? "Open deal"}</h3>
    <p class="deal-meta">${deal.pendingSinceTeamTurn !== null ? "Pending delivery on the next allied turn." : "Still building."}</p>
  `;
  const stack = document.createElement("div");
  stack.className = "deal-stack";
  cards.forEach((card) => stack.append(card));
  slot.append(stack);
  return slot;
};

const renderMiniCard = (label, name) => {
  const node = document.createElement("div");
  node.className = "mini-card";
  node.innerHTML = `<small>${label}</small><strong>${name}</strong>`;
  return node;
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

const renderGame = () => {
  const state = view.publicState;
  const self = view.self;
  const currentSeat = state.seats.find((seat) => seat.playerId === state.currentPlayerId);
  const currentIsSelf = state.currentPlayerId === self?.playerId;

  turnTitle.textContent = currentSeat ? `${currentSeat.seatName}: ${currentSeat.playerName}` : "Waiting for turn owner";
  turnMeta.textContent = state.winner
    ? state.winner.reason
    : `${currentIsSelf ? "Your turn." : "Waiting on another player."} ${state.actionsRemaining} action${state.actionsRemaining === 1 ? "" : "s"} remaining.`;

  teamAProfit.textContent = `${state.teams[0].profit} profit`;
  teamBProfit.textContent = `${state.teams[1].profit} profit`;
  deckCount.textContent = String(state.deckCount);
  discardCount.textContent = String(state.discardCount);
  actionsCount.textContent = String(state.actionsRemaining);
  winnerTitle.textContent = state.winner ? state.winner.name : "No winner yet";
  winnerCopy.textContent = state.winner ? state.winner.reason : "Completed deals deliver on the next allied turn if they survive.";

  teamAPlayers.innerHTML = "";
  teamBPlayers.innerHTML = "";
  state.seats.forEach((seat) => {
    if (seat.teamIndex === 0) {
      teamAPlayers.append(renderPlayerChip(seat));
    } else {
      teamBPlayers.append(renderPlayerChip(seat));
    }
  });

  teamASlots.innerHTML = "";
  teamBSlots.innerHTML = "";
  state.teams[0].slots.forEach((deal, index) => teamASlots.append(renderDealSlot(deal, state.teams[0].slotLabels[index])));
  state.teams[1].slots.forEach((deal, index) => teamBSlots.append(renderDealSlot(deal, state.teams[1].slotLabels[index])));

  logList.innerHTML = "";
  state.log.forEach((entry) => {
    const item = document.createElement("li");
    item.textContent = entry;
    logList.append(item);
  });

  handTitle.textContent = self ? `${self.name} hand` : "Your cards";
  renderHand();
  renderLibrary();

  endTurnButton.disabled = !currentIsSelf || Boolean(state.winner);
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
