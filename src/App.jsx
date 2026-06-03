import { useState } from 'react';

const PLAYER_COLORS = ['#e05a47', '#1f6c5d', '#356ac3', '#9b5de5'];
const PLAYER_OPTIONS = [2, 3, 4];
const WINNING_PROFIT = 50;
const STARTING_HAND_SIZE = 3;
const DRAW_COUNT = 2;
const MAX_PLAYS_PER_TURN = 2;

const clientCards = [
  { name: 'Budget Shopper', value: 3, description: 'Prefers reliable daily drivers.', combo: { vehicleTags: ['economy'], bonus: 2 } },
  { name: 'Family Planner', value: 4, description: 'Needs room for the whole crew.', combo: { vehicleTags: ['suv', 'van'], bonus: 3 } },
  { name: 'Luxury Collector', value: 6, description: 'Only impressed by premium inventory.', combo: { vehicleTags: ['luxury'], bonus: 4 } },
  { name: 'Weekend Adventurer', value: 5, description: 'Wants something trail ready.', combo: { vehicleTags: ['truck', 'suv'], bonus: 3 } },
  { name: 'Commuter Pro', value: 4, description: 'Prioritizes fuel savings and comfort.', combo: { vehicleTags: ['economy', 'hybrid'], bonus: 3 } },
  { name: 'Startup Founder', value: 6, description: 'Needs a flashy ride for investor meetings.', combo: { vehicleTags: ['sport', 'luxury'], bonus: 4 } },
  { name: 'Contractor Crew', value: 5, description: 'Needs hauling power for job sites.', combo: { vehicleTags: ['truck'], bonus: 4 } },
  { name: 'Eco Influencer', value: 5, description: 'Wants sustainable style.', combo: { vehicleTags: ['hybrid', 'electric'], bonus: 4 } },
  { name: 'Road Trip Couple', value: 4, description: 'Needs comfort for long drives.', combo: { vehicleTags: ['suv', 'luxury'], bonus: 2 } },
  { name: 'City Driver', value: 3, description: 'Needs compact parking-friendly options.', combo: { vehicleTags: ['economy', 'electric'], bonus: 2 } },
  { name: 'Performance Fan', value: 6, description: 'Cares about speed and handling.', combo: { vehicleTags: ['sport'], bonus: 5 } },
  { name: 'Growing Business', value: 5, description: 'Needs a fleet-friendly purchase.', combo: { vehicleTags: ['van', 'truck'], bonus: 3 } },
  { name: 'Luxury Family', value: 6, description: 'Wants premium comfort with space.', combo: { vehicleTags: ['luxury', 'suv'], bonus: 4 } }
];

const vehicleCards = [
  { name: 'Compact Hatch', value: 3, description: 'Affordable and easy to park.', combo: { tags: ['economy'] } },
  { name: 'Hybrid Cruiser', value: 4, description: 'Strong mileage with modern trim.', combo: { tags: ['hybrid'] } },
  { name: 'Electric Sprint', value: 5, description: 'Quiet, quick, and fully electric.', combo: { tags: ['electric'] } },
  { name: 'Family SUV', value: 5, description: 'Roomy three-row favorite.', combo: { tags: ['suv'] } },
  { name: 'Luxury Sedan', value: 6, description: 'Leather interior and premium feel.', combo: { tags: ['luxury'] } },
  { name: 'Off-Road Truck', value: 6, description: 'Built for hard work and dirt roads.', combo: { tags: ['truck'] } },
  { name: 'Sports Coupe', value: 6, description: 'Fast, loud, and attention grabbing.', combo: { tags: ['sport'] } },
  { name: 'Cargo Van', value: 4, description: 'Perfect for small business deliveries.', combo: { tags: ['van'] } },
  { name: 'Executive SUV', value: 6, description: 'Luxury seating with commanding height.', combo: { tags: ['luxury', 'suv'] } },
  { name: 'Worksite Pickup', value: 5, description: 'Reliable truck for commercial buyers.', combo: { tags: ['truck'] } },
  { name: 'City EV', value: 4, description: 'Compact electric commuter.', combo: { tags: ['electric', 'economy'] } },
  { name: 'Adventure Crossover', value: 5, description: 'Balanced utility for travel clients.', combo: { tags: ['suv'] } },
  { name: 'Premium Hybrid', value: 5, description: 'Efficiency with a refined cabin.', combo: { tags: ['hybrid', 'luxury'] } }
];

