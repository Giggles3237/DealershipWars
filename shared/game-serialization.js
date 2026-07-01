import { getAiPersonality, SEAT_CONFIG, TEAM_CONFIG } from "./constants.js";

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
      title: personality?.title ?? seat.title,
      teamIndex: seat.teamIndex,
      occupied: Boolean(player),
      playerId: player?.id ?? null,
      playerName: player?.name ?? null,
      isAi: Boolean(player?.isAi),
      personalityId: player?.personalityId ?? null,
      personalityName: personality?.name ?? null,
      personalityTagline: personality?.tagline ?? null,
      connected: player?.connected ?? false,
      ready: player?.ready ?? false,
      handCount: player?.hand.length ?? 0
    };
  }),
  teams: TEAM_CONFIG.map((team, teamIndex) => ({
    teamIndex,
    name: team.name,
    label: team.label,
    profit: state.teams[teamIndex].profit,
    deliveredDeals: [...state.teams[teamIndex].deliveredDeals],
    slotLabels: [...team.slotLabels],
    slots: state.teams[teamIndex].slots.map((deal) => {
      if (!deal) {
        return null;
      }

      return {
        teamIndex: deal.teamIndex,
        slotIndex: deal.slotIndex,
        slotLabel: deal.slotLabel,
        ownerPlayerId: deal.ownerPlayerId,
        pendingSinceTeamTurn: deal.pendingSinceTeamTurn,
        client: deal.client,
        vehicle: deal.vehicle,
        extraVehicles: [...deal.extraVehicles],
        employee: deal.employee,
        attachments: [...deal.attachments]
      };
    })
  }))
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
          teamIndex: player.teamIndex,
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
