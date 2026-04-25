import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

const styles = {
  container: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    padding: 20,
  },
  card: {
    background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)',
    borderRadius: 20, padding: 40, width: '100%', maxWidth: 460,
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
  title: { fontSize: 38, textAlign: 'center', marginBottom: 6, letterSpacing: 2 },
  subtitle: { textAlign: 'center', color: '#aaa', marginBottom: 30, fontSize: 14 },
  section: { marginBottom: 24 },
  label: { fontSize: 13, color: '#aaa', marginBottom: 8, display: 'block' },
  input: { width: '100%', marginBottom: 12 },
  btn: {
    width: '100%', padding: '12px 0', fontSize: 16,
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: 'white', borderRadius: 10,
  },
  btnSecondary: {
    width: '100%', padding: '12px 0', fontSize: 16,
    background: 'linear-gradient(135deg, #11998e, #38ef7d)',
    color: 'white', borderRadius: 10,
  },
  divider: { textAlign: 'center', color: '#555', margin: '20px 0', fontSize: 13 },
  nodeInfo: {
    textAlign: 'center', fontSize: 12, color: '#555', marginTop: 20,
    padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: 8
  },
  connDot: { display: 'inline-block', width: 8, height: 8, borderRadius: '50%', marginRight: 6 }
};

export default function Lobby({ onEnterRoom }) {
  const { socket, connected } = useSocket();
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!socket) return;
    socket.on('roomCreated', ({ roomId, room }) => onEnterRoom(roomId, room));
    socket.on('roomJoined', ({ roomId, room }) => onEnterRoom(roomId, room));
    socket.on('error', ({ message }) => setError(message));
    return () => { socket.off('roomCreated'); socket.off('roomJoined'); socket.off('error'); };
  }, [socket, onEnterRoom]);

  const create = () => {
    if (!name.trim()) return setError('Enter your name');
    setError('');
    socket.emit('createRoom', { playerName: name.trim() });
  };

  const join = () => {
    if (!name.trim()) return setError('Enter your name');
    if (!roomId.trim()) return setError('Enter a room code');
    setError('');
    socket.emit('joinRoom', { roomId: roomId.trim().toUpperCase(), playerName: name.trim() });
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.title}>🃏 UNO</div>
        <div style={styles.subtitle}>Distributed Multiplayer Card Game</div>

        {error && (
          <div style={{ background: 'rgba(231,76,60,0.15)', border: '1px solid #e74c3c', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 14, color: '#e74c3c' }}>
            {error}
          </div>
        )}

        <div style={styles.section}>
          <label style={styles.label}>Your name</label>
          <input
            style={styles.input}
            placeholder="Enter your name..."
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && create()}
            maxLength={16}
          />
        </div>

        <button style={styles.btn} onClick={create} disabled={!connected}>
          ✨ Create New Room
        </button>

        <div style={styles.divider}>— or join existing —</div>

        <div style={styles.section}>
          <label style={styles.label}>Room code</label>
          <input
            style={styles.input}
            placeholder="e.g. A3F9K2"
            value={roomId}
            onChange={e => setRoomId(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && join()}
            maxLength={6}
          />
        </div>

        <button style={styles.btnSecondary} onClick={join} disabled={!connected}>
          🚪 Join Room
        </button>

        <div style={styles.nodeInfo}>
          <span style={{ ...styles.connDot, background: connected ? '#2ecc71' : '#e74c3c' }} />
          {connected ? `Connected to game server` : 'Connecting...'}
          {connected && socket && <span style={{ marginLeft: 8, color: '#444' }}>ID: {socket.id?.substring(0,8)}</span>}
        </div>
      </div>
    </div>
  );
}
