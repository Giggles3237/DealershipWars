import clientArt from '../assets/cards/client-art.svg';
import vehicleArt from '../assets/cards/vehicle-art.svg';
import employeeArt from '../assets/cards/employee-art.svg';
import eventArt from '../assets/cards/event-art.svg';
import clientTexture from '../assets/cards/client-texture.svg';
import vehicleTexture from '../assets/cards/vehicle-texture.svg';
import employeeTexture from '../assets/cards/employee-texture.svg';
import eventTexture from '../assets/cards/event-texture.svg';
import { getCardRarity } from '../game/rules';

const TYPE_ICONS = {
  Client: '$',
  Vehicle: 'V',
  Employee: 'E',
  Event: '!',
  Legendary: '★'
};

const TYPE_KICKERS = {
  Client: 'Buyer Lead',
  Vehicle: 'Inventory',
  Employee: 'Staff',
  Event: 'Market Shift',
  Legendary: 'Legendary'
};

const TYPE_ART = {
  Client: clientArt,
  Vehicle: vehicleArt,
  Employee: employeeArt,
  Event: eventArt,
  Legendary: eventArt
};

const TYPE_TEXTURE = {
  Client: clientTexture,
  Vehicle: vehicleTexture,
  Employee: employeeTexture,
  Event: eventTexture,
  Legendary: eventTexture
};

function GameCard({ card, selected = false, compact = false, onClick = null, onHover = null }) {
  const clickable = typeof onClick === 'function';
  const className = `game-card ${card.category.toLowerCase()} ${compact ? 'compact' : 'full'} ${selected ? 'selected' : ''} ${
    clickable ? 'clickable' : ''
  }`;
  const cardStyle = {
    '--card-texture': `url(${TYPE_TEXTURE[card.category]})`,
    '--card-art-image': `url(${TYPE_ART[card.category]})`
  };

  return (
    <button
      className={className}
      onClick={onClick || undefined}
      onMouseEnter={onHover ? () => onHover(card) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
      type="button"
      disabled={!clickable}
      style={cardStyle}
    >
      <span className="card-noise" aria-hidden="true" />
      <span className="card-shine" aria-hidden="true" />
      <div className="card-header">
        <span className="card-brand">Dealership Wars</span>
        <span className="card-chip">{card.category}</span>
      </div>

      {!compact ? (
        <div className="card-art">
          <div className="card-art-panel" aria-hidden="true">
            <span className="card-icon">{TYPE_ICONS[card.category] || '?'}</span>
          </div>
          <span className="card-watermark">{TYPE_KICKERS[card.category]}</span>
        </div>
      ) : null}

      <div className="card-copy">
        <p className="card-kicker">{TYPE_KICKERS[card.category]}</p>
        <h3 className="card-name">{card.name}</h3>
        {!compact ? <p className="card-description">{card.description}</p> : null}
      </div>

      <div className="card-effect-box">
        <span className="card-effect-label">{compact ? 'Effect' : 'Flavor'}</span>
        <p>{compact ? card.description : card.flavor}</p>
      </div>

      <div className="card-footer">
        <span className="card-power">Value {card.valueLabel || card.value}</span>
        <span className="card-rarity">{getCardRarity(card)}</span>
      </div>
    </button>
  );
}

export default GameCard;
