import crypto from "node:crypto";
import { getAiPersonality, SEAT_CONFIG } from "../shared/constants.js";
import {
  addPlayerToGame,
  buildLegalActions,
  canAutoStart,
  createGameState,
  endTurn,
  getPlayerView,
  getPublicState,
  startGame,
  updatePlayerPresence,
  updatePlayerReady,
  applyAction
} from "../shared/game-engine.js";

const randomId = (prefix) => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
const randomRoomCode = () => crypto.randomBytes(3).toString("hex").toUpperCase();

export class RoomManager {
  constructor(store) {
    this.store = store;
  }

  createRoom({ playerName, seatIndex = 0, aiSeats = [] }) {
    const code = this.#createUniqueRoomCode();
    const player = this.#createPlayer(playerName, seatIndex);
    let state = createGameState({ roomCode: code, hostPlayerId: player.id });
    state = addPlayerToGame(state, player);

    aiSeats
      .filter((seat) => Number(seat.seatIndex) !== player.seatIndex)
      .forEach((seat) => {
        const aiPlayer = this.#createAiPlayer(Number(seat.seatIndex), seat.personalityId, seat.name);
        if (!state.players.some((entry) => entry.seatIndex === aiPlayer.seatIndex)) {
          state = addPlayerToGame(state, aiPlayer);
        }
      });

    const room = {
      code,
      sockets: new Map(),
      state
    };

    this.store.saveRoom(room);
    return this.#buildJoinResult(room, player);
  }

  joinRoom({ roomCode, playerName, seatIndex, reconnectToken }) {
    const room = this.store.getRoom(roomCode);
    if (!room) {
      throw new Error("Room not found.");
    }

    if (reconnectToken) {
      const existing = room.state.players.find((player) => player.reconnectToken === reconnectToken);
      if (!existing) {
        throw new Error("Reconnect token was not recognized for this room.");
      }

      room.state = updatePlayerPresence(room.state, existing.id, true);
      this.store.saveRoom(room);
      return this.#buildJoinResult(room, existing);
    }

    if (room.state.status !== "lobby") {
      throw new Error("This room is already in progress.");
    }

    const desiredSeat = seatIndex ?? this.#findOpenSeat(room);
    if (desiredSeat === null || desiredSeat === undefined) {
      throw new Error("No seat is available.");
    }
    if (room.state.players.some((player) => player.seatIndex === desiredSeat)) {
      throw new Error("That seat is already occupied.");
    }

    const player = this.#createPlayer(playerName, desiredSeat);
    room.state = addPlayerToGame(room.state, player);
    this.store.saveRoom(room);
    return this.#buildJoinResult(room, player);
  }

  attachSocket(roomCode, playerId, socket) {
    const room = this.store.getRoom(roomCode);
    if (!room) {
      throw new Error("Room not found.");
    }

    room.sockets.set(playerId, socket);
    room.state = updatePlayerPresence(room.state, playerId, true);
    this.store.saveRoom(room);
    return room;
  }

  detachSocket(playerId) {
    const room = this.store.getRoomByPlayerId(playerId);
    if (!room) {
      return null;
    }

    room.sockets.delete(playerId);
    room.state = updatePlayerPresence(room.state, playerId, false);
    this.store.saveRoom(room);
    return room;
  }

  setReady(roomCode, playerId, ready) {
    const room = this.#requireRoom(roomCode);
    room.state = updatePlayerReady(room.state, playerId, ready);
    if (canAutoStart(room.state)) {
      room.state = startGame(room.state);
      this.#advanceAiTurns(room);
    }
    this.store.saveRoom(room);
    return room;
  }

  startGame(roomCode, playerId) {
    const room = this.#requireRoom(roomCode);
    if (room.state.hostPlayerId !== playerId) {
      throw new Error("Only the host can start the game early.");
    }
    room.state = startGame(room.state);
    this.#advanceAiTurns(room);
    this.store.saveRoom(room);
    return room;
  }

  playCard(roomCode, playerId, payload) {
    const room = this.#requireRoom(roomCode);
    room.state = applyAction(room.state, playerId, payload);
    this.#advanceAiTurns(room);
    this.store.saveRoom(room);
    return room;
  }

  endTurn(roomCode, playerId) {
    const room = this.#requireRoom(roomCode);
    room.state = endTurn(room.state, playerId);
    this.#advanceAiTurns(room);
    this.store.saveRoom(room);
    return room;
  }

  getPlayerView(roomCode, playerId) {
    const room = this.#requireRoom(roomCode);
    return getPlayerView(room.state, playerId);
  }

  getPublicState(roomCode) {
    return getPublicState(this.#requireRoom(roomCode).state);
  }

  #createUniqueRoomCode() {
    let code = randomRoomCode();
    while (this.store.getRoom(code)) {
      code = randomRoomCode();
    }
    return code;
  }

