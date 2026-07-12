import test from "node:test";
import assert from "node:assert/strict";
import { baseCards } from "../shared/cards.js";
import { CASH_TARGET } from "../shared/constants.js";
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
  assert.ok(card, `expected ${name} to exist in the deck`);
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
  assert.equal(room.state.players.find((player) => player.id === host.playerId).hand.length, 7);
  assert.equal(room.state.players.find((player) => player.id === p2.playerId).hand.length, 5);
});

test("recruiting a customer and stocking a vehicle fills the dealership tableau", () => {
  const state = buildFixtureState();
  const recruit = buildLegalActions(state, "p1").find((entry) => entry.cardName === "First-Time Buyer");
  assert.ok(recruit, "expected a recruit action");

  let next = applyAction(state, "p1", { cardUid: recruit.cardUid, action: recruit.action });
  const alice = next.players.find((player) => player.id === "p1");

  assert.equal(alice.customers.length, 1);
  assert.equal(alice.customers[0].name, "First-Time Buyer");
  assert.equal(alice.reputation, 1);
  assert.equal(next.actionsRemaining, 1);

  const stock = buildLegalActions(next, "p1").find((entry) => entry.cardName === "Base Model Sedan");
  assert.ok(stock, "expected a stock action");
  next = applyAction(next, "p1", { cardUid: stock.cardUid, action: stock.action });

  assert.equal(next.players.find((player) => player.id === "p1").vehicles.length, 1);
  assert.equal(next.actionsRemaining, 0);

  assert.throws(() => {
    applyAction(state, "p2", {
      cardUid: "c3",
      action: { label: "Target Alice", kind: "sabotage", targetPlayerId: "p1" }
    });
  }, /not your turn/i);
});

test("closing a sale pays vehicle profit plus customer bonus plus combo", () => {
  const state = buildFixtureState();
  const player = state.players.find((entry) => entry.id === "p1");
  player.customers = [pickCard("First-Time Buyer", "cust1")];
  player.vehicles = [pickCard("Base Model Sedan", "veh1")];
  player.hand = [];

  const sale = buildLegalActions(state, "p1").find((entry) => entry.action.kind === "close-sale");
  assert.ok(sale, "expected a close-sale action");

  const next = applyAction(state, "p1", { cardUid: null, action: sale.action });
  const alice = next.players.find((entry) => entry.id === "p1");

  // 3 profit + 1 bonus + 2 combo (First-Time Buyer wants economy)
  assert.equal(alice.cash, 6);
  assert.equal(alice.reputation, 1);
  assert.equal(alice.vehicles.length, 0);
  assert.equal(alice.customers.length, 0);
});

test("sabotage targets a rival and reputation cannot go below zero", () => {
  const state = buildFixtureState();
  state.currentSeatIndex = 1;
  state.currentPlayerId = "p2";
  const alice = state.players.find((entry) => entry.id === "p1");
  alice.reputation = 2;

  const sabotage = buildLegalActions(state, "p2").find(
    (entry) => entry.cardName === "Bad Survey" && entry.action.targetPlayerId === "p1"
  );
  assert.ok(sabotage, "expected a sabotage action targeting Alice");

  const next = applyAction(state, "p2", { cardUid: sabotage.cardUid, action: sabotage.action });
  assert.equal(next.players.find((entry) => entry.id === "p1").reputation, 0);
});

test("customers with reputation requirements cannot be recruited early", () => {
  const state = buildFixtureState();
  const player = state.players.find((entry) => entry.id === "p1");
  player.hand = [pickCard("Dream Customer", "vip1")];

  assert.equal(buildLegalActions(state, "p1").filter((entry) => entry.cardName === "Dream Customer").length, 0);

  player.reputation = 8;
  const recruit = buildLegalActions(state, "p1").find((entry) => entry.cardName === "Dream Customer");
  assert.ok(recruit, "expected Dream Customer to be recruitable at 8 reputation");
});

test("reaching the cash target wins the game", () => {
  const state = buildFixtureState();
  const player = state.players.find((entry) => entry.id === "p1");
  player.cash = CASH_TARGET - 2;
  player.hand = [pickCard("Flash Sale", "flash1")];

  const play = buildLegalActions(state, "p1").find((entry) => entry.cardName === "Flash Sale");
  const next = applyAction(state, "p1", { cardUid: play.cardUid, action: play.action });

  assert.equal(next.status, "finished");
  assert.equal(next.winner.playerId, "p1");
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
    { id: "p1", name: "Alice", seatIndex: 0, reconnectToken: "r1" },
    { id: "p2", name: "Bob", seatIndex: 1, reconnectToken: "r2" },
    { id: "p3", name: "Casey", seatIndex: 2, reconnectToken: "r3" },
    { id: "p4", name: "Drew", seatIndex: 3, reconnectToken: "r4" }
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
  assert.equal(next.players.find((player) => player.id === "p2").hand.length, bobBefore + 2);
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

test("a full AI game plays to completion and produces a winner", () => {
  const manager = new RoomManager(new GameStore());
  const host = manager.createRoom({
    playerName: "Alice",
    seatIndex: 0,
    aiSeats: [
      { seatIndex: 1, personalityId: "closer" },
      { seatIndex: 2, personalityId: "saboteur" },
      { seatIndex: 3, personalityId: "bdc-hustler" }
    ]
  });

  let room = manager.setReady(host.roomCode, host.playerId, true);

  let guard = 0;
  while (room.state.status === "active" && guard < 400) {
    guard += 1;
    room = manager.endTurn(host.roomCode, host.playerId);
  }

  assert.equal(room.state.status, "finished");
  assert.ok(room.state.winner, "expected a winner");
});
