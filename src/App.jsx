import { useState } from 'react';
import clientArt from './assets/cards/client-art.svg';
import vehicleArt from './assets/cards/vehicle-art.svg';
import employeeArt from './assets/cards/employee-art.svg';
import eventArt from './assets/cards/event-art.svg';
import clientTexture from './assets/cards/client-texture.svg';
import vehicleTexture from './assets/cards/vehicle-texture.svg';
import employeeTexture from './assets/cards/employee-texture.svg';
import eventTexture from './assets/cards/event-texture.svg';

const PLAYER_COLORS = ['#e05a47', '#1f6c5d', '#356ac3', '#9b5de5'];
const WINNING_PROFIT = 100;
const STARTING_HAND_SIZE = 5;
const DRAW_COUNT = 1;
const PLAYERS_PER_GAME = 4;

const TEAM_CONFIG = [
  { id: 'team-bmw', name: 'Team BMW', playerIndexes: [0, 2], accent: '#53d983' },
  { id: 'team-competition', name: 'Team Competition', playerIndexes: [1, 3], accent: '#ff6f61' }
];

const TYPE_ICONS = {
  Client: '$',
  Vehicle: 'V',
  Employee: 'E',
  Event: '!'
};

const TYPE_KICKERS = {
  Client: 'Buyer Lead',
  Vehicle: 'Inventory',
  Employee: 'Staff Bonus',
  Event: 'Market Shift'
};

const TYPE_ART = {
  Client: clientArt,
  Vehicle: vehicleArt,
  Employee: employeeArt,
  Event: eventArt
};

const TYPE_TEXTURE = {
  Client: clientTexture,
  Vehicle: vehicleTexture,
  Employee: employeeTexture,
  Event: eventTexture
};

const ATTACHABLE_EVENT_NAMES = new Set([
  'Factory Incentive',
  'Market Adjustment',
  'Google Review Hero',
  'Customer For Life'
]);

