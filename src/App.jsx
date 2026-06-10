import { useMemo, useState } from 'react';
import PhaserGame from './game/PhaserGame';
import GameCard from './components/GameCard';
import { useGame, getCardTargets, canPlayAnything } from './game/store';
import { unlockAudio } from './game/audio';

function Scoreboard() {
  const teams = useGame((state) => state.teams);
  const deckCount = useGame((state) => state.deck.length);
  const turnNumber = useGame((state) => state.turnNumber);
  const players = useGame((state) => state.players);
  const activePlayerIndex = useGame((state) => state.activePlayerIndex);

  return (
    <header className="hud-scoreboard">
      {teams.map((team) => (
        <div key={team.id} className="score-team" style={{ '--team-accent': team.accent }}>
          <span className="score-name">{team.name}</span>
          <span className="score-profit">${team.profit}</span>
          <span className="score-detail">
            {team.deliveredCount} delivered · {team.slots.filter(Boolean).length} active
          </span>
        </div>
      ))}
      <div className="score-meta">
        <span>Turn {turnNumber}</span>
        <span>{players[activePlayerIndex].name} up</span>
        <span>Deck {deckCount}</span>
      </div>
    </header>
  );
}

function LogTicker() {
  const log = useGame((state) => state.log);

  return (
    <div className="hud-log">
      {log.slice(-3).map((entry, index) => (
        <p key={`${index}-${entry}`} className={index === log.slice(-3).length - 1 ? 'log-latest' : ''}>
          {entry}
        </p>
      ))}
    </div>
  );
}

function TitleScreen() {
  const startGame = useGame((state) => state.startGame);

  return (
    <div className="overlay title-screen">
      <p className="eyebrow">A 4-Player Team Card Battle</p>
      <h1>Dealership Wars</h1>
      <p className="title-copy">
        Two dealerships. One market. Build deals from Clients, Vehicles, and Employees, protect them from sabotage, and
        deliver them for profit. First team to <strong>$100 profit</strong> closes the month on top.
      </p>
      <ul className="title-rules">
        <li>Teams of two sit across the table and share a 3-slot deal pipeline.</li>
        <li>On your turn: draw 1 card, play 1 card, pass clockwise.</li>
        <li>A deal with a Client, Vehicle, and Employee goes Pending — it delivers if it survives one rotation.</li>
        <li>Sabotage the other store, protect your own, and save the Dealer Principal for the perfect moment.</li>
      </ul>
      <button
        className="primary-button"
        onClick={() => {
          unlockAudio();
          startGame();
        }}
      >
        Open the Store
      </button>
    </div>
  );
}

function PassScreen() {
  const players = useGame((state) => state.players);
  const activePlayerIndex = useGame((state) => state.activePlayerIndex);
  const teams = useGame((state) => state.teams);
  const revealTurn = useGame((state) => state.revealTurn);
  const player = players[activePlayerIndex];
  const team = teams.find((entry) => entry.id === player.teamId);

  return (
    <div className="overlay pass-screen">
      <p className="eyebrow" style={{ color: team.accent }}>
        {team.name}
      </p>
      <h2>
        Pass the device to {player.name} <span className="persona">({player.persona})</span>
      </h2>
      <p>Hands stay private. Trash talk stays public.</p>
      <button
        className="primary-button"
        onClick={() => {
          unlockAudio();
          revealTurn();
        }}
      >
        Reveal My Hand
      </button>
    </div>
  );
}

function ReactionOverlay() {
  const reaction = useGame((state) => state.reaction);
  const teams = useGame((state) => state.teams);
  const players = useGame((state) => state.players);
  const respondWithAudit = useGame((state) => state.respondWithAudit);
  const allowDealerPrincipal = useGame((state) => state.allowDealerPrincipal);

  if (!reaction) {
    return null;
  }

  const respondingTeam = teams.find((team) => team.id === reaction.respondingTeamId);
  const slammer = players[reaction.playerIndex];

  return (
    <div className="overlay reaction-screen">
      <p className="eyebrow" style={{ color: respondingTeam.accent }}>
        {respondingTeam.name} — RESPOND NOW
      </p>
      <h2>{slammer.name} slammed the Dealer Principal!</h2>
      <p>
        “I've made my decision.” The chosen deal is about to deliver instantly. If anyone on {respondingTeam.name} is
        holding a <strong>Manufacturer Audit</strong>, this is the moment.
      </p>
      <div className="reaction-buttons">
        <button className="primary-button" onClick={respondWithAudit}>
          Slam the Manufacturer Audit
        </button>
        <button className="secondary-button" onClick={allowDealerPrincipal}>
          Let it happen
        </button>
      </div>
      <p className="reaction-hint">No Audit in hand? Bluffing is legal. Lying to your teammate is not. (It is.)</p>
    </div>
  );
}

