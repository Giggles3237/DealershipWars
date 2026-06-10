import Phaser from 'phaser';
import { useGame } from './store';
import { DEAL_STATUS, TEAM_CONFIG, calculateDealProfit, getDealIndicator, getDealProtection } from './rules';
import { playSound } from './audio';

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 800;

const SEATS = [
  { x: 640, y: 118 }, // Player 1 - top
  { x: 112, y: 408 }, // Player 2 - left
  { x: 640, y: 700 }, // Player 3 - bottom
  { x: 1168, y: 408 } // Player 4 - right
];

const SLOT_ROWS = {
  'team-a': { y: 308, xs: [430, 640, 850] },
  'team-b': { y: 512, xs: [430, 640, 850] }
};

const DECK_POS = { x: 262, y: 410 };
const DISCARD_POS = { x: 1018, y: 410 };

const CATEGORY_COLORS = {
  Client: 0x2e9e57,
  Vehicle: 0x2f6fb8,
  Employee: 0x8d4fc2,
  Event: 0xc2503e,
  Legendary: 0xc9a227
};

const INDICATOR_COLORS = {
  empty: 0x6b7a8c,
  safe: 0x53d983,
  pending: 0xf2c14e,
  threatened: 0xff5a4e,
  protected: 0x5aa9ff
};

const SKIN_TONES = [0xf2c9a0, 0xc68642, 0xe0ac69, 0xf8d9b0];
const HAIR_COLORS = [0x3b2b20, 0x111111, 0x8a4b22, 0x999999];
const SHIRT_COLORS = [0x2f6f4e, 0xb8503e, 0x2d5e9e, 0x7a4ba8];

export default class TableScene extends Phaser.Scene {
  constructor() {
    super('TableScene');
    this.lastFxId = 0;
    this.fxQueue = [];
    this.animating = false;
    this.avatars = [];
    this.slotViews = {};
  }

  create() {
    this.drawRoom();
    this.createCardTextures();
    this.drawTable();
    this.drawPiles();
    this.drawSlots();
    this.createAvatars();

    this.turnMarker = this.add.circle(SEATS[0].x, SEATS[0].y + 120, 12, 0xf7c76c).setDepth(5);
    this.turnGlow = this.tweens.add({
      targets: this.turnMarker,
      scale: { from: 1, to: 1.4 },
      alpha: { from: 1, to: 0.55 },
      yoyo: true,
      repeat: -1,
      duration: 600
    });

    this.syncBoard(useGame.getState());

    this.dead = false;
    this.unsubscribe = useGame.subscribe((state) => this.onStateChange(state));

    const cleanup = () => {
      this.dead = true;
      if (this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = null;
      }
    };
    this.events.once('shutdown', cleanup);
    this.events.once('destroy', cleanup);
  }

  // ---------------------------------------------------------------- visuals