const CARD_LIBRARY = [
  { name: 'Dealer Principal', type: 'Event', rarity: 'Legendary', value: 0, valueLabel: 'Auto-Win', description: 'Immediately wins the current round. All pending deals for that team deliver instantly.', combo: { notes: 'Can be stopped only by Manufacturer Audit.' } },
  { name: 'Manufacturer Audit', type: 'Event', rarity: 'Legendary', value: 0, description: 'Cancels Dealer Principal.', combo: { notes: 'Prototype note: reaction timing is not implemented yet.' } },
  { name: 'First-Time Buyer', type: 'Client', value: 2, description: 'Basic client.', combo: { vehicleBonuses: { 'Base Model Sedan': 2, 'BMW X1': 2 }, notes: '+2 with Base Model Sedan or BMW X1.' } },
  { name: 'College Graduate', type: 'Client', value: 3, description: 'Gains +2 if paired with Factory Incentive.', combo: { notes: 'Good entry-level buyer.' } },
  { name: 'Family of Five', type: 'Client', value: 4, description: 'Strong SUV combos.', combo: { vehicleBonuses: { 'BMW X5': 6, 'BMW X3': 4 }, notes: '+6 with BMW X5, +4 with BMW X3.' } },
  { name: 'Empty Nester', type: 'Client', value: 4, description: 'Gains +3 with MINI Cooper or BMW M2.', combo: { vehicleBonuses: { 'MINI Cooper': 3, 'BMW M2': 3 }, notes: 'Wants something fun.' } },
  { name: 'Lease Return Customer', type: 'Client', value: 5, description: 'Gains +4 with any BMW vehicle.', combo: { vehicleTags: ['bmw'], bonus: 4, notes: 'Reliable repeat buyer.' } },
  { name: 'BMW Enthusiast', type: 'Client', value: 6, description: 'Huge M-car combos.', combo: { vehicleBonuses: { 'BMW M3': 8, 'BMW M2': 6, 'BMW 330i': 3 }, notes: '+8 with BMW M3, +6 with BMW M2.' } },
  { name: 'MINI Fanatic', type: 'Client', value: 6, description: 'Gains +8 with MINI Cooper.', combo: { vehicleBonuses: { 'MINI Cooper': 8 }, notes: 'Hard to steal once paired with MINI.' } },
  { name: 'Business Owner', type: 'Client', value: 7, description: 'Strong luxury/EV combos.', combo: { vehicleBonuses: { 'BMW iX': 6, 'BMW X5': 5 }, notes: '+6 with BMW iX, +5 with BMW X5.' } },
  { name: 'Out-of-State Buyer', type: 'Client', value: 7, description: 'Gains +3 but is vulnerable to paperwork events.', combo: { anyVehicleBonus: 3, notes: 'High value, high hassle.' } },
  { name: 'Referral Customer', type: 'Client', value: 8, description: 'Gains +3 with any vehicle.', combo: { anyVehicleBonus: 3, notes: 'Cannot be affected by Bad Survey.' } },
  { name: 'Corporate Fleet Buyer', type: 'Client', value: 9, description: 'May pair with up to 3 vehicles.', combo: { notes: '+12 if sold with 3 vehicles. Prototype currently supports 1 vehicle per deal.' } },
  { name: 'Luxury Shopper', type: 'Client', value: 10, description: 'Gains +10 with Unicorn Allocation.', combo: { vehicleBonuses: { 'Unicorn Allocation': 10 }, notes: 'Big-value client.' } },
  { name: 'Dream Customer', type: 'Client', value: 12, description: 'Gains +5 with any vehicle.', combo: { anyVehicleBonus: 5, notes: 'Cannot be stolen once paired.' } },
  { name: 'High Mileage Trade', type: 'Vehicle', value: 1, description: 'Weak vehicle unless boosted.', combo: { tags: ['trade-in'], notes: 'Used Car Manager makes it +5.' } },
  { name: 'Service Loaner', type: 'Vehicle', value: 2, description: 'Can become Certified Pre-Owned with Product Genius.', combo: { tags: ['bmw'], notes: 'Good low-value setup card.' } },
  { name: 'Base Model Sedan', type: 'Vehicle', value: 3, description: '+2 with First-Time Buyer.', combo: { tags: ['sedan'], notes: 'Simple starter vehicle.' } },
  { name: 'Certified Pre-Owned', type: 'Vehicle', value: 4, description: '+2 with Lease Return Customer.', combo: { tags: ['bmw', 'cpo'], notes: 'Safe, flexible vehicle.' } },
  { name: 'MINI Cooper', type: 'Vehicle', value: 4, description: '+8 with MINI Fanatic.', combo: { tags: ['mini'], notes: '+3 with Empty Nester.' } },
  { name: 'BMW X1', type: 'Vehicle', value: 5, description: '+2 with First-Time Buyer.', combo: { tags: ['bmw', 'suv'], notes: 'Entry luxury crossover.' } },
  { name: 'BMW 330i', type: 'Vehicle', value: 6, description: '+3 with BMW Enthusiast.', combo: { tags: ['bmw', 'sedan'], notes: 'Classic BMW deal.' } },
  { name: 'BMW X3', type: 'Vehicle', value: 7, description: '+4 with Family of Five.', combo: { tags: ['bmw', 'suv'], notes: 'High-demand inventory.' } },
  { name: 'BMW X5', type: 'Vehicle', value: 8, description: '+6 with Family of Five, +5 with Business Owner.', combo: { tags: ['bmw', 'suv', 'luxury'], notes: 'Premium SUV anchor card.' } },
  { name: 'BMW iX', type: 'Vehicle', value: 9, description: '+6 with Business Owner.', combo: { tags: ['bmw', 'ev', 'luxury'], notes: 'Can be boosted by Factory Incentive.' } },
  { name: 'BMW M2', type: 'Vehicle', value: 10, description: '+6 with BMW Enthusiast, +3 with Empty Nester.', combo: { tags: ['bmw', 'm-car', 'sport'], notes: 'Fun performance card.' } },
  { name: 'BMW M3', type: 'Vehicle', value: 11, description: '+8 with BMW Enthusiast.', combo: { tags: ['bmw', 'm-car', 'sport'], notes: 'One of the strongest normal vehicles.' } },
  { name: 'Unicorn Allocation', type: 'Vehicle', value: 15, description: '+10 with Luxury Shopper.', combo: { tags: ['bmw', 'luxury', 'rare'], notes: 'Rare, highest-value vehicle.' } },
  { name: 'New Hire', type: 'Employee', value: 1, description: 'Adds +1 to one sale.', combo: { bonusType: 'sale', bonus: 1, notes: 'Low value, but useful.' } },
  { name: 'Porter', type: 'Employee', value: 0, description: 'Draw 1 card when played.', combo: { notes: 'Fast utility card.' } },
  { name: 'Receptionist', type: 'Employee', value: 0, description: 'Protects one Client from being stolen or discarded.', combo: { notes: 'Defensive card.' } },
  { name: 'BDC Agent', type: 'Employee', value: 0, description: 'Search discard pile or deck for one Client.', combo: { notes: 'Find the next available Client.' } },
  { name: 'Product Genius', type: 'Employee', value: 2, description: '+2 to BMW vehicle sales.', combo: { bonusType: 'vehicleTag', tags: ['bmw'], bonus: 2, notes: 'Can upgrade Service Loaner to CPO.' } },
  { name: 'Finance Coordinator', type: 'Employee', value: 1, description: '+1 to every delivered deal while active.', combo: { bonusType: 'sale', bonus: 1, notes: 'Team support card.' } },
  { name: 'Service Advisor', type: 'Employee', value: 1, description: 'Gain +1 whenever an Event is played.', combo: { notes: 'Prototype note: passive trigger is not implemented yet.' } },
  { name: 'Client Advisor', type: 'Employee', value: 2, description: '+2 to all sales.', combo: { bonusType: 'sale', bonus: 2, notes: 'Reliable sales booster.' } },
  { name: 'F&I Manager', type: 'Employee', value: 3, description: '+3 to all sales.', combo: { bonusType: 'sale', bonus: 3, notes: 'Strong employee card.' } },
  { name: 'Used Car Manager', type: 'Employee', value: 2, description: 'High Mileage Trade gains +5 value.', combo: { notes: 'Makes weak cars useful.' } },
  { name: 'Sales Manager', type: 'Employee', value: 0, description: "Protects a vehicle in an active deal. Prototype note: extra play timing is not implemented.", combo: { notes: 'Vehicle protection card.' } },
  { name: 'GSM', type: 'Employee', value: 0, description: 'Once per turn, cancel one sabotage card targeting your team.', combo: { notes: 'Blocks sabotage while part of a deal.' } },
  { name: 'Superstar Employee', type: 'Employee', value: 4, description: 'Counts as any Employee. May protect any one card once.', combo: { bonusType: 'sale', bonus: 1, notes: 'Flexible power card.' } },
  { name: 'Bad Survey', type: 'Event', value: -5, description: 'Target team loses 5 profit.', combo: { notes: 'Direct team sabotage.' } },
  { name: 'Chargeback', type: 'Event', value: 0, description: "Cut opponent's most recent delivered sale profit in half.", combo: { notes: 'Cannot reduce below 5 profit.' } },
  { name: 'Factory Incentive', type: 'Event', value: 5, description: 'Attach to one deal. Vehicle gains +5.', combo: { notes: '+2 extra with College Graduate.' } },
  { name: 'Recall Campaign', type: 'Event', value: -2, description: 'All active Vehicles lose 2 value until your next turn.', combo: { notes: 'Prototype note: persistent global penalties are not implemented yet.' } },
  { name: 'Employee Quits', type: 'Event', value: 0, description: 'Opponent discards one Employee.', combo: { notes: 'Targets an active deal employee first.' } },
  { name: 'Massive Trade', type: 'Event', value: 0, description: 'Draw until you reveal 3 Vehicles. Keep them, discard the rest.', combo: { notes: 'Strong inventory reload.' } },
  { name: 'Viral Social Post', type: 'Event', value: 5, description: 'Gain 5 profit immediately.', combo: { notes: 'Immediate profit event.' } },
  { name: 'Internet Lead Ghosts You', type: 'Event', value: 0, description: 'Opponent discards one unprotected Client.', combo: { notes: 'Targets an active deal client first.' } },
  { name: 'Google Review Hero', type: 'Event', value: 3, description: 'Attach to a deal. Gain +3 when that employee helps deliver it.', combo: { notes: 'Long-term deal bonus.' } },
  { name: 'End-of-Month Rush', type: 'Event', value: 0, description: 'Deliver one eligible active deal immediately.', combo: { notes: 'Deliver one of your team active deals now.' } },
  { name: 'Market Adjustment', type: 'Event', value: 5, description: 'Attach to one deal. Vehicle gains +5.', combo: { notes: 'Cannot attach to Base Model Sedan in full rules.' } },
  { name: 'Customer For Life', type: 'Event', value: 0, description: 'Attach to a deal. After delivery, the client returns to hand.', combo: { notes: 'Prototype note: returned client goes to the deal owner hand.' } },
  { name: 'Record Month', type: 'Event', value: 10, description: 'Gain 10 profit immediately.', combo: { notes: 'If played after delivering a deal this turn, gain +3 extra.' } }
];