function GameOverOverlay() {
  const winnerTeamId = useGame((state) => state.winnerTeamId);
  const teams = useGame((state) => state.teams);
  const startGame = useGame((state) => state.startGame);
  const winner = teams.find((team) => team.id === winnerTeamId);

  return (
    <div className="overlay gameover-screen">
      {winner ? (
        <>
          <p className="eyebrow" style={{ color: winner.accent }}>
            STORE OF THE MONTH
          </p>
          <h2>{winner.name} wins with ${winner.profit} profit!</h2>
        </>
      ) : (
        <h2>It's a tie. Both GMs claim victory in their ads.</h2>
      )}
      <div className="final-scores">
        {teams.map((team) => (
          <span key={team.id} style={{ '--team-accent': team.accent }}>
            {team.name}: ${team.profit} · {team.deliveredCount} deals delivered
          </span>
        ))}
      </div>
      <button className="primary-button" onClick={startGame}>
        Rematch
      </button>
    </div>
  );
}

function TurnHud() {
  const game = useGame();
  const [selectedCardId, setSelectedCardId] = useState('');
  const [hoverCard, setHoverCard] = useState(null);

  const player = game.players[game.activePlayerIndex];
  const selectedCard = player.hand.find((card) => card.id === selectedCardId) || null;
  const canAct = game.hasDrawn && !game.hasPlayed;

  const targets = useMemo(
    () => (selectedCard && canAct ? getCardTargets(game, game.activePlayerIndex, selectedCard) : []),
    [game, selectedCard, canAct]
  );

  const mustDraw = !game.hasDrawn;
  const stuck = game.hasDrawn && !game.hasPlayed && !canPlayAnything(game, game.activePlayerIndex);
  const canEnd = game.hasDrawn && (game.hasPlayed || stuck);
  const previewCard = hoverCard || selectedCard;

  function playTo(target) {
    if (!selectedCard) {
      return;
    }

    if (['Client', 'Vehicle', 'Employee'].includes(selectedCard.category)) {
      game.playCardToSlot(selectedCard.id, target.slotIndex);
    } else {
      game.playEvent(selectedCard.id, target.type === 'auto' ? null : { teamId: target.teamId, slotIndex: target.slotIndex });
    }

    setSelectedCardId('');
    setHoverCard(null);
  }

  return (
    <>
      <div className="hud-bottom">
        <div className="hud-actions">
          {mustDraw ? (
            <button className="primary-button" onClick={game.drawCard}>
              Draw 1 Card
            </button>
          ) : null}
          {!mustDraw && !game.hasPlayed && !selectedCard ? (
            <span className="action-hint">{stuck ? 'No playable cards. End your turn.' : 'Pick a card from your hand.'}</span>
          ) : null}
          {selectedCard && canAct ? (
            <div className="target-panel">
              <span className="target-title">{selectedCard.name}:</span>
              {targets.length ? (
                targets.map((target, index) => (
                  <button key={index} className="secondary-button target-button" onClick={() => playTo(target)}>
                    {target.label}
                  </button>
                ))
              ) : (
                <span className="action-hint">
                  {selectedCard.effect === 'manufacturerAudit'
                    ? 'Only playable in response to a Dealer Principal.'
                    : 'No valid target right now.'}
                </span>
              )}
              <button className="secondary-button" onClick={() => setSelectedCardId('')}>
                Cancel
              </button>
            </div>
          ) : null}
          <button className="secondary-button end-turn" onClick={game.endTurn} disabled={!canEnd}>
            End Turn
          </button>
        </div>

        <div className="hud-hand">
          {player.hand.map((card) => (
            <GameCard
              key={card.id}
              card={card}
              compact
              selected={selectedCardId === card.id}
              onClick={() => setSelectedCardId(selectedCardId === card.id ? '' : card.id)}
              onHover={setHoverCard}
            />
          ))}
          {!player.hand.length ? <p className="empty-hand">Empty hand. The struggle is real.</p> : null}
        </div>
      </div>

      {previewCard ? (
        <div className="hover-preview">
          <GameCard card={previewCard} />
        </div>
      ) : null}
    </>
  );
}

function InspectOverlay() {
  const card = useGame((state) => state.inspectedCard);
  const clearInspected = useGame((state) => state.clearInspected);

  if (!card) {
    return null;
  }

  return (
    <div className="inspect-overlay" onClick={clearInspected}>
      <div className="inspect-card">
        <GameCard card={card} />
      </div>
      <p className="inspect-hint">Tap anywhere to close</p>
    </div>
  );
}

function App() {
  const phase = useGame((state) => state.phase);
  const reaction = useGame((state) => state.reaction);

  return (
    <div className="game-stage">
      <PhaserGame />

      <div className="hud-layer">
        {phase !== 'title' ? <Scoreboard /> : null}
        {phase !== 'title' ? <LogTicker /> : null}

        {phase === 'title' ? <TitleScreen /> : null}
        {phase === 'pass' ? <PassScreen /> : null}
        {phase === 'turn' && !reaction ? <TurnHud /> : null}
        {reaction ? <ReactionOverlay /> : null}
        {phase === 'gameover' ? <GameOverOverlay /> : null}
        <InspectOverlay />
      </div>
    </div>
  );
}

export default App;
