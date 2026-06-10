// Pure rules helpers shared by the Zustand store, the React HUD, and the Phaser scene.

export const WINNING_PROFIT = 100;
export const STARTING_HAND_SIZE = 5;
export const PLAYERS_PER_GAME = 4;
export const DEAL_SLOTS_PER_TEAM = 3;
// Turn economy: tweak these two to retune game tempo.
export const DRAW_COUNT = 2;
export const PLAYS_PER_TURN = 2;

export const DEAL_STATUS = {
  BUILDING: 'building',
  PENDING: 'pending',
  DELIVERED: 'delivered',
  DESTROYED: 'destroyed'
};

export const TEAM_CONFIG = [
  { id: 'team-a', name: 'Bavarian Motors', shortName: 'TEAM A', playerIndexes: [0, 2], accent: '#53d983', slotPrefix: 'A' },
  { id: 'team-b', name: 'Crosstown Auto', shortName: 'TEAM B', playerIndexes: [1, 3], accent: '#ff6f61', slotPrefix: 'B' }
];

export const PLAYER_SEATS = [
  { name: 'Player 1', persona: 'Closer Chris', seat: 'top' },
  { name: 'Player 2', persona: 'Finance Fran', seat: 'left' },
  { name: 'Player 3', persona: 'Desk Dana', seat: 'bottom' },
  { name: 'Player 4', persona: 'Lot Larry', seat: 'right' }
];

export function getTeamByPlayerIndex(playerIndex) {
  return TEAM_CONFIG.find((team) => team.playerIndexes.includes(playerIndex));
}

export function getOpponentTeamId(teamId) {
  return TEAM_CONFIG.find((team) => team.id !== teamId).id;
}

export function shuffle(cards) {
  const deck = [...cards];

  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }

  return deck;
}

function getCardTags(card) {
  return card?.combo?.tags || [];
}

function getVehicleValue(deal) {
  const usedCarBoost =
    deal.vehicle.name === 'High Mileage Trade' && deal.employee?.name === 'Used Car Manager' ? 5 : 0;

  return Math.max(0, deal.vehicle.value + usedCarBoost - (deal.vehiclePenalty || 0));
}

function getClientMatchBonus(client, vehicle) {
  if (client?.combo?.vehicleBonuses?.[vehicle.name]) {
    return client.combo.vehicleBonuses[vehicle.name];
  }

  if (client?.combo?.vehicleTags?.length) {
    const vehicleTags = getCardTags(vehicle);

    if (client.combo.vehicleTags.some((tag) => vehicleTags.includes(tag))) {
      return client.combo.bonus || 0;
    }
  }

  return client?.combo?.anyVehicleBonus || 0;
}

function getEmployeeBonus(employee, vehicle) {
  if (!employee) {
    return 0;
  }

  const combo = employee.combo || {};

  if (combo.bonusType === 'sale') {
    return combo.bonus || 0;
  }

  if (combo.bonusType === 'vehicleTag' && combo.tags?.some((tag) => getCardTags(vehicle).includes(tag))) {
    return combo.bonus || 0;
  }

  return 0;
}

function getEventBonus(events, client) {
  return (events || []).reduce((sum, card) => {
    let bonus = card.value > 0 ? card.value : 0;

    if (card.name === 'Factory Incentive' && client.name === 'College Graduate') {
      bonus += 2;
    }

    return sum + bonus;
  }, 0);
}

export function calculateDealProfit(deal) {
  if (!deal?.client || !deal?.vehicle) {
    return null;
  }

  const baseValue = deal.client.value + getVehicleValue(deal);
  const matchBonus = getClientMatchBonus(deal.client, deal.vehicle);
  const employeeBonus = getEmployeeBonus(deal.employee, deal.vehicle);
  const eventBonus = getEventBonus(deal.events, deal.client);

  return {
    baseValue,
    matchBonus,
    employeeBonus,
    eventBonus,
    total: baseValue + matchBonus + employeeBonus + eventBonus
  };
}

export function getDealProtection(deal) {
  if (!deal) {
    return { client: false, vehicle: false, sabotage: false, any: false };
  }

  const role = deal.protectionUsed ? '' : deal.employee?.protects || '';
  const client = role === 'client' || role === 'all' || Boolean(deal.client?.protectedClient);
  const vehicle = role === 'vehicle' || role === 'all';
  const sabotage = role === 'sabotage' || role === 'all';

  return { client, vehicle, sabotage, any: client || vehicle || sabotage };
}

export function isDealComplete(deal) {
  return Boolean(deal?.client && deal?.vehicle && deal?.employee);
}

// Visual status color per PRD: green safe, yellow pending, red threatened, blue protected.
export function getDealIndicator(deal) {
  if (!deal) {
    return 'empty';
  }

  if (getDealProtection(deal).any) {
    return 'protected';
  }

  if (deal.status === DEAL_STATUS.PENDING) {
    return 'pending';
  }

  return 'safe';
}

export function getCardRarity(card) {
  if (card.category === 'Legendary') {
    return 'Legendary';
  }

  if (card.value >= 8) {
    return 'Epic';
  }

  if (card.value >= 5) {
    return 'Rare';
  }

  return 'Common';
}