function shuffle(cards) {
  const deck = [...cards];

  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }

  return deck;
}

function createDeck() {
  return shuffle(
    CARD_LIBRARY.map((card, index) => ({
      ...card,
      id: `${card.type.toLowerCase()}-${index + 1}`
    }))
  );
}

function getTeamByPlayerIndex(playerIndex) {
  return TEAM_CONFIG.find((team) => team.playerIndexes.includes(playerIndex));
}

function createInitialGame() {
  const deck = createDeck();
  let deckIndex = 0;

  const players = Array.from({ length: PLAYERS_PER_GAME }, (_, index) => {
    const hand = deck.slice(deckIndex, deckIndex + STARTING_HAND_SIZE);
    deckIndex += STARTING_HAND_SIZE;
    const team = getTeamByPlayerIndex(index);

    return {
      id: `player-${index + 1}`,
      name: `Player ${index + 1}`,
      hand,
      teamId: team.id
    };
  });

  const teams = TEAM_CONFIG.map((team) => ({
    id: team.id,
    name: team.name,
    accent: team.accent,
    playerIndexes: team.playerIndexes,
    profit: 0,
    staging: [],
    activeDeals: [],
    lastDeliveredProfit: 0
  }));

  return {
    players,
    teams,
    deck: deck.slice(deckIndex),
    discard: [],
    activePlayerIndex: 0,
    absoluteTurn: 1,
    winnerTeamId: null,
    hasDrawnThisTurn: false,
    hasPlayedThisTurn: false,
    deliveredTeamIdThisTurn: '',
    deliveredProfitThisTurn: 0,
    message: 'Team BMW starts. Draw 1 card, play 1 card, then build or protect deals.',
    revealTurn: true
  };
}

function clonePlayers(players) {
  return players.map((player) => ({
    ...player,
    hand: [...player.hand]
  }));
}

function cloneTeams(teams) {
  return teams.map((team) => ({
    ...team,
    staging: [...team.staging],
    activeDeals: team.activeDeals.map((deal) => ({
      ...deal,
      attachments: [...deal.attachments]
    }))
  }));
}

function getCurrentPlayer(game) {
  return game.players[game.activePlayerIndex];
}

function getTeamIndex(teams, teamId) {
  return teams.findIndex((team) => team.id === teamId);
}

function getOpponentTeamId(teamId) {
  return TEAM_CONFIG.find((team) => team.id !== teamId).id;
}

function getCardTags(card) {
  return card?.combo?.tags || [];
}

function getVehicleSaleValue(vehicle, employee) {
  const employees = employee ? [employee] : [];
  const usedCarManagerBoost =
    vehicle.name === 'High Mileage Trade' && employees.some((member) => member.name === 'Used Car Manager') ? 5 : 0;

  return vehicle.value + usedCarManagerBoost;
}

function getClientMatchBonus(client, vehicle) {
  if (client?.combo?.vehicleBonuses?.[vehicle.name]) {
    return client.combo.vehicleBonuses[vehicle.name];
  }

  if (client?.combo?.vehicleTags?.length) {
    const vehicleTags = getCardTags(vehicle);
    const matched = client.combo.vehicleTags.some((tag) => vehicleTags.includes(tag));

    if (matched) {
      return client.combo.bonus || 0;
    }
  }

  return client?.combo?.anyVehicleBonus || 0;
}

function getEmployeeBonuses(employee, client, vehicle, baseValue, matchBonus) {
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

  if (combo.bonusType === 'baseValueMin' && baseValue >= combo.minimum) {
    return combo.bonus || 0;
  }

  if (combo.bonusType === 'requiresMatch' && matchBonus > 0) {
    return combo.bonus || 0;
  }

  return 0;
}

function getAttachmentBonus(attachments, client) {
  return attachments.reduce((sum, card) => {
    let bonus = card.value > 0 ? card.value : 0;

    if (card.name === 'Factory Incentive' && client.name === 'College Graduate') {
      bonus += 2;
    }

    return sum + bonus;
  }, 0);
}

function calculateDealProfit(deal) {
  const vehicleValue = getVehicleSaleValue(deal.vehicle, deal.employee);
  const baseValue = deal.client.value + vehicleValue;
  const matchBonus = getClientMatchBonus(deal.client, deal.vehicle);
  const employeeBonus = getEmployeeBonuses(deal.employee, deal.client, deal.vehicle, baseValue, matchBonus);
  const attachmentBonus = getAttachmentBonus(deal.attachments, deal.client);

  return {
    baseValue,
    matchBonus,
    employeeBonus,
    attachmentBonus,
    total: baseValue + matchBonus + employeeBonus + attachmentBonus
  };
}

