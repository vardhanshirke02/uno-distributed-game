const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Redis = require('ioredis');
const GameStateManager = require('./gameState');

const PORT = process.env.PORT || 3002;
const NODE_ID = process.env.NODE_ID || `node-${PORT}`;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Redis clients — one for commands, one for pub/sub
const redis = new Redis(REDIS_URL);
const redisSub = new Redis(REDIS_URL);
const redisPub = new Redis(REDIS_URL);

const gsm = new GameStateManager(redis);

// ── Cross-node pub/sub ──────────────────────────────────────────────
redisSub.subscribe('game-events', (err) => {
  if (err) console.error('Redis subscribe error:', err);
  else console.log(`[${NODE_ID}] Subscribed to game-events channel`);
});

redisSub.on('message', (channel, message) => {
  if (channel === 'game-events') {
    const event = JSON.parse(message);
    if (event.originNode !== NODE_ID) {
      if (event.type === 'gameStarted') {
        // FIX: On other nodes, emit gameStarted privately per socket
        // We can only broadcast a public version; private hands were already
        // sent by the originating node directly via socket.id
        broadcastToRoom(event.roomId, 'gameStartedPublic', event.payload);
      } else {
        broadcastToRoom(event.roomId, event.type, event.payload);
      }
    }
  }
});

function broadcastToRoom(roomId, eventType, payload) {
  io.to(`room:${roomId}`).emit(eventType, payload);
}

async function publishAndBroadcast(roomId, eventType, payload) {
  broadcastToRoom(roomId, eventType, payload);
  await redisPub.publish('game-events', JSON.stringify({
    roomId, type: eventType, payload, originNode: NODE_ID
  }));
}

// ── Sanitize room for specific player (hide other hands) ─────────────
function sanitizeRoom(room, playerId) {
  return {
    ...room,
    deck: room.deck ? room.deck.length : 0,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      handCount: p.hand.length,
      score: p.score,
      connected: p.connected,
      hand: p.id === playerId ? p.hand : undefined
    })),
    discardPile: room.discardPile ? room.discardPile.slice(-1) : []
  };
}

// ── REST endpoints ───────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', node: NODE_ID, port: PORT });
});

app.get('/rooms', async (req, res) => {
  const rooms = await gsm.getRoomList();
  res.json(rooms);
});