const employeeCards = [
  { name: 'Closer', value: 2, description: '+2 profit on every sale you make this turn.', combo: { bonusType: 'sale', bonus: 2 } },
  { name: 'Finance Wizard', value: 3, description: '+3 profit when selling value 5 or higher vehicles.', combo: { bonusType: 'vehicleMin', minimum: 5, bonus: 3 } },
  { name: 'VIP Concierge', value: 2, description: '+2 profit when serving luxury clients.', combo: { bonusType: 'clientTag', tags: ['luxury'] , bonus: 2 } },
  { name: 'Fleet Specialist', value: 2, description: '+2 profit on van or truck sales.', combo: { bonusType: 'vehicleTag', tags: ['van', 'truck'], bonus: 2 } },
  { name: 'Trade-In Expert', value: 1, description: '+1 profit on all sales.', combo: { bonusType: 'sale', bonus: 1 } },
  { name: 'Eco Advisor', value: 2, description: '+2 profit on hybrid or electric sales.', combo: { bonusType: 'vehicleTag', tags: ['hybrid', 'electric'], bonus: 2 } },
  { name: 'Showroom Stylist', value: 2, description: '+2 profit when selling luxury vehicles.', combo: { bonusType: 'vehicleTag', tags: ['luxury'], bonus: 2 } },
  { name: 'Test Drive Ace', value: 2, description: '+2 profit when selling sport vehicles.', combo: { bonusType: 'vehicleTag', tags: ['sport'], bonus: 2 } },
  { name: 'Community Rep', value: 2, description: '+2 profit on economy sales.', combo: { bonusType: 'vehicleTag', tags: ['economy'], bonus: 2 } },
  { name: 'Commercial Broker', value: 3, description: '+3 profit when selling to business-minded clients.', combo: { bonusType: 'clientNames', names: ['Growing Business', 'Contractor Crew'], bonus: 3 } },
  { name: 'Retention Lead', value: 1, description: '+1 profit on all sales.', combo: { bonusType: 'sale', bonus: 1 } },
  { name: 'Upsell Coach', value: 3, description: '+3 profit when total base sale value is 10 or more.', combo: { bonusType: 'baseValueMin', minimum: 10, bonus: 3 } },
  { name: 'Referral Manager', value: 2, description: '+2 profit when client and vehicle combo already match.', combo: { bonusType: 'requiresMatch', bonus: 2 } }
];

const eventCards = [
  { name: 'Flash Sale', value: 2, description: 'Counts as +2 profit while in your area.', combo: { bonusType: 'passiveProfit', bonus: 2 } },
  { name: 'Radio Campaign', value: 1, description: 'Counts as +1 profit while in your area.', combo: { bonusType: 'passiveProfit', bonus: 1 } },
  { name: 'VIP Expo', value: 3, description: 'Counts as +3 profit while in your area.', combo: { bonusType: 'passiveProfit', bonus: 3 } },
  { name: 'Service Special', value: 1, description: 'Counts as +1 profit while in your area.', combo: { bonusType: 'passiveProfit', bonus: 1 } },
  { name: 'Local Sponsorship', value: 2, description: 'Counts as +2 profit while in your area.', combo: { bonusType: 'passiveProfit', bonus: 2 } },
  { name: 'Grand Opening', value: 3, description: 'Counts as +3 profit while in your area.', combo: { bonusType: 'passiveProfit', bonus: 3 } },
  { name: 'Inventory Clearance', value: 2, description: 'Counts as +2 profit while in your area.', combo: { bonusType: 'passiveProfit', bonus: 2 } },
  { name: 'Community Event', value: 1, description: 'Counts as +1 profit while in your area.', combo: { bonusType: 'passiveProfit', bonus: 1 } },
  { name: 'Holiday Weekend', value: 2, description: 'Counts as +2 profit while in your area.', combo: { bonusType: 'passiveProfit', bonus: 2 } },
  { name: 'Referral Blitz', value: 2, description: 'Counts as +2 profit while in your area.', combo: { bonusType: 'passiveProfit', bonus: 2 } },
  { name: 'Premium Showcase', value: 3, description: 'Counts as +3 profit while in your area.', combo: { bonusType: 'passiveProfit', bonus: 3 } },
  { name: 'Business Summit', value: 2, description: 'Counts as +2 profit while in your area.', combo: { bonusType: 'passiveProfit', bonus: 2 } },
  { name: 'Customer Appreciation', value: 1, description: 'Counts as +1 profit while in your area.', combo: { bonusType: 'passiveProfit', bonus: 1 } }
];

