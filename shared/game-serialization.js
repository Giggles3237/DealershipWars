import { getAiPersonality, SEAT_CONFIG } from "./constants.js";

const sortObject = (value) => {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((accumulator, key) => {
        accumulator[key] = sortObject(value[key]);
        return accumulator;
      }, {});
  }

  return value;
};

export const stableStringify = (value) => JSON.stringify(sortObject(value));

export const serializePublicState = (state) => ({
  roomCode: state.roomCode,
  status: state.status,
  hostPlayerId: state.hostPlayerId,
  createdAt: state.createdAt,
  startedAt: state.startedAt,
  winner: state.winner,
  turnNumber: state.turnNumber,
  currentSeatIndex: state.currentSeatIndex,
  currentPlayerId: state.currentPlayerId,
  actionsRemaining: state.actionsRemaining,
  deckCount: state.deck.length,
  vehicleMarket: [...(state.vehicleMarket ?? [])],
  discardTop: state.discard[0] ?? null,
  discardCount: state.discard.length,
  log: [...state.log],
  seats: SEAT_CONFIG.map((seat) => {
    const player = state.players.find((entry) => entry.seatIndex === seat.seatIndex);
    const personality = player?.personalityId ? getAiPersonality(player.personalityId) : null;
    return {
      seatIndex: seat.seatIndex,
      seatKey: seat.key,
      seatName: seat.name,
      dealership: seat.dealership,
      title: personality?.title ?? seat.title,
      occupied: Boolean(player),
      playerId: player?.id ?? null,
      playerName: player?.name ?? null,
      isAi: Boolean(player?.isAi),
      personalityId: player?.personalityId ?? null,
      personalityName: personality?.name ?? null,
      personalityTagline: personality?.tagline ?? null,
      connected: player?.connected ?? false,
      ready: player?.ready ?? false,
      handCount: player?.hand.length ?? 0,
      cash: player?.cash ?? 0,
      reputation: player?.reputation ?? 0,
      carBonus: player?.carBonus ?? 0,
      handLimit: player?.handLimit ?? 0,
      customerCap: player?.customerCap ?? 0,
      salesClosed: player?.salesClosed ?? 0,
      customers: player ? [...player.customers] : [],
      salespeople: player ? [...player.salespeople] : [],
      vehicles: player ? [...player.vehicles] : []
    };
  })
});

export const serializePrivateView = (state, playerId, legalActions = []) => {
  const publicState = serializePublicState(state);
  const player = state.players.find((entry) => entry.id === playerId) ?? null;

  return {
    publicState,
    self: player
      ? {
          playerId: player.id,
          seatIndex: player.seatIndex,
          seatKey: SEAT_CONFIG[player.seatIndex].key,
          dealership: player.dealership,
          name: player.name,
          isAi: Boolean(player.isAi),
          personalityId: player.personalityId ?? null,
          ready: player.ready,
          connected: player.connected,
          hand: [...player.hand]
        }
      : null,
    legalActions
  };
};
