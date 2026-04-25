import React, { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';

const s = {
  wrap: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)', padding: 20,
  },
  card: {
    background: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 36,
    width: '100%', maxWidth: 500, border: '1px solid rgba(255,255,255,0.1)',
  },
  title: { fontSize: 24, fontWeight: 700, marginBottom: 6 },
  roomCode: {
    display: 'inline-block', fontSize: 32, fontWeight: 900, letterSpacing: 6,
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
    margin: '10px 0',
  },
  hint: { fontSize: 13, color: '#888', marginBottom: 24 },
  playerList: { marginBottom: 24 },
  playerRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 14px', borderRadius: 10,
    background: 'rgba(255,255,255,0.05)', marginBottom: 8,
    border: '1px solid rgba(255,255,255,0.07)',
  },
  avatar: {
    width: 34, height: 34, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 16, fontWeight: 700,
  },
  host: { fontSize: 11, color: '#f1c40f', marginLeft: 'auto' },
  startBtn: {
    width: '100%', padding: '14px 0', fontSize: 17,
    background: 'linear-gradient(135deg, #f093fb, #f5576c)',
    color: 'white', borderRadius: 12, marginBottom: 10,
  },
  waitMsg: { textAlign: 'center', color: '#888', fontSize: 14, padding: '12px 0' },
};

const COLORS_BG = ['#e74c3c','#27ae60','#2980b9','#f1c40f','#9b59b6'];

export default function WaitingRoom({ roomId, room: initialRoom, onStart, myId }) {
  const { socket } = useSocket();
  // FIX: Use local state for players so we can update when others join
  const [players, setPlayers] = useState(initialRoom?.players || []);

  useEffect(() => {
    if (!socket) return;

    // FIX: Listen for playerJoined to update the waiting room player list
    socket.on('playerJoined', ({ players: updatedPlayers }) => {
      if (updatedPlayers) setPlayers(updatedPlayers);
    });

    socket.on('gameStarted', ({ room }) => onStart(room));

    return () => {
      socket.off('playerJoined');
      socket.off('gameStarted');
    };
  }, [socket, onStart]);

  const isHost = players?.[0]?.id === myId;
  const playerCount = players?.length || 0;

  const start = () => socket.emit('startGame', { roomId });

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.title}>🎮 Waiting Room</div>
        <div style={s.roomCode}>{roomId}</div>
        <div style={s.hint}>Share this code with friends to join • {playerCount}/4 players</div>

        <div style={s.playerList}>
          {players?.map((p, i) => (
            <div key={p.id} style={s.playerRow}>
              <div style={{ ...s.avatar, background: COLORS_BG[i % COLORS_BG.length] }}>
                {p.name?.[0]?.toUpperCase()}
              </div>
              <span style={{ fontWeight: 600 }}>{p.name}</span>
              {p.id === myId && <span style={{ fontSize: 12, color: '#667eea' }}>(you)</span>}
              {i === 0 && <span style={s.host}>👑 Host</span>}
            </div>
          ))}
          {Array.from({ length: 4 - playerCount }).map((_, i) => (
            <div key={i} style={{ ...s.playerRow, opacity: 0.3 }}>
              <div style={{ ...s.avatar, background: '#333' }}>?</div>
              <span style={{ color: '#555' }}>Waiting for player...</span>
            </div>
          ))}
        </div>

        {isHost ? (
          <button style={s.startBtn} onClick={start} disabled={playerCount < 2}>
            {playerCount < 2 ? '⏳ Need at least 2 players' : '🚀 Start Game!'}
          </button>
        ) : (
          <div style={s.waitMsg}>⏳ Waiting for host to start the game...</div>
        )}
      </div>
    </div>
  );
}