const createDeck = () => {
  const typedCards = [
    ...clientCards.map((card, index) => ({ ...card, id: `client-${index + 1}`, type: 'Client' })),
    ...vehicleCards.map((card, index) => ({ ...card, id: `vehicle-${index + 1}`, type: 'Vehicle' })),
    ...employeeCards.map((card, index) => ({ ...card, id: `employee-${index + 1}`, type: 'Employee' })),
    ...eventCards.map((card, index) => ({ ...card, id: `event-${index + 1}`, type: 'Event' }))
  ];

  return shuffle(typedCards);
};

function shuffle(cards) {
  const deck = [...cards];

  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }

  return deck;
}

function buildPlayers(playerCount, deck) {
  let deckIndex = 0;

  const players = Array.from({ length: playerCount }, (_, index) => {
    const hand = deck.slice(deckIndex, deckIndex + STARTING_HAND_SIZE);
    deckIndex += STARTING_HAND_SIZE;

    return {
      id: `player-${index + 1}`,
      name: `Player ${index + 1}`,
      profit: 0,
      hand,
      area: []
    };
  });

  return {
    players,
    remainingDeck: deck.slice(deckIndex)
  };
}

function createInitialGame(playerCount) {
  const deck = createDeck();
  const { players, remainingDeck } = buildPlayers(playerCount, deck);

  return {
    players,
    deck: remainingDeck,
    discard: [],
    activePlayerIndex: 0,
    turn: 1,
    winnerId: null,
    message: 'Dealership Wars begins. Draw 2 cards to start the turn.',
    playedCardIdsThisTurn: [],
    hasDrawnThisTurn: false,
    hasSoldThisTurn: false
  };
}

function clonePlayers(players) {
  return players.map((player) => ({
    ...player,
    hand: [...player.hand],
    area: [...player.area]
  }));
}

function getCardTags(card) {
  if (!card?.combo?.tags) {
    return [];
  }

  return card.combo.tags;
}

function getClientMatchBonus(client, vehicle) {
  if (!client?.combo?.vehicleTags?.length) {
    return 0;
  }

  const vehicleTags = getCardTags(vehicle);
  const matched = client.combo.vehicleTags.some((tag) => vehicleTags.includes(tag));

  return matched ? client.combo.bonus || 0 : 0;
}

function getEmployeeBonuses(employees, client, vehicle, baseValue, matchBonus) {
  return employees.reduce(
    (total, employee) => {
      const combo = employee.combo || {};

      if (combo.bonusType === 'sale') {
        return total + (combo.bonus || 0);
      }

      if (combo.bonusType === 'vehicleMin' && vehicle.value >= combo.minimum) {
        return total + (combo.bonus || 0);
      }

      if (combo.bonusType === 'vehicleTag' && combo.tags?.some((tag) => getCardTags(vehicle).includes(tag))) {
        return total + (combo.bonus || 0);
      }

      if (combo.bonusType === 'clientTag' && combo.tags?.some((tag) => client.combo?.vehicleTags?.includes(tag))) {
        return total + (combo.bonus || 0);
      }

      if (combo.bonusType === 'clientNames' && combo.names?.includes(client.name)) {
        return total + (combo.bonus || 0);
      }

      if (combo.bonusType === 'baseValueMin' && baseValue >= combo.minimum) {
        return total + (combo.bonus || 0);
      }

      if (combo.bonusType === 'requiresMatch' && matchBonus > 0) {
        return total + (combo.bonus || 0);
      }

      return total;
    },
    0
  );
}

function drawCards(deck, amount) {
  return {
    drawn: deck.slice(0, amount),
    remainingDeck: deck.slice(amount)
  };
}

