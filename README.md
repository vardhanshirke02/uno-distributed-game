# 🃏 Distributed UNO Card Game

A fully distributed multiplayer UNO game demonstrating core Distributed Systems concepts:
- **Replication** — game state mirrored across Redis
- **Pub/Sub messaging** — cross-node event propagation
- **Atomicity** — Redis atomic operations for card dealing
- **Fault tolerance** — Redis persistence, node reconnection
- **Scalability** — multiple game server nodes behind load balancer

---

## 📁 Project Structure

```
uno-distributed/
├── server/
│   ├── index.js          ← Main Socket.IO server + Redis pub/sub
│   ├── gameLogic.js      ← UNO rules (deck, shuffle, canPlay, scoring)
│   ├── gameState.js      ← Redis-backed distributed game state manager
│   ├── Dockerfile
│   └── package.json
├── client/
│   ├── src/
│   │   ├── App.js
│   │   ├── context/
│   │   │   └── SocketContext.js   ← Socket.IO React context
│   │   └── components/
│   │       ├── Lobby.js           ← Create/join room UI
│   │       ├── WaitingRoom.js     ← Pre-game lobby
│   │       ├── GameBoard.js       ← Main game UI
│   │       ├── GameOver.js        ← Winner screen
│   │       └── UnoCard.js         ← Card component
│   └── package.json
├── docker-compose.yml    ← 2 game nodes + Redis
└── README.md
```

---

## 🚀 Method 1: Run Locally (Recommended for Development)

### Prerequisites
- Node.js v16+ — https://nodejs.org
- Redis — https://redis.io/download

### Step 1: Install Redis & Start It
```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt update && sudo apt install redis-server
sudo systemctl start redis

# Windows — use WSL2 or Docker
wsl --install
# then run ubuntu commands above

# Verify Redis is running:
redis-cli ping
# Should print: PONG
```

### Step 2: Install Server Dependencies
```bash
cd server
npm install
```

### Step 3: Start Server Node 1
```bash
# Terminal 1
PORT=3001 NODE_ID=node-1 node index.js
```

You should see:
```
🎮 UNO Distributed Game Server
📡 Node ID: node-1
🚀 Running on port 3001
🔴 Redis: redis://localhost:6379
```

### Step 4: (Optional) Start Server Node 2 — Distributed Demo
```bash
# Terminal 2
PORT=3002 NODE_ID=node-2 node index.js
```

> Players connecting to port 3001 and 3002 can play in the SAME game room
> because both nodes share state through Redis and communicate via pub/sub!

### Step 5: Install & Start Frontend
```bash
# Terminal 3
cd ../client
npm install
npm start
```

The app opens at **http://localhost:3000**

### Step 6: Play the Game!
1. Open **http://localhost:3000** in 2-4 browser tabs
2. Each tab = one player
3. Player 1: Enter name → **Create New Room** → copy the 6-letter code
4. Players 2-4: Enter name → paste code → **Join Room**
5. Host clicks **Start Game**
6. Play UNO! Click cards to play, click the deck to draw

---

## 🐳 Method 2: Docker (Distributed Setup)

### Prerequisites
- Docker Desktop — https://docker.com/get-started

### Step 1: Build & Start All Services
```bash
cd uno-distributed
docker-compose up --build
```

This starts:
- **Redis** on port 6379
- **Game Server Node 1** on port 3001
- **Game Server Node 2** on port 3002

### Step 2: Start Frontend
```bash
cd client
npm install
npm start
```

### Step 3: Test Cross-Node Distribution
```bash
# Open Tab A — connect to Node 1
http://localhost:3000  (proxies to :3001)

# Open Tab B — connect to Node 2 directly
REACT_APP_SERVER_URL=http://localhost:3002 npm start
```

Players on different nodes can play in the same room!

---

## 🎮 How to Play UNO

### Goal
Be the first to empty your hand!

### Turns
- Play a card matching the **color** OR **number/symbol** of the top discard
- If you can't play, **draw a card** from the deck

### Special Cards
| Card | Effect |
|------|--------|
| **Skip** | Next player loses their turn |
| **Reverse** | Direction of play reverses |
| **Draw 2** | Next player draws 2 cards and skips |
| **Wild** | Choose any color |
| **Wild Draw 4** | Choose color + next player draws 4 |

### Stacking
Draw 2 and Wild Draw 4 **stack** — if you have a matching draw card, play it to pass the penalty forward!

### Winning
First player to play all cards wins. Other players' remaining cards count as penalty points for the winner.

---

## 🔧 Distributed Systems Concepts Demonstrated

### 1. Shared State via Redis
```
Game Room State (stored in Redis hash: room:{roomId})
├── players[]     ← all player hands
├── deck[]        ← remaining cards
├── discardPile[] ← played cards
├── currentColor  ← active color
└── drawCount     ← stacked penalties
```

### 2. Atomic Operations
```javascript
// Redis LPOP is atomic — prevents two nodes dealing the same card
const card = await redis.lpop(`deck:${roomId}`);
```

### 3. Cross-Node Pub/Sub
```
Player on Node 1 plays card
  → Node 1 saves to Redis
  → Node 1 publishes to Redis channel "game-events"
  → Node 2 receives message from channel
  → Node 2 broadcasts to its connected players
```

### 4. Private State (Information Hiding)
Each player only receives their own hand cards — a core security feature of card games.

---

## 🏗️ Architecture Diagram

```
Browser (Player A)     Browser (Player B)
       │                      │
       │ WebSocket             │ WebSocket
       ▼                      ▼
┌─────────────┐        ┌─────────────┐
│ Game Node 1 │        │ Game Node 2 │
│  (port 3001)│        │  (port 3002)│
└──────┬──────┘        └──────┬──────┘
       │  Redis Pub/Sub        │
       │◄─────────────────────►│
       │                       │
       └──────────┬────────────┘
                  ▼
         ┌──────────────┐
         │    Redis     │
         │ Shared State │
         │  + Pub/Sub   │
         └──────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Game Server | Node.js + Express |
| Real-time | Socket.IO |
| Distributed State | Redis (ioredis) |
| Cross-node Events | Redis Pub/Sub |
| Frontend | React.js |
| Containerization | Docker + Docker Compose |

---

## 📝 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `NODE_ID` | `node-{PORT}` | Unique node identifier |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `REACT_APP_SERVER_URL` | `http://localhost:3001` | Frontend server URL |

---

## 🐛 Troubleshooting

**Redis connection refused**
```bash
redis-cli ping
# If no PONG, start Redis: redis-server
```

**Port already in use**
```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill -9
```

**Players not seeing each other's moves**
- Make sure both players are connecting to the same server node, OR
- Both nodes are running and connected to the same Redis instance

**npm install fails**
```bash
# Clear cache and retry
npm cache clean --force
rm -rf node_modules
npm install
```