  drawRoom() {
    const floor = this.add.graphics();
    floor.fillGradientStyle(0x14263d, 0x14263d, 0x0a141f, 0x0a141f, 1);
    floor.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Showroom floor tiles
    floor.lineStyle(1, 0xffffff, 0.04);
    for (let x = 0; x <= GAME_WIDTH; x += 80) {
      floor.lineBetween(x, 0, x, GAME_HEIGHT);
    }
    for (let y = 0; y <= GAME_HEIGHT; y += 80) {
      floor.lineBetween(0, y, GAME_WIDTH, y);
    }

    this.add
      .text(640, 30, 'DEALERSHIP WARS', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#f7c76c'
      })
      .setOrigin(0.5)
      .setAlpha(0.85);
  }

  drawTable() {
    const table = this.add.graphics();

    // Drop shadow
    table.fillStyle(0x000000, 0.45);
    table.fillRoundedRect(200 + 10, 190 + 14, 880, 440, 60);

    // Wood rim
    table.fillStyle(0x4a2f1b, 1);
    table.fillRoundedRect(200, 190, 880, 440, 60);

    // Felt top
    table.fillStyle(0x1d5c3e, 1);
    table.fillRoundedRect(216, 204, 848, 412, 50);
    table.fillStyle(0x227049, 0.5);
    table.fillRoundedRect(232, 218, 816, 384, 44);

    // Center line between the two dealerships
    table.lineStyle(2, 0xffffff, 0.12);
    table.lineBetween(250, 410, 1030, 410);

    this.add
      .text(640, 410, 'THE TOWER', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#ffffff'
      })
      .setOrigin(0.5)
      .setAlpha(0.18);

    TEAM_CONFIG.forEach((team) => {
      const row = SLOT_ROWS[team.id];
      const labelY = team.id === 'team-a' ? row.y - 92 : row.y + 92;

      this.add
        .text(640, labelY, `${team.name.toUpperCase()} PIPELINE`, {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '13px',
          fontStyle: 'bold',
          color: team.accent
        })
        .setOrigin(0.5)
        .setAlpha(0.8);
    });
  }

  createCardTextures() {
    const width = 70;
    const height = 96;

    Object.entries(CATEGORY_COLORS).forEach(([category, color]) => {
      const key = `card-${category.toLowerCase()}`;

      if (this.textures.exists(key)) {
        return;
      }

      const graphics = this.make.graphics({ x: 0, y: 0 }, false);
      graphics.fillStyle(0x10131a, 1);
      graphics.fillRoundedRect(0, 0, width, height, 8);
      graphics.fillStyle(color, 1);
      graphics.fillRoundedRect(0, 0, width, 22, { tl: 8, tr: 8, bl: 0, br: 0 });
      graphics.lineStyle(2, color, 1);
      graphics.strokeRoundedRect(1, 1, width - 2, height - 2, 8);
      graphics.generateTexture(key, width, height);
      graphics.destroy();
    });

    if (!this.textures.exists('card-back')) {
      const graphics = this.make.graphics({ x: 0, y: 0 }, false);
      graphics.fillStyle(0x182c47, 1);
      graphics.fillRoundedRect(0, 0, width, height, 8);
      graphics.lineStyle(2, 0xf7c76c, 0.9);
      graphics.strokeRoundedRect(3, 3, width - 6, height - 6, 7);
      graphics.lineStyle(2, 0xf7c76c, 0.35);
      graphics.strokeCircle(width / 2, height / 2, 18);
      graphics.generateTexture('card-back', width, height);
      graphics.destroy();
    }
  }

  drawPiles() {
    for (let index = 2; index >= 0; index -= 1) {
      this.add.image(DECK_POS.x - index * 2, DECK_POS.y - index * 2, 'card-back').setDepth(2);
    }

    this.deckCount = this.add
      .text(DECK_POS.x, DECK_POS.y + 64, '', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '12px',
        color: '#dce6f2'
      })
      .setOrigin(0.5)
      .setDepth(2);

    this.discardZone = this.add.rectangle(DISCARD_POS.x, DISCARD_POS.y, 74, 100).setStrokeStyle(2, 0xffffff, 0.25);
    this.discardCount = this.add
      .text(DISCARD_POS.x, DISCARD_POS.y + 64, '', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '12px',
        color: '#dce6f2'
      })
      .setOrigin(0.5)
      .setDepth(2);
  }

  drawSlots() {
    TEAM_CONFIG.forEach((team) => {
      const row = SLOT_ROWS[team.id];

      row.xs.forEach((x, slotIndex) => {
        const frame = this.add.graphics().setDepth(3);
        const label = this.add
          .text(x - 78, row.y - 62, `${team.slotPrefix}${slotIndex + 1}`, {
            fontFamily: 'Trebuchet MS, sans-serif',
            fontSize: '12px',
            fontStyle: 'bold',
            color: '#ffffff'
          })
          .setAlpha(0.5)
          .setDepth(4);
        const stack = this.add.container(x, row.y).setDepth(4);

        this.slotViews[`${team.id}-${slotIndex}`] = { x, y: row.y, frame, label, stack };
      });
    });
  }

  // ---------------------------------------------------------------- avatars

  createAvatars() {
    const state = useGame.getState();

    state.players.forEach((player, index) => {
      const seat = SEATS[index];
      const avatar = this.buildAvatar(seat.x, seat.y, index, player);
      this.avatars.push(avatar);
      this.startIdle(avatar, index);
    });
  }

  buildAvatar(x, y, index, player) {
    const container = this.add.container(x, y).setDepth(6);
    const skin = SKIN_TONES[index];
    const team = TEAM_CONFIG.find((entry) => entry.id === player.teamId);

    const torso = this.add.graphics();
    torso.fillStyle(SHIRT_COLORS[index], 1);
    torso.fillRoundedRect(-34, 22, 68, 52, 16);
    torso.fillStyle(0xffffff, 0.9);
    torso.fillTriangle(-8, 24, 8, 24, 0, 40);

    const hands = [
      this.add.circle(-40, 66, 9, skin),
      this.add.circle(40, 66, 9, skin)
    ];

    const headGroup = this.add.container(0, 0);
    const hair = this.add.ellipse(0, -14, 56, 34, HAIR_COLORS[index]);
    const head = this.add.circle(0, 0, 27, skin);
    const eyes = [
      this.add.ellipse(-10, -4, 9, 9, 0xffffff),
      this.add.ellipse(10, -4, 9, 9, 0xffffff)
    ];
    const pupils = [
      this.add.circle(-10, -4, 3, 0x111111),
      this.add.circle(10, -4, 3, 0x111111)
    ];
    const mouth = this.add.ellipse(0, 12, 16, 5, 0x7a3b2e);
    headGroup.add([hair, head, ...eyes, ...pupils, mouth]);

    const tagBackground = this.add.rectangle(0, 96, 124, 24, 0x09131f, 0.85).setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(team.accent).color, 0.9);
    const tag = this.add
      .text(0, 96, `${player.persona}`, {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#f6f3eb'
      })
      .setOrigin(0.5);

    container.add([torso, ...hands, headGroup, tagBackground, tag]);

    return { container, headGroup, eyes, pupils, mouth, hands, baseY: y, index };
  }

  startIdle(avatar, index) {
    // Blink
    this.time.addEvent({
      delay: Phaser.Math.Between(2200, 4600),
      loop: true,
      callback: () => {
        this.tweens.add({
          targets: avatar.eyes,
          scaleY: 0.12,
          duration: 70,
          yoyo: true
        });
      }
    });

    // Look around
    this.time.addEvent({
      delay: Phaser.Math.Between(3000, 6000),
      loop: true,
      callback: () => {
        const shift = Phaser.Math.Between(-3, 3);
        this.tweens.add({
          targets: avatar.pupils,
          x: `+=${shift}`,
          duration: 220,
          yoyo: true,
          hold: 500
        });
      }
    });

    // Gentle idle bob
    this.tweens.add({
      targets: avatar.headGroup,
      y: 2,
      duration: 1600 + index * 180,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  react(playerIndex, mood) {
    const avatar = this.avatars[playerIndex];

    if (!avatar) {
      return;
    }

    const { container, headGroup, eyes, mouth, hands } = avatar;

    const reset = () => {
      this.tweens.add({ targets: container, y: avatar.baseY, angle: 0, duration: 200 });
      this.tweens.add({ targets: headGroup, angle: 0, duration: 200 });
      this.tweens.add({ targets: eyes, scale: 1, duration: 200 });
      this.tweens.add({ targets: mouth, scaleX: 1, scaleY: 1, duration: 200 });
      this.tweens.add({ targets: hands[0], x: -40, y: 66, duration: 220 });
      this.tweens.add({ targets: hands[1], x: 40, y: 66, duration: 220 });
    };

    if (mood === 'happy') {
      this.tweens.add({ targets: mouth, scaleX: 1.7, scaleY: 1.6, duration: 150 });
      this.tweens.add({ targets: container, y: avatar.baseY - 8, duration: 160, yoyo: true });
      this.tweens.add({ targets: hands[1], y: 30, x: 46, duration: 180, yoyo: false }); // thumbs-up-ish
    } else if (mood === 'angry') {
      this.tweens.add({ targets: headGroup, x: { from: -5, to: 5 }, duration: 70, yoyo: true, repeat: 5, onComplete: () => (headGroup.x = 0) });
      this.tweens.add({ targets: mouth, scaleX: 0.6, scaleY: 0.6, duration: 120 });
    } else if (mood === 'surprised') {
      this.tweens.add({ targets: eyes, scale: 1.7, duration: 140 });
      this.tweens.add({ targets: mouth, scaleX: 0.7, scaleY: 2.6, duration: 140 });
    } else if (mood === 'celebrate') {
      this.tweens.add({ targets: container, y: avatar.baseY - 18, duration: 180, yoyo: true, repeat: 2 });
      this.tweens.add({ targets: hands[0], x: -46, y: -8, duration: 180 });
      this.tweens.add({ targets: hands[1], x: 46, y: -8, duration: 180 });
      this.tweens.add({ targets: mouth, scaleX: 1.8, scaleY: 2, duration: 160 });
    } else if (mood === 'defeated') {
      this.tweens.add({ targets: hands[1], x: 6, y: -4, duration: 240 });
      this.tweens.add({ targets: headGroup, angle: 9, duration: 240 });
      this.tweens.add({ targets: mouth, scaleX: 0.7, scaleY: 0.6, duration: 200 });
    }

    this.time.delayedCall(1500, reset);
  }

  reactTeam(teamId, mood) {
    const state = useGame.getState();
    state.players.forEach((player, index) => {
      if (player.teamId === teamId) {
        this.react(index, mood);
      }
    });
  }

  speechBubble(playerIndex, text, holdMs = 1600) {
    const seat = SEATS[playerIndex];
    const above = seat.y > 400 ? -1 : 1;
    const bubbleY = seat.y + (above < 0 ? -84 : 96) - (above < 0 ? 30 : -30);
    const container = this.add.container(seat.x, bubbleY).setDepth(80).setScale(0);

    const textObject = this.add
      .text(0, 0, text, {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#09131f',
        align: 'center',
        wordWrap: { width: 220 }
      })
      .setOrigin(0.5);

    const padding = 14;
    const background = this.add.graphics();
    background.fillStyle(0xffffff, 1);
    background.fillRoundedRect(
      -textObject.width / 2 - padding,
      -textObject.height / 2 - padding,
      textObject.width + padding * 2,
      textObject.height + padding * 2,
      12
    );
    background.fillTriangle(-8, textObject.height / 2 + padding, 8, textObject.height / 2 + padding, 0, textObject.height / 2 + padding + 12);

    container.add([background, textObject]);

    this.tweens.add({ targets: container, scale: 1, duration: 180, ease: 'Back.easeOut' });
    this.time.delayedCall(holdMs, () => {
      this.tweens.add({ targets: container, scale: 0, alpha: 0, duration: 160, onComplete: () => container.destroy() });
    });
  }

  // ---------------------------------------------------------------- board sync

  onStateChange(state) {
    // Never let a stale scene break the store's listener chain.
    if (this.dead || !this.sys || !this.sys.displayList) {
      return;
    }

    const incoming = state.fx.filter((entry) => entry.id > this.lastFxId);

    if (state.fx.length && state.fx[state.fx.length - 1].id < this.lastFxId) {
      // New game started; fx ids reset.
      this.lastFxId = 0;
      this.fxQueue = [];
      this.syncBoard(state);
      return;
    }

    if (incoming.length) {
      this.lastFxId = incoming[incoming.length - 1].id;
      this.fxQueue.push(...incoming);
      this.processQueue();
    } else if (!this.animating) {
      this.syncBoard(state);
    }
  }

  processQueue() {
    if (this.animating || !this.fxQueue.length) {
      return;
    }

    this.animating = true;
    const fx = this.fxQueue.shift();

    const done = () => {
      this.animating = false;
      this.syncBoard(useGame.getState());
      this.processQueue();
    };

    try {
      this.handleFx(fx, done);
    } catch {
      done();
    }
  }

  syncBoard(state) {
    if (!this.slotViews || !Object.keys(this.slotViews).length) {
      return;
    }

    this.deckCount.setText(`Deck ${state.deck.length}`);
    this.discardCount.setText(`Discard ${state.discard.length}`);

    const seat = SEATS[state.activePlayerIndex];
    this.turnMarker.setPosition(seat.x, seat.y + (seat.y > 400 ? -130 : 130));

    state.teams.forEach((team) => {
      team.slots.forEach((deal, slotIndex) => {
        this.renderSlot(team, deal, slotIndex);
      });
    });
  }

  renderSlot(team, deal, slotIndex) {
    const view = this.slotViews[`${team.id}-${slotIndex}`];
    const indicator = getDealIndicator(deal);
    const color = INDICATOR_COLORS[indicator];

    view.frame.clear();
    view.frame.lineStyle(deal ? 3 : 2, color, deal ? 0.95 : 0.4);
    view.frame.strokeRoundedRect(view.x - 86, view.y - 66, 172, 132, 14);

    if (deal) {
      view.frame.fillStyle(color, 0.08);
      view.frame.fillRoundedRect(view.x - 86, view.y - 66, 172, 132, 14);
    }

    view.stack.removeAll(true);

    if (!deal) {
      const hint = this.add
        .text(0, 0, 'OPEN\nDESK', {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '12px',
          align: 'center',
          color: '#ffffff'
        })
        .setOrigin(0.5)
        .setAlpha(0.22);
      view.stack.add(hint);
      return;
    }

    const miniCard = (card, x, y, angle) => {
      const image = this.add.image(x, y, `card-${card.category.toLowerCase()}`).setScale(0.62).setAngle(angle);
      const name = this.add
        .text(x, y + 4, card.name, {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '9px',
          align: 'center',
          color: '#f6f3eb',
          wordWrap: { width: 40 }
        })
        .setOrigin(0.5)
        .setAngle(angle);
      view.stack.add([image, name]);
    };

    if (deal.client) {
      miniCard(deal.client, -46, -18, -5);
    }
    if (deal.vehicle) {
      miniCard(deal.vehicle, 0, -18, 0);
    }
    if (deal.employee) {
      miniCard(deal.employee, 46, -18, 5);
    }

    deal.events.forEach((card, index) => {
      const chip = this.add
        .text(-70 + index * 46, 28, card.name.split(' ')[0], {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '8px',
          color: '#ffd9d3',
          backgroundColor: '#5a221a',
          padding: { x: 3, y: 2 }
        })
        .setOrigin(0, 0.5);
      view.stack.add(chip);
    });

    const profit = calculateDealProfit(deal);
    const statusText = deal.status === DEAL_STATUS.PENDING ? 'PENDING DELIVERY' : 'BUILDING';
    const status = this.add
      .text(0, 50, `${statusText}${profit ? `  ·  $${profit.total}` : ''}`, {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: indicator === 'pending' ? '#f2c14e' : indicator === 'protected' ? '#8ec5ff' : '#bdf2cf'
      })
      .setOrigin(0.5);
    view.stack.add(status);

    if (getDealProtection(deal).any) {
      const shield = this.add
        .text(74, -54, '🛡️', { fontSize: '16px' })
        .setOrigin(0.5);
      view.stack.add(shield);
    }
  }

  // ---------------------------------------------------------------- fx handlers

  slotPosition(teamId, slotIndex) {
    const row = SLOT_ROWS[teamId];
    return { x: row.xs[slotIndex], y: row.y };
  }

  makeFlyingCard(category, name) {
    const container = this.add.container(0, 0).setDepth(40);
    const image = this.add.image(0, 0, `card-${(category || 'event').toLowerCase()}`);
    container.add(image);

    if (name) {
      const text = this.add
        .text(0, 6, name, {
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '10px',
          align: 'center',
          color: '#f6f3eb',
          wordWrap: { width: 60 }
        })
        .setOrigin(0.5);
      container.add(text);
    }

    return container;
  }

  floatText(x, y, message, color = '#53d983', size = 26) {
    const text = this.add
      .text(x, y, message, {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: `${size}px`,
        fontStyle: 'bold',
        color,
        stroke: '#09131f',
        strokeThickness: 5
      })
      .setOrigin(0.5)
      .setDepth(60);

    this.tweens.add({
      targets: text,
      y: y - 56,
      alpha: 0,
      duration: 1400,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy()
    });
  }

  handleFx(fx, done) {
    switch (fx.type) {
      case 'turn': {
        const seat = SEATS[fx.playerIndex];
        this.turnMarker.setPosition(seat.x, seat.y + (seat.y > 400 ? -130 : 130));
        done();
        break;
      }

      case 'draw': {
        playSound('cardDraw');
        const seat = SEATS[fx.playerIndex];
        const card = this.add.image(DECK_POS.x, DECK_POS.y, 'card-back').setDepth(40);
        this.tweens.add({
          targets: card,
          x: seat.x,
          y: seat.y,
          scale: 0.5,
          alpha: 0.2,
          angle: 180,
          duration: 320,
          ease: 'Cubic.easeOut',
          onComplete: () => {
            card.destroy();
            done();
          }
        });
        break;
      }

      case 'playToSlot': {
        playSound('cardPlay');
        const seat = SEATS[fx.playerIndex];
        const target = this.slotPosition(fx.teamId, fx.slotIndex);
        const card = this.makeFlyingCard(fx.card.category, fx.card.name);
        card.setPosition(seat.x, seat.y).setScale(0.4);
        this.tweens.add({
          targets: card,
          x: target.x,
          y: target.y,
          scale: 1,
          angle: Phaser.Math.Between(-8, 8),
          duration: 420,
          ease: 'Cubic.easeOut',
          onComplete: () => {
            this.tweens.add({
              targets: card,
              scale: 0.62,
              duration: 130,
              onComplete: () => {
                card.destroy();
                done();
              }
            });
          }
        });
        break;
      }

      case 'attach': {
        playSound('attach');
        const target = this.slotPosition(fx.teamId, fx.slotIndex);
        const card = this.makeFlyingCard('Event', fx.cardName);
        const seat = SEATS[useGame.getState().activePlayerIndex];
        card.setPosition(seat.x, seat.y).setScale(0.4);
        this.tweens.add({
          targets: card,
          x: target.x,
          y: target.y + 24,
          scale: 0.7,
          duration: 360,
          ease: 'Back.easeOut',
          onComplete: () => {
            card.destroy();
            done();
          }
        });
        break;
      }

      case 'status': {
        if (fx.status === DEAL_STATUS.PENDING) {
          const target = this.slotPosition(fx.teamId, fx.slotIndex);
          this.floatText(target.x, target.y - 70, 'PENDING!', '#f2c14e', 20);
          this.reactTeam(fx.teamId, 'happy');
        }
        done();
        break;
      }

      case 'deliver': {
        playSound('cashRegister');
        playSound('chime');
        const target = this.slotPosition(fx.teamId, fx.slotIndex);
        const flash = this.add.circle(target.x, target.y, 12, 0x53d983, 0.7).setDepth(45);
        this.floatText(target.x, target.y - 30, `+${fx.profit} PROFIT`, '#53d983', 30);
        this.floatText(target.x, target.y + 8, 'DELIVERED!', '#ffffff', 16);
        this.reactTeam(fx.teamId, 'celebrate');
        playSound('cheer');

        this.tweens.add({
          targets: flash,
          radius: 110,
          alpha: 0,
          duration: 550,
          onComplete: () => flash.destroy()
        });

        const ghostStack = this.makeFlyingCard('Client', fx.dealName);
        ghostStack.setPosition(target.x, target.y);
        this.tweens.add({
          targets: ghostStack,
          x: DISCARD_POS.x,
          y: DISCARD_POS.y,
          scale: 0.6,
          angle: 200,
          alpha: 0.4,
          duration: 480,
          delay: 280,
          onComplete: () => {
            ghostStack.destroy();
            done();
          }
        });
        break;
      }

      case 'destroy': {
        playSound('ghost');
        const target = this.slotPosition(fx.teamId, fx.slotIndex);
        const ghost = this.makeFlyingCard('Client', fx.dealName);
        ghost.setPosition(target.x, target.y - 18);
        this.floatText(target.x, target.y - 70, 'DEAL LOST', '#ff5a4e', 20);
        this.reactTeam(fx.teamId, 'defeated');
        playSound('groan');

        this.tweens.add({
          targets: ghost,
          y: target.y - 90,
          alpha: 0,
          scale: 1.2,
          duration: 900,
          ease: 'Sine.easeOut',
          onComplete: () => {
            ghost.destroy();
            done();
          }
        });
        break;
      }

      case 'employeeQuits': {
        playSound('groan');
        const target = this.slotPosition(fx.teamId, fx.slotIndex);
        const walker = this.add.container(target.x + 46, target.y - 18).setDepth(45);
        const body = this.add.image(0, 0, 'card-employee').setScale(0.5);
        const box = this.add.rectangle(0, 26, 26, 18, 0xa57a3c).setStrokeStyle(2, 0x6e4f24);
        walker.add([body, box]);
        this.reactTeam(fx.teamId, 'angry');

        const exitX = target.y < 410 ? 1240 : 40;
        this.tweens.add({
          targets: walker,
          x: exitX,
          duration: 1100,
          ease: 'Sine.easeIn',
          onComplete: () => {
            walker.destroy();
            done();
          }
        });
        this.tweens.add({ targets: walker, y: '-=6', duration: 140, yoyo: true, repeat: 7 });
        break;
      }

      case 'steal': {
        playSound('cardPlay');
        const from = this.slotPosition(fx.fromTeamId, fx.fromSlot);
        const to = fx.toSlot >= 0 ? this.slotPosition(fx.toTeamId, fx.toSlot) : SEATS[useGame.getState().activePlayerIndex];
        const card = this.makeFlyingCard('Client', fx.cardName);
        card.setPosition(from.x - 46, from.y - 18).setScale(0.62);
        this.floatText(from.x, from.y - 70, 'ANOTHER DEALER CALLED', '#ff9d57', 14);
        this.reactTeam(fx.fromTeamId, 'angry');
        this.reactTeam(fx.toTeamId, 'happy');

        this.tweens.add({
          targets: card,
          x: to.x,
          y: to.y,
          duration: 1300,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            card.destroy();
            done();
          }
        });
        this.tweens.add({ targets: card, angle: { from: -5, to: 5 }, duration: 160, yoyo: true, repeat: 7 });
        break;
      }

      case 'badSurvey': {
        playSound('groan');
        const row = SLOT_ROWS[fx.teamId];
        const review = this.add
          .text(640, row.y, '★ ☆ ☆ ☆ ☆', {
            fontFamily: 'Trebuchet MS, sans-serif',
            fontSize: '54px',
            fontStyle: 'bold',
            color: '#ff5a4e',
            stroke: '#09131f',
            strokeThickness: 8
          })
          .setOrigin(0.5)
          .setDepth(60)
          .setScale(0);
        this.reactTeam(fx.teamId, 'angry');
        this.floatText(640, row.y + 54, '-5 PROFIT', '#ff5a4e', 22);

        this.tweens.add({
          targets: review,
          scale: 1,
          duration: 260,
          ease: 'Back.easeOut',
          onComplete: () => {
            this.tweens.add({
              targets: review,
              alpha: 0,
              duration: 700,
              delay: 700,
              onComplete: () => {
                review.destroy();
                done();
              }
            });
          }
        });
        break;
      }

      case 'chargeback': {
        playSound('groan');
        const row = SLOT_ROWS[fx.teamId];
        this.reactTeam(fx.teamId, 'defeated');
        this.floatText(640, row.y, `CHARGEBACK  -${fx.amount}`, '#ff5a4e', 24);

        for (let index = 0; index < 6; index += 1) {
          const bill = this.add
            .text(620 + Phaser.Math.Between(-60, 60), row.y + Phaser.Math.Between(-20, 20), '$', {
              fontSize: '24px',
              fontStyle: 'bold',
              color: '#53d983'
            })
            .setDepth(60);
          this.tweens.add({
            targets: bill,
            x: bill.x - 360,
            y: bill.y - Phaser.Math.Between(10, 60),
            alpha: 0,
            angle: -200,
            duration: 900,
            delay: index * 70,
            onComplete: () => bill.destroy()
          });
        }

        this.time.delayedCall(1000, done);
        break;
      }

      case 'recall': {
        playSound('alarm');
        const row = SLOT_ROWS[fx.teamId];
        this.reactTeam(fx.teamId, 'surprised');

        row.xs.forEach((x, index) => {
          const warning = this.add
            .text(x, row.y - 30, '⚠ RECALL', {
              fontFamily: 'Trebuchet MS, sans-serif',
              fontSize: '16px',
              fontStyle: 'bold',
              color: '#f2c14e',
              stroke: '#09131f',
              strokeThickness: 4
            })
            .setOrigin(0.5)
            .setDepth(60)
            .setScale(0);
          this.tweens.add({
            targets: warning,
            scale: 1,
            duration: 200,
            delay: index * 120,
            ease: 'Back.easeOut',
            onComplete: () => {
              this.tweens.add({ targets: warning, alpha: 0, y: warning.y - 30, duration: 600, delay: 500, onComplete: () => warning.destroy() });
            }
          });
        });

        this.time.delayedCall(1200, done);
        break;
      }

      case 'blocked': {
        playSound('attach');
        const target = this.slotPosition(fx.teamId, fx.slotIndex);
        const shield = this.add
          .text(target.x, target.y - 10, '🛡️', { fontSize: '46px' })
          .setOrigin(0.5)
          .setDepth(60)
          .setScale(0);
        this.floatText(target.x, target.y - 70, 'PROTECTED!', '#5aa9ff', 20);
        this.reactTeam(fx.teamId, 'happy');

        this.tweens.add({
          targets: shield,
          scale: 1.2,
          duration: 220,
          ease: 'Back.easeOut',
          onComplete: () => {
            this.tweens.add({
              targets: shield,
              alpha: 0,
              duration: 400,
              delay: 500,
              onComplete: () => {
                shield.destroy();
                done();
              }
            });
          }
        });
        break;
      }

      case 'profit': {
        const row = SLOT_ROWS[fx.teamId];
        playSound('cashRegister');
        this.floatText(640, row.y - 40, `+${fx.amount}`, '#53d983', 24);
        this.time.delayedCall(350, done);
        break;
      }

      case 'eventPlayed': {
        done();
        break;
      }

      case 'dealerPrincipal': {
        playSound('slam');
        this.cameras.main.shake(420, 0.012);
        const seat = SEATS[fx.playerIndex];

        const overlay = this.add.rectangle(640, 400, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0).setDepth(70);
        this.tweens.add({ targets: overlay, fillAlpha: 0.62, duration: 300 });

        const spotlight = this.add.circle(seat.x, seat.y, 150, 0xfff3c4, 0).setDepth(71).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: spotlight, fillAlpha: 0.22, duration: 350, delay: 200 });

        const avatar = this.avatars[fx.playerIndex];
        const previousDepth = avatar.container.depth;
        avatar.container.setDepth(75);
        this.react(fx.playerIndex, 'happy');

        this.time.delayedCall(650, () => {
          this.speechBubble(fx.playerIndex, "I've made my decision.", 1700);
        });

        this.time.delayedCall(2400, () => {
          this.tweens.add({
            targets: [overlay, spotlight],
            alpha: 0,
            duration: 350,
            onComplete: () => {
              overlay.destroy();
              spotlight.destroy();
              avatar.container.setDepth(previousDepth);
              done();
            }
          });
        });
        break;
      }

      case 'audit': {
        playSound('alarm');
        playSound('papers');
        this.cameras.main.flash(180, 255, 255, 255);

        for (let index = 0; index < 14; index += 1) {
          const paper = this.add
            .rectangle(Phaser.Math.Between(220, 1060), -40, 26, 34, 0xffffff)
            .setStrokeStyle(1, 0x9bb0c9)
            .setDepth(72)
            .setAngle(Phaser.Math.Between(-40, 40));
          this.tweens.add({
            targets: paper,
            y: Phaser.Math.Between(240, 620),
            angle: paper.angle + Phaser.Math.Between(-180, 180),
            duration: Phaser.Math.Between(700, 1300),
            delay: index * 60,
            ease: 'Sine.easeIn',
            onComplete: () => {
              this.tweens.add({ targets: paper, alpha: 0, duration: 500, delay: 600, onComplete: () => paper.destroy() });
            }
          });
        }

        this.time.delayedCall(500, () => {
          this.speechBubble(fx.playerIndex, 'We have concerns.', 1700);
          this.react(fx.playerIndex, 'angry');
        });

        this.time.delayedCall(2600, done);
        break;
      }

      case 'win': {
        playSound('cheer');
        playSound('chime');
        this.reactTeam(fx.teamId, 'celebrate');

        for (let index = 0; index < 60; index += 1) {
          const confetti = this.add
            .rectangle(
              Phaser.Math.Between(100, 1180),
              -20,
              8,
              14,
              Phaser.Display.Color.RandomRGB().color
            )
            .setDepth(90)
            .setAngle(Phaser.Math.Between(0, 180));
          this.tweens.add({
            targets: confetti,
            y: GAME_HEIGHT + 40,
            angle: confetti.angle + Phaser.Math.Between(-360, 360),
            duration: Phaser.Math.Between(1600, 3000),
            delay: index * 30,
            ease: 'Sine.easeIn',
            onComplete: () => confetti.destroy()
          });
        }

        this.time.delayedCall(1500, done);
        break;
      }

      default:
        done();
    }
  }
}