function App() {
  const [playerCount, setPlayerCount] = useState(2);
  const [game, setGame] = useState(() => createInitialGame(2));
  const [selectedHandCards, setSelectedHandCards] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [revealTurn, setRevealTurn] = useState(true);

  const activePlayer = game.players[game.activePlayerIndex];
  const activeClients = activePlayer.area.filter((card) => card.type === 'Client');
  const activeVehicles = activePlayer.area.filter((card) => card.type === 'Vehicle');
  const activeEmployees = activePlayer.area.filter((card) => card.type === 'Employee');
  const activeEvents = activePlayer.area.filter((card) => card.type === 'Event');

  const selectedClient = activeClients.find((card) => card.id === selectedClientId);
  const selectedVehicle = activeVehicles.find((card) => card.id === selectedVehicleId);
  const activeEventProfit = activeEvents.reduce((sum, card) => sum + (card.combo?.bonus || 0), 0);

  let salePreview = null;

  if (selectedClient && selectedVehicle) {
    const baseValue = selectedClient.value + selectedVehicle.value;
    const matchBonus = getClientMatchBonus(selectedClient, selectedVehicle);

    salePreview = {
      client: selectedClient,
      vehicle: selectedVehicle,
      baseValue,
      matchBonus,
      employeeBonus: getEmployeeBonuses(activeEmployees, selectedClient, selectedVehicle, baseValue, matchBonus)
    };
  }

  const canPlayCards =
    game.hasDrawnThisTurn &&
    !game.winnerId &&
    selectedHandCards.length > 0 &&
    selectedHandCards.length <= MAX_PLAYS_PER_TURN &&
    game.playedCardIdsThisTurn.length + selectedHandCards.length <= MAX_PLAYS_PER_TURN;

  function startNewGame(nextPlayerCount = playerCount) {
    setGame(createInitialGame(nextPlayerCount));
    setSelectedHandCards([]);
    setSelectedClientId('');
    setSelectedVehicleId('');
    setRevealTurn(true);
  }

  function updateGameState(updater) {
    setGame((currentGame) => updater(currentGame));
  }

  function toggleHandCard(cardId) {
    if (!game.hasDrawnThisTurn || game.winnerId) {
      return;
    }

    setSelectedHandCards((current) => {
      if (current.includes(cardId)) {
        return current.filter((id) => id !== cardId);
      }

      if (current.length >= MAX_PLAYS_PER_TURN || game.playedCardIdsThisTurn.length + current.length >= MAX_PLAYS_PER_TURN) {
        return current;
      }

      return [...current, cardId];
    });
  }

  function handleDrawCards() {
    if (game.hasDrawnThisTurn || game.winnerId) {
      return;
    }

    updateGameState((currentGame) => {
      const players = clonePlayers(currentGame.players);
      const currentPlayer = players[currentGame.activePlayerIndex];
      const { drawn, remainingDeck } = drawCards(currentGame.deck, DRAW_COUNT);

      currentPlayer.hand.push(...drawn);

      return {
        ...currentGame,
        players,
        deck: remainingDeck,
        hasDrawnThisTurn: true,
        message:
          drawn.length === DRAW_COUNT
            ? `${currentPlayer.name} drew ${DRAW_COUNT} cards and can now play up to ${MAX_PLAYS_PER_TURN} cards.`
            : `${currentPlayer.name} drew the last ${drawn.length} card(s).`
      };
    });
  }

  function handlePlayCards() {
    if (!canPlayCards) {
      return;
    }

    updateGameState((currentGame) => {
      const players = clonePlayers(currentGame.players);
      const currentPlayer = players[currentGame.activePlayerIndex];
      const cardsToPlay = currentPlayer.hand.filter((card) => selectedHandCards.includes(card.id));

      currentPlayer.hand = currentPlayer.hand.filter((card) => !selectedHandCards.includes(card.id));
      currentPlayer.area.push(...cardsToPlay);

      return {
        ...currentGame,
        players,
        playedCardIdsThisTurn: [...currentGame.playedCardIdsThisTurn, ...selectedHandCards],
        message: `${currentPlayer.name} played ${cardsToPlay.length} card${cardsToPlay.length > 1 ? 's' : ''} to the dealership area.`
      };
    });

    setSelectedHandCards([]);
  }

  function handleAttemptSale() {
    if (!salePreview || game.hasSoldThisTurn || game.winnerId) {
      return;
    }

    updateGameState((currentGame) => {
      const players = clonePlayers(currentGame.players);
      const currentPlayer = players[currentGame.activePlayerIndex];
      const client = currentPlayer.area.find((card) => card.id === selectedClientId);
      const vehicle = currentPlayer.area.find((card) => card.id === selectedVehicleId);

      if (!client || !vehicle) {
        return currentGame;
      }

      const matchBonus = getClientMatchBonus(client, vehicle);
      const baseValue = client.value + vehicle.value;
      const employees = currentPlayer.area.filter((card) => card.type === 'Employee');
      const employeeBonus = getEmployeeBonuses(employees, client, vehicle, baseValue, matchBonus);
      const eventBonus = currentPlayer.area
        .filter((card) => card.type === 'Event')
        .reduce((sum, card) => sum + (card.combo?.bonusType === 'passiveProfit' ? card.combo.bonus || 0 : 0), 0);
      const totalProfit = baseValue + matchBonus + employeeBonus + eventBonus;
      const newProfit = currentPlayer.profit + totalProfit;

      currentPlayer.profit = newProfit;
      currentPlayer.area = currentPlayer.area.filter((card) => card.id !== client.id && card.id !== vehicle.id);

      const winnerId = newProfit >= WINNING_PROFIT ? currentPlayer.id : null;

      return {
        ...currentGame,
        players,
        discard: [...currentGame.discard, client, vehicle],
        hasSoldThisTurn: true,
        winnerId,
        message: winnerId
          ? `${currentPlayer.name} closes the deal for ${totalProfit} profit and wins with ${newProfit}!`
          : `${currentPlayer.name} sold ${client.name} + ${vehicle.name} for ${totalProfit} profit.`
      };
    });

    setSelectedClientId('');
    setSelectedVehicleId('');
  }

  function handleEndTurn() {
    if (!game.hasDrawnThisTurn || game.winnerId) {
      return;
    }

    updateGameState((currentGame) => {
      const nextPlayerIndex = (currentGame.activePlayerIndex + 1) % currentGame.players.length;
      const nextTurn = nextPlayerIndex === 0 ? currentGame.turn + 1 : currentGame.turn;

      return {
        ...currentGame,
        activePlayerIndex: nextPlayerIndex,
        turn: nextTurn,
        hasDrawnThisTurn: false,
        hasSoldThisTurn: false,
        playedCardIdsThisTurn: [],
        message: `${currentGame.players[nextPlayerIndex].name} is up next. Pass the device, then reveal the turn.`
      };
    });

    setSelectedHandCards([]);
    setSelectedClientId('');
    setSelectedVehicleId('');
    setRevealTurn(false);
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Local Pass-and-Play Prototype</p>
          <h1>Dealership Wars</h1>
          <p className="hero-copy">
            Build a stronger dealership, line up clients with the right vehicles, and stack bonuses before another player reaches {WINNING_PROFIT} profit.
          </p>
        </div>

        <div className="hero-panel">
          <label htmlFor="player-count">Players</label>
          <select
            id="player-count"
            value={playerCount}
            onChange={(event) => {
              const nextCount = Number(event.target.value);
              setPlayerCount(nextCount);
              startNewGame(nextCount);
            }}
          >
            {PLAYER_OPTIONS.map((count) => (
              <option key={count} value={count}>
                {count} Players
              </option>
            ))}
          </select>

          <button className="primary-button" onClick={() => startNewGame(playerCount)}>
            New Game
          </button>
        </div>
      </header>

      <section className="instruction-panel">
        <h2>How a Turn Works</h2>
        <ol>
          <li>Draw 2 cards.</li>
          <li>Play up to 2 cards from your hand into your dealership area.</li>
          <li>Attempt one sale by pairing a Client and a Vehicle already in your area.</li>
          <li>End your turn and pass the device.</li>
        </ol>
        <p>{game.message}</p>
      </section>

      <section className="scoreboard">
        {game.players.map((player, index) => (
          <article
            key={player.id}
            className={`player-summary ${index === game.activePlayerIndex ? 'active' : ''} ${game.winnerId === player.id ? 'winner' : ''}`}
            style={{ '--player-accent': PLAYER_COLORS[index] }}
          >
            <h3>{player.name}</h3>
            <p>Profit: {player.profit}</p>
            <p>Hand: {player.hand.length} cards</p>
            <p>Area: {player.area.length} cards</p>
          </article>
        ))}
      </section>

      {!revealTurn && !game.winnerId ? (
        <section className="pass-screen">
          <h2>Pass the Device</h2>
          <p>{game.players[game.activePlayerIndex].name}, tap reveal when you are ready. Your hand stays hidden until then.</p>
          <button className="primary-button" onClick={() => setRevealTurn(true)}>
            Reveal Turn
          </button>
        </section>
      ) : (
        <main className="game-board">
          <section className="status-strip">
            <div>
              <span>Turn {game.turn}</span>
              <span>{activePlayer.name} active</span>
            </div>
            <div>
              <span>Deck: {game.deck.length}</span>
              <span>Discard: {game.discard.length}</span>
            </div>
          </section>

          <section className="actions-panel">
            <h2>Turn Actions</h2>
            <div className="action-buttons">
              <button className="primary-button" onClick={handleDrawCards} disabled={game.hasDrawnThisTurn || !!game.winnerId}>
                Draw 2 Cards
              </button>
              <button className="secondary-button" onClick={handlePlayCards} disabled={!canPlayCards}>
                Play Selected Cards
              </button>
              <button
                className="secondary-button"
                onClick={handleAttemptSale}
                disabled={!salePreview || game.hasSoldThisTurn || !!game.winnerId}
              >
                Attempt Sale
              </button>
              <button className="secondary-button" onClick={handleEndTurn} disabled={!game.hasDrawnThisTurn || !!game.winnerId}>
                End Turn
              </button>
            </div>
            <p>Select up to {MAX_PLAYS_PER_TURN} cards from your hand after drawing. You may only attempt one sale per turn.</p>
          </section>

          <section className="card-section">
            <div className="section-heading">
              <h2>{activePlayer.name} Hand</h2>
              <span>{selectedHandCards.length} selected</span>
            </div>
            <div className="card-grid">
              {activePlayer.hand.map((card) => (
                <button
                  key={card.id}
                  className={`card ${card.type.toLowerCase()} ${selectedHandCards.includes(card.id) ? 'selected' : ''}`}
                  onClick={() => toggleHandCard(card.id)}
                  type="button"
                >
                  <span className="card-type">{card.type}</span>
                  <strong>{card.name}</strong>
                  <span className="card-value">Value {card.value}</span>
                  <p>{card.description}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="card-section">
            <div className="section-heading">
              <h2>Dealership Area</h2>
              <span>Choose one Client and one Vehicle to sell</span>
            </div>

            <div className="area-columns">
              <AreaColumn
                title="Clients"
                cards={activeClients}
                selectable
                selectedId={selectedClientId}
                onSelect={setSelectedClientId}
              />
              <AreaColumn
                title="Vehicles"
                cards={activeVehicles}
                selectable
                selectedId={selectedVehicleId}
                onSelect={setSelectedVehicleId}
              />
              <AreaColumn title="Employees" cards={activeEmployees} />
              <AreaColumn title="Events" cards={activeEvents} />
            </div>
          </section>

          <section className="sale-panel">
            <h2>Sale Preview</h2>
            {salePreview ? (
              <div className="sale-breakdown">
                <p>Client + Vehicle: {salePreview.baseValue}</p>
                <p>Matching bonus: {salePreview.matchBonus}</p>
                <p>Employee bonuses: {salePreview.employeeBonus}</p>
                <p>Event profit this sale: {activeEventProfit}</p>
                <strong>Total sale profit: {salePreview.baseValue + salePreview.matchBonus + salePreview.employeeBonus + activeEventProfit}</strong>
              </div>
            ) : (
              <p>Select a Client and Vehicle from your area to preview the sale.</p>
            )}
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
      {cards.length === 0 ? <p className="empty-state">No cards in play.</p> : null}
      <div className="mini-card-list">
        {cards.map((card) => {
          const isSelected = selectedId === card.id;

          return (
            <button
              key={card.id}
              className={`mini-card ${card.type.toLowerCase()} ${isSelected ? 'selected' : ''}`}
              type="button"
              onClick={() => selectable && onSelect(isSelected ? '' : card.id)}
            >
              <span className="card-type">{card.type}</span>
              <strong>{card.name}</strong>
              <span>Value {card.value}</span>
              <p>{card.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default App;
