import crypto from "node:crypto";
import { getAiPersonality, SEAT_CONFIG } from "../shared/constants.js";
import { baseCards } from "../shared/cards.js";
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
    const cardValue = Number(entry.cardValue) || 0;
    let score = 50;

    if (action.kind === "close-sale") {
      score += 150 + cardValue * 8 + (weights.closeSale ?? 0);
    }

    if (action.kind === "recruit") {
      score += 60 + cardValue * 6 + (weights.customer ?? 0);
    }

    if (action.kind === "stock") {
      score += 45 + cardValue * 4 + (weights.vehicle ?? 0);
      if (player.customers.length > 0) {
        score += (weights.closeSale ?? 0) / 2;
      }
    }

    if (action.kind === "hire") {
      score += 55 + cardValue * 4 + (weights.salesperson ?? 0);
    }

    if (action.kind === "action") {
      const card = baseCards.find((base) => base.name === entry.cardName);
      (card?.effects ?? []).forEach((effect) => {
        if (effect.kind === "gain-cash") {
          score += effect.amount * 10 + (weights.cash ?? 0);
        }
        if (effect.kind === "gain-rep" || effect.kind === "underdog-rep") {
          score += effect.amount * 5 + (weights.rep ?? 0) / 2;
        }
        if (effect.kind === "draw" || effect.kind === "scry") {
          score += effect.amount * 6 + (weights.draw ?? 0) / 2;
        }
        if (effect.kind === "raise-hand-limit" || effect.kind === "raise-customer-cap") {
          score += 25 + (weights.engine ?? 0);
        }
        if (effect.kind === "car-value-bonus") {
          score += 20 + effect.amount * 8 + (weights.carBonus ?? 0);
        }
        if (effect.kind === "extra-plays") {
          score += 20;
        }
        if (effect.kind === "cash-per-rival-ahead") {
          const rivalsAhead = state.players.filter(
            (rival) => rival.id !== player.id && rival.customers.length > player.customers.length
          ).length;
          score += rivalsAhead * effect.amount * 10;
        }
        if (effect.kind === "self-discard") {
          score -= effect.amount * 5;
        }
      });
    }

    if (action.kind === "sabotage") {
      score += 70 + cardValue * 5 + (weights.sabotage ?? 0);
      const target = state.players.find((rival) => rival.id === action.targetPlayerId);
      if (target) {
        score += Math.min(30, target.cash);
      }
    }

    if (action.kind === "sabotage-all") {
      score += 80 + (weights.sabotage ?? 0) + (weights.steal ?? 0);
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