// ── Socket.IO events ─────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[${NODE_ID}] Client connected: ${socket.id}`);

  // Create room
  socket.on('createRoom', async ({ playerName }) => {
    const roomId = await gsm.createRoom(socket.id, playerName);
    socket.join(`room:${roomId}`);
    const room = await gsm.getRoom(roomId);
    socket.emit('roomCreated', { roomId, room: sanitizeRoom(room, socket.id) });
    console.log(`[${NODE_ID}] Room created: ${roomId} by ${playerName}`);
  });

  // Join room
  socket.on('joinRoom', async ({ roomId, playerName }) => {
    const result = await gsm.joinRoom(roomId, socket.id, playerName);
    if (result.error) {
      socket.emit('error', { message: result.error });
      return;
    }
    socket.join(`room:${roomId}`);
    const room = await gsm.getRoom(roomId);
    socket.emit('roomJoined', { roomId, room: sanitizeRoom(room, socket.id) });
    await publishAndBroadcast(roomId, 'playerJoined', {
      playerName,
      players: room.players.map(p => ({ id: p.id, name: p.name, handCount: 0, score: p.score, connected: p.connected }))
    });
    console.log(`[${NODE_ID}] ${playerName} joined room ${roomId}`);
  });

  // Start game
  socket.on('startGame', async ({ roomId }) => {
    const result = await gsm.startGame(roomId);
    if (result.error) {
      socket.emit('error', { message: result.error });
      return;
    }
    const room = result.room;

    // FIX: Send each player their private hand directly via their socket id
    for (const player of room.players) {
      // io.to(socketId) sends to that specific socket across all nodes
      io.to(player.id).emit('gameStarted', { room: sanitizeRoom(room, player.id) });
    }

    // Publish public game state for other nodes (for players connected there)
    await redisPub.publish('game-events', JSON.stringify({
      roomId,
      type: 'gameStarted',
      payload: {
        status: room.status,
        currentPlayerIndex: room.currentPlayerIndex,
        currentColor: room.currentColor,
        discardTop: room.discardPile[room.discardPile.length - 1],
        deckCount: room.deck.length,
        players: room.players.map(p => ({ id: p.id, name: p.name, handCount: p.hand.length, score: p.score, connected: p.connected }))
      },
      originNode: NODE_ID
    }));
    console.log(`[${NODE_ID}] Game started in room ${roomId}`);
  });

  // Play card
  socket.on('playCard', async ({ roomId, cardId, chosenColor }) => {
    const result = await gsm.playCard(roomId, socket.id, cardId, chosenColor);
    if (result.error) {
      socket.emit('error', { message: result.error });
      return;
    }
    const room = result.room;

    if (result.winner) {
      await publishAndBroadcast(roomId, 'gameOver', {
        winner: result.winner,
        players: room.players.map(p => ({ id: p.id, name: p.name, score: p.score, handCount: p.hand.length })),
        message: result.message
      });
      return;
    }

    // FIX: Send hand updates to each player via their socket id (works cross-node)
    for (const player of room.players) {
      io.to(player.id).emit('handUpdate', { hand: player.hand });
    }

    await publishAndBroadcast(roomId, 'gameState', {
      currentPlayerIndex: room.currentPlayerIndex,
      currentColor: room.currentColor,
      discardTop: room.discardPile[room.discardPile.length - 1],
      deckCount: room.deck.length,
      drawCount: room.drawCount,
      direction: room.direction,
      players: room.players.map(p => ({ id: p.id, name: p.name, handCount: p.hand.length, score: p.score, connected: p.connected })),
      message: result.message
    });
  });

  // Draw card
  socket.on('drawCard', async ({ roomId }) => {
    const result = await gsm.drawCard(roomId, socket.id);
    if (result.error) {
      socket.emit('error', { message: result.error });
      return;
    }
    const room = result.room;

    // FIX: Send hand updates to each player via their socket id (works cross-node)
    for (const player of room.players) {
      io.to(player.id).emit('handUpdate', { hand: player.hand });
    }

    await publishAndBroadcast(roomId, 'gameState', {
      currentPlayerIndex: room.currentPlayerIndex,
      currentColor: room.currentColor,
      discardTop: room.discardPile[room.discardPile.length - 1],
      deckCount: room.deck.length,
      drawCount: room.drawCount,
      direction: room.direction,
      players: room.players.map(p => ({ id: p.id, name: p.name, handCount: p.hand.length, score: p.score, connected: p.connected })),
      message: result.message
    });
  });

  // Chat message
  socket.on('chatMessage', async ({ roomId, playerName, message }) => {
    await publishAndBroadcast(roomId, 'chatMessage', { playerName, message, time: Date.now() });
  });

  // FIX: Handle disconnect — mark player as disconnected in game state
  socket.on('disconnect', async () => {
    console.log(`[${NODE_ID}] Client disconnected: ${socket.id}`);
    // Find which room this socket was in and mark them disconnected
    const rooms = io.sockets.adapter.rooms;
    for (const [roomKey] of rooms) {
      if (roomKey.startsWith('room:')) {
        const roomId = roomKey.replace('room:', '');
        await gsm.setPlayerDisconnected(roomId, socket.id);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n🎮 UNO Distributed Game Server`);
  console.log(`📡 Node ID: ${NODE_ID}`);
  console.log(`🚀 Running on port ${PORT}`);
  console.log(`🔴 Redis: ${REDIS_URL}\n`);
});
