// Redis-backed distributed game state
const { v4: uuidv4 } = require('uuid');
const { createDeck, shuffleDeck, canPlay, calcScore } = require('./gameLogic');

class GameStateManager {
  constructor(redis) {
    this.redis = redis;
  }

  async createRoom(hostId, hostName) {
    const roomId = uuidv4().substring(0, 6).toUpperCase();
    const room = {
      id: roomId,
      hostId,
      status: 'waiting',
      players: JSON.stringify([{ id: hostId, name: hostName, hand: [], score: 0, connected: true }]),
      deck: JSON.stringify([]),
      discardPile: JSON.stringify([]),
      currentPlayerIndex: 0,
      direction: 1,
      currentColor: null,
      drawCount: 0,
      createdAt: Date.now()
    };
    await this.redis.hmset(`room:${roomId}`, room);
    await this.redis.expire(`room:${roomId}`, 3600);
    return roomId;
  }

  async getRoom(roomId) {
    const data = await this.redis.hgetall(`room:${roomId}`);
    if (!data || !data.id) return null;
    return {
      ...data,
      players: JSON.parse(data.players),
      deck: JSON.parse(data.deck),
      discardPile: JSON.parse(data.discardPile),
      currentPlayerIndex: parseInt(data.currentPlayerIndex),
      direction: parseInt(data.direction),
      drawCount: parseInt(data.drawCount) || 0
    };
  }

  async saveRoom(room) {
    const toSave = {
      ...room,
      players: JSON.stringify(room.players),
      deck: JSON.stringify(room.deck),
      discardPile: JSON.stringify(room.discardPile)
    };
    await this.redis.hmset(`room:${room.id}`, toSave);
    await this.redis.expire(`room:${room.id}`, 3600);
  }

  async joinRoom(roomId, playerId, playerName) {
    const room = await this.getRoom(roomId);
    if (!room) return { error: 'Room not found' };
    if (room.status !== 'waiting') return { error: 'Game already started' };
    if (room.players.length >= 4) return { error: 'Room is full (max 4 players)' };
    const existing = room.players.find(p => p.id === playerId);
    if (!existing) {
      room.players.push({ id: playerId, name: playerName, hand: [], score: 0, connected: true });
      await this.saveRoom(room);
    }
    return { success: true, room };
  }

  async startGame(roomId) {
    const room = await this.getRoom(roomId);
    if (!room) return { error: 'Room not found' };
    if (room.players.length < 2) return { error: 'Need at least 2 players' };

    let deck = shuffleDeck(createDeck());

    for (const player of room.players) {
      player.hand = deck.splice(0, 7);
    }

    // First card (non-wild, non-action to keep start simple)
    let firstCard;
    do {
      firstCard = deck.shift();
      if (firstCard.color === 'wild' || ['skip','reverse','draw2'].includes(firstCard.value)) {
        deck.push(firstCard);
      } else {
        break;
      }
    } while (true);

    room.deck = deck;
    room.discardPile = [firstCard];
    room.currentColor = firstCard.color;
    room.status = 'playing';
    room.currentPlayerIndex = 0;
    room.direction = 1;
    room.drawCount = 0;

    await this.saveRoom(room);
    return { success: true, room };
  }

