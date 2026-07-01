import test from "node:test";
import assert from "node:assert/strict";
import { baseCards } from "../shared/cards.js";
import {
  addPlayerToGame,
  applyAction,
  buildLegalActions,
  createGameState,
  endTurn,
  getPlayerView,
  startGame
} from "../shared/game-engine.js";
import { GameStore } from "../server/game-store.js";
import { RoomManager } from "../server/room-manager.js";

const pickCard = (name, uid) => {
  const card = baseCards.find((entry) => entry.name === name);
  return { ...card, uid };
};

const buildFixtureState = () => {
  let state = createGameState({ roomCode: "TEST" });

  [
    { id: "p1", name: "Alice", seatIndex: 0, reconnectToken: "r1" },
    { id: "p2", name: "Bob", seatIndex: 1, reconnectToken: "r2" },
    { id: "p3", name: "Casey", seatIndex: 2, reconnectToken: "r3" },
    { id: "p4", name: "Drew", seatIndex: 3, reconnectToken: "r4" }
  ].forEach((player) => {
    state = addPlayerToGame(state, player);
  });

  state.status = "active";
  state.currentSeatIndex = 0;
  state.currentPlayerId = "p1";
  state.turnNumber = 1;
  state.actionsRemaining = 2;
  state.players.find((player) => player.id === "p1").hand = [
    pickCard("First-Time Buyer", "c1"),
    pickCard("Base Model Sedan", "c2")
  ];
  state.players.find((player) => player.id === "p2").hand = [
    pickCard("Bad Survey", "c3")
  ];
  return state;
};

test("room creation, join flow, ready flow, and auto start produce a four-player active game", () => {
  const manager = new RoomManager(new GameStore());
  const host = manager.createRoom({ playerName: "Alice", seatIndex: 0 });
  const p2 = manager.joinRoom({ roomCode: host.roomCode, playerName: "Bob", seatIndex: 1 });
  const p3 = manager.joinRoom({ roomCode: host.roomCode, playerName: "Casey", seatIndex: 2 });
  const p4 = manager.joinRoom({ roomCode: host.roomCode, playerName: "Drew", seatIndex: 3 });

  manager.setReady(host.roomCode, host.playerId, true);
  manager.setReady(host.roomCode, p2.playerId, true);
  manager.setReady(host.roomCode, p3.playerId, true);
  const room = manager.setReady(host.roomCode, p4.playerId, true);

  assert.equal(room.state.status, "active");
  assert.equal(room.state.turnNumber, 1);
  assert.equal(room.state.actionsRemaining, 2);
  assert.equal(room.state.currentPlayerId, host.playerId);
  assert.equal(room.state.players.find((player) => player.id === host.playerId).hand.length, 6);
  assert.equal(room.state.players.find((player) => player.id === p2.playerId).hand.length, 5);
});

test("legal card play updates the board and out-of-turn play is rejected", () => {
  const state = buildFixtureState();
  const action = buildLegalActions(state, "p1").find((entry) => entry.cardName === "First-Time Buyer");

  assert.ok(action, "expected a playable client action");

  const next = applyAction(state, "p1", {
    cardUid: action.cardUid,
    action: action.action
  });

  assert.equal(next.teams[0].slots[action.action.slotIndex].client.name, "First-Time Buyer");
  assert.equal(next.players.find((player) => player.id === "p1").hand.length, 1);
  assert.equal(next.actionsRemaining, 1);

  assert.throws(() => {
    applyAction(state, "p2", {
      cardUid: "c3",
      action: buildLegalActions(state, "p2")[0]?.action ?? { kind: "team-profit" }
    });
  }, /not your turn/i);
});

test("private serialization hides opponents' hand contents while keeping hand counts public", () => {
  const state = buildFixtureState();
  const bobView = getPlayerView(state, "p2");
  const publicJson = JSON.stringify(bobView.publicState);

  assert.equal(bobView.self.hand.length, 1);
  assert.equal(bobView.publicState.seats.find((seat) => seat.playerId === "p1").handCount, 2);
  assert.equal(publicJson.includes("First-Time Buyer"), false);
  assert.equal(publicJson.includes("Base Model Sedan"), false);
});

test("ending a turn advances clockwise and draws for the next seat", () => {
  let state = createGameState({ roomCode: "TURN" });

  [
    { id: "p1", name: "Alice", seatIndex: 0, reconnectToken: "r1", ready: true },
    { id: "p2", name: "Bob", seatIndex: 1, reconnectToken: "r2", ready: true },
    { id: "p3", name: "Casey", seatIndex: 2, reconnectToken: "r3", ready: true },
    { id: "p4", name: "Drew", seatIndex: 3, reconnectToken: "r4", ready: true }
  ].forEach((player) => {
    state = addPlayerToGame(state, player);
  });

  state.players.forEach((player) => {
    player.ready = true;
  });

  state = startGame(state);
  const bobBefore = state.players.find((player) => player.id === "p2").hand.length;
  const next = endTurn(state, "p1");

  assert.equal(next.currentPlayerId, "p2");
  assert.equal(next.turnNumber, 2);
  assert.equal(next.players.find((player) => player.id === "p2").hand.length, bobBefore + 1);
});

test("reconnect token reattaches the same player identity and seat", () => {
  const manager = new RoomManager(new GameStore());
  const host = manager.createRoom({ playerName: "Alice", seatIndex: 0 });
  const rejoined = manager.joinRoom({
    roomCode: host.roomCode,
    reconnectToken: host.reconnectToken
  });

  assert.equal(rejoined.playerId, host.playerId);
  assert.equal(rejoined.seatIndex, host.seatIndex);
  assert.equal(rejoined.reconnectToken, host.reconnectToken);
});

test("AI seats can fill a room and advance after the human turn", () => {
  const manager = new RoomManager(new GameStore());
  const host = manager.createRoom({
    playerName: "Alice",
    seatIndex: 0,
    aiSeats: [
      { seatIndex: 1, personalityId: "desk-shark" },
      { seatIndex: 2, personalityId: "lot-hawk" },
      { seatIndex: 3, personalityId: "csi-saint" }
    ]
  });

  let room = manager.setReady(host.roomCode, host.playerId, true);
  const aiPlayers = room.state.players.filter((player) => player.isAi);

  assert.equal(room.state.status, "active");
  assert.equal(aiPlayers.length, 3);
  assert.equal(aiPlayers.every((player) => player.ready), true);
  assert.equal(room.state.currentPlayerId, host.playerId);

  room = manager.endTurn(host.roomCode, host.playerId);

  assert.equal(room.state.status, "active");
  assert.ok(room.state.currentPlayerId === host.playerId || room.state.winner);
  assert.ok(room.state.turnNumber > 1);
});