function getCardRarity(card) {
  if (card.rarity) {
    return card.rarity;
  }

  if (card.value >= 6) {
    return 'Legendary';
  }

  if (card.value === 5) {
    return 'Epic';
  }

  if (card.value === 4) {
    return 'Rare';
  }

  return 'Uncommon';
}

function getCardStars(card) {
  const rarity = getCardRarity(card);

  if (rarity === 'Legendary') {
    return '***';
  }

  if (rarity === 'Epic') {
    return '**';
  }

  return '*';
}

function getComboSummary(card) {
  return card.combo?.notes || card.description;
}

function getDisplayValue(card) {
  return card.valueLabel || card.value;
}

function getDealProtection(deal) {
  const employeeName = deal.employee?.name || '';

  return {
    clientProtected:
      employeeName === 'Receptionist' ||
      employeeName === 'Superstar Employee' ||
      deal.client.name === 'Dream Customer',
    vehicleProtected: employeeName === 'Sales Manager' || employeeName === 'Superstar Employee',
    sabotageBlocked: employeeName === 'GSM'
  };
}

function deliverDeal(teams, players, discard, teamId, dealId) {
  const teamIndex = getTeamIndex(teams, teamId);
  const team = teams[teamIndex];
  const dealIndex = team.activeDeals.findIndex((deal) => deal.id === dealId);

  if (dealIndex < 0) {
    return { delivered: null, discard };
  }

  const [deal] = team.activeDeals.splice(dealIndex, 1);
  const profit = calculateDealProfit(deal);
  team.profit += profit.total;
  team.lastDeliveredProfit = profit.total;

  const nextDiscard = [...discard, deal.client, deal.vehicle];

  if (deal.employee) {
    nextDiscard.push(deal.employee);
  }

  nextDiscard.push(...deal.attachments);

  const customerForLife = deal.attachments.find((card) => card.name === 'Customer For Life');

  if (customerForLife) {
    const ownerIndex = players.findIndex((player) => player.id === deal.ownerPlayerId);

    if (ownerIndex >= 0) {
      players[ownerIndex].hand.push({ ...deal.client });
    }
  }

  return {
    delivered: {
      deal,
      profit
    },
    discard: nextDiscard
  };
}

function GameCard({ card, selected = false, compact = false, onClick = null }) {
  const clickable = typeof onClick === 'function';
  const className = `game-card ${card.type.toLowerCase()} ${compact ? 'compact' : 'full'} ${selected ? 'selected' : ''} ${clickable ? 'clickable' : ''}`;
  const cardStyle = {
    '--card-texture': `url(${TYPE_TEXTURE[card.type]})`,
    '--card-art-image': `url(${TYPE_ART[card.type]})`
  };

  return (
    <button className={className} onClick={onClick || undefined} type="button" disabled={!clickable} style={cardStyle}>
      <span className="card-noise" aria-hidden="true" />
      <span className="card-shine" aria-hidden="true" />
      <div className="card-header">
        <span className="card-brand">Dealership Wars</span>
        <span className="card-chip">{card.type}</span>
      </div>

      <div className="card-art">
        <div className="card-art-panel" aria-hidden="true">
          <span className="card-icon">{TYPE_ICONS[card.type] || '?'}</span>
        </div>
        <span className="card-watermark">{TYPE_KICKERS[card.type] || card.type}</span>
      </div>

      <div className="card-copy">
        <p className="card-kicker">{TYPE_KICKERS[card.type] || card.type}</p>
        <h3 className="card-name">{card.name}</h3>
        <p className="card-description">{card.description}</p>
      </div>

      <div className="card-effect-box">
        <span className="card-effect-label">Deal Effect</span>
        <p>{getComboSummary(card)}</p>
      </div>

      <div className="card-footer">
        <span className="card-power">Value {getDisplayValue(card)}</span>
        <span className="card-rarity">
          {getCardStars(card)} {getCardRarity(card)}
        </span>
      </div>
    </button>
  );
}