  async playCard(roomId, playerId, cardId, chosenColor) {
    const room = await this.getRoom(roomId);
    if (!room) return { error: 'Room not found' };
    if (room.status !== 'playing') return { error: 'Game not in progress' };

    const playerIndex = room.players.findIndex(p => p.id === playerId);
    if (playerIndex !== room.currentPlayerIndex) return { error: 'Not your turn' };

    const player = room.players[playerIndex];
    const cardIndex = player.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return { error: 'Card not in hand' };

    const card = player.hand[cardIndex];
    const topCard = room.discardPile[room.discardPile.length - 1];

    if (!canPlay(card, topCard, room.currentColor)) {
      return { error: 'Cannot play this card' };
    }

    player.hand.splice(cardIndex, 1);
    room.discardPile.push(card);

    let skipNext = false;
    let message = `${player.name} played ${card.color} ${card.value}`;

    if (card.value === 'wild' || card.value === 'wild_draw4') {
      room.currentColor = chosenColor || 'red';
      message = `${player.name} played Wild! Color is now ${room.currentColor}`;
    } else {
      room.currentColor = card.color;
    }

    if (card.value === 'reverse') {
      room.direction *= -1;
      if (room.players.length === 2) skipNext = true;
      message = `${player.name} reversed direction!`;
    }

    if (card.value === 'skip') {
      skipNext = true;
      message = `${player.name} skipped next player!`;
    }

    if (card.value === 'draw2') {
      room.drawCount += 2;
      skipNext = true;
      message = `${player.name} played Draw 2! (+${room.drawCount} stacked)`;
    }

    if (card.value === 'wild_draw4') {
      room.drawCount += 4;
      skipNext = true;
      room.currentColor = chosenColor || 'red';
      message = `${player.name} played Wild Draw 4! Color: ${room.currentColor} (+${room.drawCount} stacked)`;
    }

    // Check win condition
    if (player.hand.length === 0) {
      room.status = 'finished';
      const penalty = room.players.filter(p => p.id !== playerId)
        .reduce((sum, p) => sum + calcScore(p.hand), 0);
      player.score += penalty;
      await this.saveRoom(room);
      return { success: true, room, winner: player, message: `🎉 ${player.name} wins! +${penalty} points` };
    }

    // Advance turn
    this._advanceTurn(room, skipNext);

    // FIX: Apply forced draw to next player AFTER advancing turn, in a single save
    if (room.drawCount > 0) {
      const nextPlayer = room.players[room.currentPlayerIndex];
      const topOfNew = room.discardPile[room.discardPile.length - 1];
      const canStack = nextPlayer.hand.some(c =>
        (topOfNew.value === 'draw2' && c.value === 'draw2') ||
        (topOfNew.value === 'wild_draw4' && c.value === 'wild_draw4')
      );
      if (!canStack) {
        // Force draw — don't skip again, just draw and move on
        const drawn = this._drawCards(room, room.drawCount);
        nextPlayer.hand.push(...drawn);
        message += ` → ${nextPlayer.name} draws ${room.drawCount} card(s)!`;
        room.drawCount = 0;
        // FIX: Advance past the penalized player (they drew and lose their turn)
        this._advanceTurn(room, false);
      }
    }

    // FIX: Single save at the end instead of multiple saves
    await this.saveRoom(room);
    return { success: true, room, message };
  }

  async drawCard(roomId, playerId) {
    const room = await this.getRoom(roomId);
    if (!room) return { error: 'Room not found' };
    if (room.status !== 'playing') return { error: 'Game not in progress' };

    const playerIndex = room.players.findIndex(p => p.id === playerId);
    if (playerIndex !== room.currentPlayerIndex) return { error: 'Not your turn' };

    const player = room.players[playerIndex];
    const count = room.drawCount > 0 ? room.drawCount : 1;
    const drawn = this._drawCards(room, count);
    player.hand.push(...drawn);
    room.drawCount = 0;

    // FIX: Only skip turn (pass) if drawing a penalty; otherwise player keeps turn
    // Standard UNO: draw 1 and if it can't be played, end turn
    const forcedDraw = count > 1;
    this._advanceTurn(room, forcedDraw);

    await this.saveRoom(room);
    return { success: true, room, message: `${player.name} drew ${count} card(s)` };
  }

  _drawCards(room, count) {
    const drawn = [];
    for (let i = 0; i < count; i++) {
      if (room.deck.length === 0) {
        const top = room.discardPile.pop();
        room.deck = shuffleDeck(room.discardPile);
        room.discardPile = [top];
      }
      if (room.deck.length > 0) drawn.push(room.deck.shift());
    }
    return drawn;
  }

  _advanceTurn(room, skip = false) {
    const n = room.players.length;
    room.currentPlayerIndex = ((room.currentPlayerIndex + room.direction) % n + n) % n;
    if (skip) {
      room.currentPlayerIndex = ((room.currentPlayerIndex + room.direction) % n + n) % n;
    }
  }

  async setPlayerDisconnected(roomId, playerId) {
    const room = await this.getRoom(roomId);
    if (!room) return;
    const player = room.players.find(p => p.id === playerId);
    if (player) {
      player.connected = false;
      await this.saveRoom(room);
    }
  }

  async getRoomList() {
    const keys = await this.redis.keys('room:*');
    const rooms = [];
    for (const key of keys) {
      const data = await this.redis.hgetall(key);
      if (data && data.status === 'waiting') {
        rooms.push({
          id: data.id,
          hostId: data.hostId,
          playerCount: JSON.parse(data.players).length,
          status: data.status
        });
      }
    }
    return rooms;
  }
}

module.exports = GameStateManager;
