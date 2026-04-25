import React, { useState, useCallback } from 'react';
import { SocketProvider, useSocket } from './context/SocketContext';
import Lobby from './components/Lobby';
import WaitingRoom from './components/WaitingRoom';
import GameBoard from './components/GameBoard';
import GameOver from './components/GameOver';

function GameApp() {
  const { socket } = useSocket();
  const [screen, setScreen] = useState('lobby'); // lobby | waiting | playing | gameover
  const [roomId, setRoomId] = useState(null);
  const [room, setRoom] = useState(null);
  const [gameOverData, setGameOverData] = useState(null);

  const handleEnterRoom = useCallback((id, r) => {
    setRoomId(id);
    setRoom(r);
    setScreen('waiting');
  }, []);

  const handleStart = useCallback((r) => {
    setRoom(r);
    setScreen('playing');
  }, []);

  const handleGameOver = useCallback((data) => {
    setGameOverData(data);
    setScreen('gameover');
  }, []);

  const handleRestart = useCallback(() => {
    setScreen('lobby');
    setRoomId(null);
    setRoom(null);
    setGameOverData(null);
  }, []);

  if (!socket) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
      Connecting...
    </div>
  );

  switch (screen) {
    case 'lobby':
      return <Lobby onEnterRoom={handleEnterRoom} />;
    case 'waiting':
      return (
        <WaitingRoom
          roomId={roomId}
          room={room}
          myId={socket.id}
          onStart={handleStart}
        />
      );
    case 'playing':
      return (
        <GameBoard
          roomId={roomId}
          initialRoom={room}
          myId={socket.id}
          onGameOver={handleGameOver}
        />
      );
    case 'gameover':
      return <GameOver data={gameOverData} myId={socket.id} onRestart={handleRestart} />;
    default:
      return <Lobby onEnterRoom={handleEnterRoom} />;
  }
}

export default function App() {
  return (
    <SocketProvider>
      <GameApp />
    </SocketProvider>
  );
}