function App() {
  const [game, setGame] = useState(() => createInitialGame());
  const [selectedHandCardId, setSelectedHandCardId] = useState('');
  const [selectedStagingClientId, setSelectedStagingClientId] = useState('');
  const [selectedStagingVehicleId, setSelectedStagingVehicleId] = useState('');
  const [selectedStagingEmployeeId, setSelectedStagingEmployeeId] = useState('');
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState([]);
  const [selectedTargetDealId, setSelectedTargetDealId] = useState('');

  const currentPlayer = getCurrentPlayer(game);
  const currentTeam = game.teams.find((team) => team.id === currentPlayer.teamId);
  const opponentTeam = game.teams.find((team) => team.id === getOpponentTeamId(currentTeam.id));

  const stagingClients = currentTeam.staging.filter((card) => card.type === 'Client');
  const stagingVehicles = currentTeam.staging.filter((card) => card.type === 'Vehicle');
  const stagingEmployees = currentTeam.staging.filter((card) => card.type === 'Employee');
  const stagingAttachments = currentTeam.staging.filter((card) => card.type === 'Event' && ATTACHABLE_EVENT_NAMES.has(card.name));

  const selectedClient = stagingClients.find((card) => card.id === selectedStagingClientId);
  const selectedVehicle = stagingVehicles.find((card) => card.id === selectedStagingVehicleId);
  const selectedEmployee = stagingEmployees.find((card) => card.id === selectedStagingEmployeeId);
  const selectedAttachments = stagingAttachments.filter((card) => selectedAttachmentIds.includes(card.id));

  const pendingDealPreview =
    selectedClient && selectedVehicle
      ? calculateDealProfit({
          client: selectedClient,
          vehicle: selectedVehicle,
          employee: selectedEmployee || null,
          attachments: selectedAttachments
        })
      : null;

  function resetSelections() {
    setSelectedHandCardId('');
    setSelectedStagingClientId('');
    setSelectedStagingVehicleId('');
    setSelectedStagingEmployeeId('');
    setSelectedAttachmentIds([]);
    setSelectedTargetDealId('');
  }

  function startNewGame() {
    setGame(createInitialGame());
    resetSelections();
  }

  function handleDrawCard() {
    if (game.hasDrawnThisTurn || game.winnerTeamId) {
      return;
    }

    setGame((currentGame) => {
      const players = clonePlayers(currentGame.players);
      const player = players[currentGame.activePlayerIndex];
      const drawn = currentGame.deck.slice(0, DRAW_COUNT);

      player.hand.push(...drawn);

      return {
        ...currentGame,
        players,
        deck: currentGame.deck.slice(DRAW_COUNT),
        hasDrawnThisTurn: true,
        message: drawn.length ? `${player.name} drew 1 card.` : `${player.name} tried to draw, but the deck is empty.`
      };
    });
  }

  function handlePlayCard() {
    if (!selectedHandCardId || game.hasPlayedThisTurn || game.winnerTeamId) {
      return;
    }

    setGame((currentGame) => {
      let workingGame = currentGame;
      const players = clonePlayers(currentGame.players);
      const teams = cloneTeams(currentGame.teams);
      const player = players[currentGame.activePlayerIndex];
      const playerTeamIndex = getTeamIndex(teams, player.teamId);
      const playerTeam = teams[playerTeamIndex];
      const opponentTeamIndex = getTeamIndex(teams, getOpponentTeamId(player.teamId));
      const opponent = teams[opponentTeamIndex];
      const card = player.hand.find((entry) => entry.id === selectedHandCardId);

      if (!card) {
        return currentGame;
      }

      player.hand = player.hand.filter((entry) => entry.id !== selectedHandCardId);
      let discard = [...currentGame.discard];
      let message = `${player.name} played ${card.name}.`;
      let deliveredTeamIdThisTurn = currentGame.deliveredTeamIdThisTurn;
      let deliveredProfitThisTurn = currentGame.deliveredProfitThisTurn;
      let winnerTeamId = currentGame.winnerTeamId;

      if (card.type === 'Client' || card.type === 'Vehicle' || card.type === 'Employee') {
        playerTeam.staging.push(card);

        if (card.name === 'Porter' && workingGame.deck.length) {
          player.hand.push(workingGame.deck[0]);
          workingGame = {
            ...workingGame,
            deck: workingGame.deck.slice(1)
          };
          message = `${player.name} played Porter and drew 1 extra card.`;
        }

        if (card.name === 'BDC Agent') {
          const deckClient = workingGame.deck.find((entry) => entry.type === 'Client');
          const discardClient = discard.find((entry) => entry.type === 'Client');
          const found = deckClient || discardClient;

          if (found) {
            player.hand.push(found);
            if (deckClient) {
              workingGame = {
                ...workingGame,
                deck: workingGame.deck.filter((entry) => entry.id !== found.id)
              };
            } else {
              discard = discard.filter((entry) => entry.id !== found.id);
            }
            message = `${player.name} played BDC Agent and found ${found.name}.`;
          }
        }
      } else if (ATTACHABLE_EVENT_NAMES.has(card.name)) {
        playerTeam.staging.push(card);
        message = `${player.name} staged ${card.name} as a deal bonus.`;
      } else if (card.name === 'Bad Survey') {
        opponent.profit -= 5;
        discard.push(card);
        message = `${player.name} hit ${opponent.name} with Bad Survey for -5 profit.`;
      } else if (card.name === 'Viral Social Post') {
        playerTeam.profit += 5;
        discard.push(card);
        message = `${player.name} gained 5 profit from Viral Social Post.`;
      } else if (card.name === 'Record Month') {
        const bonus = currentGame.deliveredTeamIdThisTurn === playerTeam.id ? 3 : 0;
        playerTeam.profit += 10 + bonus;
        discard.push(card);
        message = `${player.name} gained ${10 + bonus} profit from Record Month.`;
      } else if (card.name === 'Massive Trade') {
        const kept = [];
        const tossed = [];
        const deck = [...workingGame.deck];

        while (deck.length && kept.length < 3) {
          const next = deck.shift();

          if (next.type === 'Vehicle') {
            kept.push(next);
          } else {
            tossed.push(next);
          }
        }

        player.hand.push(...kept);
        discard.push(card, ...tossed);
        workingGame = {
          ...workingGame,
          deck
        };
        message = `${player.name} played Massive Trade and found ${kept.length} vehicle card(s).`;
      } else if (card.name === 'Employee Quits') {
        const targetDeal = opponent.activeDeals.find((deal) => deal.id === selectedTargetDealId);

        if (targetDeal?.employee && !getDealProtection(targetDeal).sabotageBlocked) {
          discard.push(card, targetDeal.employee);
          targetDeal.employee = null;
          message = `${player.name} forced ${targetDeal.dealLabel} to lose its employee.`;
        } else {
          const stagingEmployee = opponent.staging.find((entry) => entry.type === 'Employee');

          if (stagingEmployee) {
            opponent.staging = opponent.staging.filter((entry) => entry.id !== stagingEmployee.id);
            discard.push(card, stagingEmployee);
            message = `${player.name} removed ${stagingEmployee.name} from ${opponent.name} staging.`;
          } else {
            discard.push(card);
            message = `${player.name} played Employee Quits, but there was no valid target.`;
          }
        }
      } else if (card.name === 'Internet Lead Ghosts You') {
        const targetDeal = opponent.activeDeals.find((deal) => deal.id === selectedTargetDealId);

        if (targetDeal) {
          const protection = getDealProtection(targetDeal);

          if (!protection.clientProtected && !protection.sabotageBlocked) {
            discard.push(card, targetDeal.client, targetDeal.vehicle, ...targetDeal.attachments);
            if (targetDeal.employee) {
              discard.push(targetDeal.employee);
            }
            opponent.activeDeals = opponent.activeDeals.filter((deal) => deal.id !== targetDeal.id);
            message = `${player.name} collapsed ${targetDeal.dealLabel} by discarding its client.`;
          } else {
            discard.push(card);
            message = `${player.name} targeted ${targetDeal.dealLabel}, but it was protected.`;
          }
        } else {
          const stagingClient = opponent.staging.find((entry) => entry.type === 'Client');

          if (stagingClient) {
            opponent.staging = opponent.staging.filter((entry) => entry.id !== stagingClient.id);
            discard.push(card, stagingClient);
            message = `${player.name} discarded ${stagingClient.name} from ${opponent.name} staging.`;
          } else {
            discard.push(card);
            message = `${player.name} played Internet Lead Ghosts You, but there was no valid target.`;
          }
        }
      } else if (card.name === 'Chargeback') {
        if (opponent.lastDeliveredProfit > 0) {
          const penalty = Math.max(5, Math.floor(opponent.lastDeliveredProfit / 2));
          opponent.profit -= penalty;
          discard.push(card);
          message = `${player.name} used Chargeback for -${penalty} profit against ${opponent.name}.`;
        } else {
          discard.push(card);
          message = `${player.name} played Chargeback, but ${opponent.name} had no recent delivered deal.`;
        }
      } else if (card.name === 'End-of-Month Rush') {
        const teamDeal = playerTeam.activeDeals.find((deal) => deal.id === selectedTargetDealId);

        if (teamDeal) {
          const result = deliverDeal(teams, players, discard, playerTeam.id, teamDeal.id);
          discard = result.discard;
          deliveredTeamIdThisTurn = playerTeam.id;
          deliveredProfitThisTurn = result.delivered?.profit.total || 0;
          message = `${player.name} rushed ${teamDeal.dealLabel} to delivery for ${deliveredProfitThisTurn} profit.`;
        } else {
          discard.push(card);
          message = `${player.name} played End-of-Month Rush, but no active deal was selected.`;
        }
      } else if (card.name === 'Dealer Principal') {
        discard.push(card);
        let deliveredCount = 0;
        let totalProfit = 0;
        const activeDealIds = [...playerTeam.activeDeals.map((deal) => deal.id)];

        activeDealIds.forEach((dealId) => {
          const result = deliverDeal(teams, players, discard, playerTeam.id, dealId);
          discard = result.discard;
          if (result.delivered) {
            deliveredCount += 1;
            totalProfit += result.delivered.profit.total;
          }
        });

        deliveredTeamIdThisTurn = playerTeam.id;
        deliveredProfitThisTurn = totalProfit;
        message = deliveredCount
          ? `${player.name} played Dealer Principal and instantly delivered ${deliveredCount} deal(s) for ${totalProfit} profit.`
          : `${player.name} played Dealer Principal, but there were no active deals to deliver.`;
      } else {
        discard.push(card);
      }

      const winningTeam = teams.find((team) => team.profit >= WINNING_PROFIT);
      if (winningTeam) {
        winnerTeamId = winningTeam.id;
        message = `${winningTeam.name} reached ${winningTeam.profit} profit and won the game.`;
      }

      return {
        ...workingGame,
        players,
        teams,
        discard,
        hasPlayedThisTurn: true,
        deliveredTeamIdThisTurn,
        deliveredProfitThisTurn,
        winnerTeamId,
        message
      };
    });

    setSelectedHandCardId('');
  }

  function toggleAttachment(cardId) {
    setSelectedAttachmentIds((current) => (current.includes(cardId) ? current.filter((id) => id !== cardId) : [...current, cardId]));
  }

  function handleBuildDeal() {
    if (!selectedClient || !selectedVehicle || game.winnerTeamId) {
      return;
    }

    setGame((currentGame) => {
      const teams = cloneTeams(currentGame.teams);
      const teamIndex = getTeamIndex(teams, currentPlayer.teamId);
      const team = teams[teamIndex];
      const client = team.staging.find((card) => card.id === selectedStagingClientId);
      const vehicle = team.staging.find((card) => card.id === selectedStagingVehicleId);

      if (!client || !vehicle) {
        return currentGame;
      }

      const employee = selectedStagingEmployeeId ? team.staging.find((card) => card.id === selectedStagingEmployeeId) : null;
      const attachments = team.staging.filter((card) => selectedAttachmentIds.includes(card.id));

      const movingIds = [client.id, vehicle.id, ...attachments.map((card) => card.id)];
      if (employee) {
        movingIds.push(employee.id);
      }

      team.staging = team.staging.filter((card) => !movingIds.includes(card.id));
      team.activeDeals.push({
        id: `deal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        dealLabel: `${client.name} + ${vehicle.name}`,
        teamId: team.id,
        ownerPlayerId: currentPlayer.id,
        client,
        vehicle,
        employee,
        attachments,
        createdTurn: currentGame.absoluteTurn,
        deliverOnTurn: currentGame.absoluteTurn + PLAYERS_PER_GAME
      });

      return {
        ...currentGame,
        teams,
        message: `${currentPlayer.name} built an active deal for ${team.name}. It delivers after one full rotation if it survives.`
      };
    });

    setSelectedStagingClientId('');
    setSelectedStagingVehicleId('');
    setSelectedStagingEmployeeId('');
    setSelectedAttachmentIds([]);
  }

  function handleEndTurn() {
    if (!game.hasDrawnThisTurn || !game.hasPlayedThisTurn || game.winnerTeamId) {
      return;
    }

    setGame((currentGame) => {
      const nextPlayerIndex = (currentGame.activePlayerIndex + 1) % currentGame.players.length;
      const nextAbsoluteTurn = currentGame.absoluteTurn + 1;
      const players = clonePlayers(currentGame.players);
      const teams = cloneTeams(currentGame.teams);
      let discard = [...currentGame.discard];
      let deliveredTeamIdThisTurn = '';
      let deliveredProfitThisTurn = 0;
      const deliveryMessages = [];

      teams.forEach((team) => {
        const dueDealIds = team.activeDeals.filter((deal) => deal.deliverOnTurn <= nextAbsoluteTurn).map((deal) => deal.id);

        dueDealIds.forEach((dealId) => {
          const result = deliverDeal(teams, players, discard, team.id, dealId);
          discard = result.discard;

          if (result.delivered) {
            deliveredTeamIdThisTurn = team.id;
            deliveredProfitThisTurn += result.delivered.profit.total;
            deliveryMessages.push(`${team.name} delivered ${result.delivered.deal.dealLabel} for ${result.delivered.profit.total} profit`);
          }
        });
      });

      let winnerTeamId = currentGame.winnerTeamId;
      const scoreWinner = teams.find((team) => team.profit >= WINNING_PROFIT);

      if (scoreWinner) {
        winnerTeamId = scoreWinner.id;
      } else if (!currentGame.deck.length && !teams.some((team) => team.activeDeals.length) && players.every((player) => !player.hand.length)) {
        winnerTeamId = teams[0].profit === teams[1].profit ? 'tie' : teams[0].profit > teams[1].profit ? teams[0].id : teams[1].id;
      }

      let message = `${players[nextPlayerIndex].name} is up next. Draw 1 card, play 1 card, then build or protect deals.`;

      if (deliveryMessages.length) {
        message = `${deliveryMessages.join('. ')}. ${message}`;
      }

      if (winnerTeamId === 'tie') {
        message = 'The deck is exhausted, all active deals are resolved, and the game ends in a tie.';
      } else if (winnerTeamId) {
        const winningTeam = teams.find((team) => team.id === winnerTeamId);
        message = `${winningTeam.name} wins with ${winningTeam.profit} profit.`;
      }

      return {
        ...currentGame,
        players,
        teams,
        discard,
        activePlayerIndex: nextPlayerIndex,
        absoluteTurn: nextAbsoluteTurn,
        hasDrawnThisTurn: false,
        hasPlayedThisTurn: false,
        deliveredTeamIdThisTurn,
        deliveredProfitThisTurn,
        winnerTeamId,
        revealTurn: false,
        message
      };
    });

    resetSelections();
  }

  const currentTeamDeals = currentTeam.activeDeals;
  const opponentTeamDeals = opponentTeam.activeDeals;

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">4-Player Team Prototype</p>
          <h1>Dealership Wars</h1>
          <p className="hero-copy">
            Two dealerships race to 100 profit by staging cards, building active deals, surviving sabotage, and delivering after one full table rotation.
          </p>
        </div>

        <div className="hero-panel">
          <p>
            Teams: Player 1 + Player 3 vs Player 2 + Player 4
          </p>
          <p>Turn flow: Draw 1, play 1, resolve effects, end turn.</p>
          <button className="primary-button" onClick={startNewGame}>
            New Game
          </button>
        </div>
      </header>

      <section className="instruction-panel">
        <h2>Prototype Rules</h2>
        <ol>
          <li>Players share staging and active deals with their teammate.</li>
          <li>A deal becomes active once you combine 1 Client and 1 Vehicle.</li>
          <li>Active deals score only after surviving one full rotation around the table.</li>
          <li>Some event and sabotage effects are implemented now; a few niche reactions are still marked as prototype notes on the cards.</li>
        </ol>
        <p>{game.message}</p>
      </section>

      <section className="team-grid">
        {game.teams.map((team) => (
          <article key={team.id} className={`team-summary ${team.id === currentTeam.id ? 'active-team' : ''}`} style={{ '--team-accent': team.accent }}>
            <h2>{team.name}</h2>
            <p>Profit: {team.profit}</p>
            <p>Staging: {team.staging.length} cards</p>
            <p>Active Deals: {team.activeDeals.length}</p>
            <p>
              Players:{' '}
              {team.playerIndexes.map((index) => game.players[index].name).join(' + ')}
            </p>
          </article>
        ))}
      </section>

      <section className="scoreboard">
        {game.players.map((player, index) => (
          <article
            key={player.id}
            className={`player-summary ${index === game.activePlayerIndex ? 'active' : ''}`}
            style={{ '--player-accent': PLAYER_COLORS[index] }}
          >
            <h3>{player.name}</h3>
            <p>{game.teams.find((team) => team.id === player.teamId).name}</p>
            <p>Hand: {player.hand.length} cards</p>
          </article>
        ))}
      </section>

      {!game.revealTurn && !game.winnerTeamId ? (
        <section className="pass-screen">
          <h2>Pass the Device</h2>
          <p>{currentPlayer.name}, reveal your hand when you are ready. Teammates may talk strategy, but hands stay private.</p>
          <button className="primary-button" onClick={() => setGame((currentGame) => ({ ...currentGame, revealTurn: true }))}>
            Reveal Turn
          </button>
        </section>
      ) : (
        <main className="game-board">
          <section className="status-strip">
            <div>
              <span>Round Turn {game.absoluteTurn}</span>
              <span>{currentPlayer.name} active</span>
              <span>{currentTeam.name}</span>
            </div>
            <div>
              <span>Deck: {game.deck.length}</span>
              <span>Discard: {game.discard.length}</span>
            </div>
          </section>

          <section className="actions-panel">
            <h2>Turn Actions</h2>
            <div className="action-buttons">
              <button className="primary-button" onClick={handleDrawCard} disabled={game.hasDrawnThisTurn || !!game.winnerTeamId}>
                Draw 1 Card
              </button>
              <button className="secondary-button" onClick={handlePlayCard} disabled={!selectedHandCardId || game.hasPlayedThisTurn || !!game.winnerTeamId}>
                Play Selected Card
              </button>
              <button className="secondary-button" onClick={handleBuildDeal} disabled={!selectedClient || !selectedVehicle || !!game.winnerTeamId}>
                Build Active Deal
              </button>
              <button className="secondary-button" onClick={handleEndTurn} disabled={!game.hasDrawnThisTurn || !game.hasPlayedThisTurn || !!game.winnerTeamId}>
                End Turn
              </button>
            </div>
            <p>Some event cards use the selected opposing active deal as their target. Choose one below before playing sabotage cards.</p>
          </section>

          <section className="card-section">
            <div className="section-heading">
              <h2>{currentPlayer.name} Hand</h2>
              <span>{selectedHandCardId ? '1 selected' : 'select 1 card'}</span>
            </div>
            <div className="card-grid">
              {currentPlayer.hand.map((card) => (
                <GameCard
                  key={card.id}
                  card={card}
                  selected={selectedHandCardId === card.id}
                  onClick={() => setSelectedHandCardId(selectedHandCardId === card.id ? '' : card.id)}
                />
              ))}
            </div>
          </section>

          <section className="team-board-grid">
            <section className="card-section">
              <div className="section-heading">
                <h2>{currentTeam.name} Staging</h2>
                <span>Choose cards to build the next active deal</span>
              </div>
              <div className="area-columns">
                <AreaColumn title="Clients" cards={stagingClients} selectable selectedId={selectedStagingClientId} onSelect={setSelectedStagingClientId} />
                <AreaColumn title="Vehicles" cards={stagingVehicles} selectable selectedId={selectedStagingVehicleId} onSelect={setSelectedStagingVehicleId} />
                <AreaColumn title="Employees" cards={stagingEmployees} selectable selectedId={selectedStagingEmployeeId} onSelect={setSelectedStagingEmployeeId} />
                <AttachmentColumn cards={stagingAttachments} selectedIds={selectedAttachmentIds} onToggle={toggleAttachment} />
              </div>
            </section>

            <section className="card-section">
              <div className="section-heading">
                <h2>Deal Preview</h2>
                <span>Active deals deliver after 4 total turns</span>
              </div>
              {pendingDealPreview ? (
                <div className="sale-breakdown">
                  <p>Client + Vehicle: {pendingDealPreview.baseValue}</p>
                  <p>Combo bonus: {pendingDealPreview.matchBonus}</p>
                  <p>Employee bonus: {pendingDealPreview.employeeBonus}</p>
                  <p>Event bonuses: {pendingDealPreview.attachmentBonus}</p>
                  <strong>Projected delivery profit: {pendingDealPreview.total}</strong>
                </div>
              ) : (
                <p>Select a client and vehicle from staging to preview an active deal.</p>
              )}
            </section>
          </section>

          <section className="team-board-grid">
            <section className="card-section">
              <div className="section-heading">
                <h2>{currentTeam.name} Active Deals</h2>
                <span>{currentTeamDeals.length} pending</span>
              </div>
              <DealList deals={currentTeamDeals} selectedDealId={selectedTargetDealId} onSelect={setSelectedTargetDealId} currentTurn={game.absoluteTurn} />
            </section>

            <section className="card-section">
              <div className="section-heading">
                <h2>{opponentTeam.name} Active Deals</h2>
                <span>Select a target for sabotage cards</span>
              </div>
              <DealList deals={opponentTeamDeals} selectedDealId={selectedTargetDealId} onSelect={setSelectedTargetDealId} currentTurn={game.absoluteTurn} />
            </section>
          </section>
        </main>
      )}
    </div>
  );
}

function AreaColumn({ title, cards, selectable = false, selectedId = '', onSelect = () => {} }) {
  return (
    <div className="area-column">
      <h3>{title}</h3>
      {cards.length === 0 ? <p className="empty-state">No cards staged.</p> : null}
      <div className="mini-card-list">
        {cards.map((card) => {
          const isSelected = selectedId === card.id;

          return (
            <GameCard
              key={card.id}
              card={card}
              compact
              selected={isSelected}
              onClick={selectable ? () => onSelect(isSelected ? '' : card.id) : null}
            />
          );
        })}
      </div>
    </div>
  );
}

function AttachmentColumn({ cards, selectedIds, onToggle }) {
  return (
    <div className="area-column">
      <h3>Event Boosts</h3>
      {cards.length === 0 ? <p className="empty-state">No bonus events staged.</p> : null}
      <div className="mini-card-list">
        {cards.map((card) => (
          <GameCard
            key={card.id}
            card={card}
            compact
            selected={selectedIds.includes(card.id)}
            onClick={() => onToggle(card.id)}
          />
        ))}
      </div>
    </div>
  );
}

function DealList({ deals, selectedDealId, onSelect, currentTurn }) {
  if (!deals.length) {
    return <p className="empty-state">No active deals yet.</p>;
  }

  return (
    <div className="deal-list">
      {deals.map((deal) => {
        const profit = calculateDealProfit(deal);
        const turnsLeft = Math.max(0, deal.deliverOnTurn - currentTurn);

        return (
          <button
            key={deal.id}
            type="button"
            className={`deal-tile ${selectedDealId === deal.id ? 'selected' : ''}`}
            onClick={() => onSelect(selectedDealId === deal.id ? '' : deal.id)}
          >
            <div className="deal-header">
              <strong>{deal.dealLabel}</strong>
              <span>Delivers in {turnsLeft}</span>
            </div>
            <p>Projected profit: {profit.total}</p>
            <p>Employee: {deal.employee ? deal.employee.name : 'None'}</p>
            <p>Event boosts: {deal.attachments.length ? deal.attachments.map((card) => card.name).join(', ') : 'None'}</p>
          </button>
        );
      })}
    </div>
  );
}

export default App;