  #findOpenSeat(room) {
    const occupied = new Set(room.state.players.map((player) => player.seatIndex));
    const seat = SEAT_CONFIG.find((entry) => !occupied.has(entry.seatIndex));
    return seat?.seatIndex ?? null;
  }

  #createPlayer(name, seatIndex) {
    if (!SEAT_CONFIG[seatIndex]) {
      throw new Error("Seat does not exist.");
    }
    return {
      id: randomId("player"),
      reconnectToken: randomId("reconnect"),
      name: name?.trim() || SEAT_CONFIG[seatIndex].name,
      seatIndex
    };
  }

  #createAiPlayer(seatIndex, personalityId, name) {
    if (!SEAT_CONFIG[seatIndex]) {
      throw new Error("Seat does not exist.");
    }
    const personality = getAiPersonality(personalityId);
    return {
      id: randomId("ai"),
      reconnectToken: randomId("reconnect"),
      name: name?.trim() || personality.name,
      seatIndex,
      isAi: true,
      personalityId: personality.id
    };
  }

  #advanceAiTurns(room) {
    let guard = 0;
    while (room.state.status === "active" && !room.state.winner && guard < 200) {
      guard += 1;
      const player = room.state.players.find((entry) => entry.id === room.state.currentPlayerId);
      if (!player?.isAi) {
        return;
      }

      if (room.state.actionsRemaining <= 0) {
        room.state = endTurn(room.state, player.id);
        continue;
      }

      const move = this.#pickAiMove(room.state, player);
      if (!move) {
        room.state = endTurn(room.state, player.id);
        continue;
      }

      room.state = applyAction(room.state, player.id, move);
    }
  }

  #pickAiMove(state, player) {
    const legalActions = buildLegalActions(state, player.id);
    let bestMove = null;
    legalActions.forEach((entry) => {
      const score = this.#scoreAiAction(state, player, entry);
      if (!bestMove || score > bestMove.score) {
        bestMove = { cardUid: entry.cardUid, action: entry.action, score };
      }
    });
    return bestMove ? { cardUid: bestMove.cardUid, action: bestMove.action } : null;
  }

  #scoreAiAction(state, player, entry) {
    const personality = getAiPersonality(player.personalityId);
    const weights = personality.weights;
    const action = entry.action;
    let score = 50 + (Number(entry.cardValue) || 0);

    if (action.kind === "dealer-principal" || action.kind === "rush-delivery") {
      score += 180 + (weights.delivery ?? 0);
    }
    if (action.kind === "team-profit") {
      score += Math.abs(action.amount ?? 0) * 12;
      score += action.teamIndex === player.teamIndex ? (weights.ownProfit ?? 0) : (weights.enemyProfit ?? 0);
    }
    if (action.kind === "remove-client" || action.kind === "remove-employee" || action.kind === "recall" || action.kind === "chargeback") {
      score += 95 + (weights.sabotage ?? 0);
      const targetDeal = state.teams[action.teamIndex]?.slots[action.slotIndex];
      if (targetDeal?.pendingSinceTeamTurn !== null) {
        score += weights.denyDelivery ?? 0;
      }
    }
    if (action.kind === "attach") {
      score += weights.attachment ?? 0;
      score += entry.cardType === "Client" ? (weights.client ?? 0) : 0;
      score += entry.cardType === "Vehicle" ? (weights.vehicle ?? 0) : 0;
      score += entry.cardType === "Employee" ? (weights.employee ?? 0) : 0;
      if (["Receptionist", "GSM", "Superstar Employee"].includes(entry.cardName)) {
        score += weights.protection ?? 0;
      }
      const deal = state.teams[player.teamIndex]?.slots[action.slotIndex];
      if (deal?.client && (deal.vehicle || deal.extraVehicles.length) && deal.employee) {
        score += 120 + (weights.completion ?? 0);
      }
    }
    if (action.kind === "massive-trade") {
      score += 60 + (weights.massiveTrade ?? 0);
    }
    if (action.kind === "search-client") {
      score += 60 + (weights.searchClient ?? 0);
    }
    if (action.kind === "draw-one") {
      score += 30;
    }
    if (action.kind === "extra-action") {
      score += 70;
    }

    return score;
  }

  #buildJoinResult(room, player) {
    return {
      roomCode: room.code,
      playerId: player.id,
      reconnectToken: player.reconnectToken,
      seatIndex: player.seatIndex,
      state: getPlayerView(room.state, player.id)
    };
  }

  #requireRoom(roomCode) {
    const room = this.store.getRoom(roomCode);
    if (!room) {
      throw new Error("Room not found.");
    }
    return room;
  }
}
