import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import UnoCard from './UnoCard';

const COLOR_MAP = { red:'#e74c3c', green:'#27ae60', blue:'#2980b9', yellow:'#f1c40f', wild:'#9b59b6' };

function canPlay(card, topCard, currentColor) {
  if (!topCard) return true;
  if (card.value === 'wild' || card.value === 'wild_draw4') return true;
  if (card.color === currentColor) return true;
  if (card.value === topCard.value) return true;
  return false;
}

export default function GameBoard({ roomId, initialRoom, myId, onGameOver }) {
  const { socket } = useSocket();

  // FIX: discardPile is an array; top card is the LAST element, not index [0]
  const initialDiscardTop = initialRoom?.discardPile
    ? (Array.isArray(initialRoom.discardPile)
        ? initialRoom.discardPile[initialRoom.discardPile.length - 1]
        : initialRoom.discardPile[0])
    : undefined;

  const [gs, setGs] = useState({
    currentPlayerIndex: initialRoom?.currentPlayerIndex || 0,
    currentColor: initialRoom?.currentColor,
    discardTop: initialDiscardTop,
    deckCount: initialRoom?.deck || 0,
    drawCount: 0,
    direction: 1,
    players: initialRoom?.players || [],
    message: 'Game started!',
  });
  const [hand, setHand] = useState(
    initialRoom?.players?.find(p => p.id === myId)?.hand || []
  );
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pendingCard, setPendingCard] = useState(null);
  const [chat, setChat] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [log, setLog] = useState(['Game started!']);
  const chatRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    socket.on('gameState', (state) => {
      setGs(state);
      if (state.message) setLog(l => [state.message, ...l].slice(0, 30));
    });

    socket.on('handUpdate', ({ hand }) => setHand(hand));

    socket.on('chatMessage', ({ playerName, message }) => {
      setChat(c => [...c, { playerName, message }].slice(-50));
      setTimeout(() => chatRef.current?.scrollTo(0, 99999), 50);
    });

    socket.on('gameOver', (data) => onGameOver(data));

    socket.on('error', ({ message }) => setLog(l => [`❌ ${message}`, ...l]));

    // FIX: Handle gameStartedPublic for players on other nodes who get this broadcast
    socket.on('gameStartedPublic', (state) => {
      setGs(prev => ({
        ...prev,
        ...state,
        discardTop: state.discardTop,
      }));
    });

    return () => {
      socket.off('gameState');
      socket.off('handUpdate');
      socket.off('chatMessage');
      socket.off('gameOver');
      socket.off('error');
      socket.off('gameStartedPublic');
    };
  }, [socket, onGameOver]);

  const myIndex = gs.players.findIndex(p => p.id === myId);
  const isMyTurn = myIndex === gs.currentPlayerIndex;

  const handleCardClick = (card) => {
    if (!isMyTurn) return;
    if (!canPlay(card, gs.discardTop, gs.currentColor)) return;
    if (card.value === 'wild' || card.value === 'wild_draw4') {
      setPendingCard(card);
      setShowColorPicker(true);
    } else {
      socket.emit('playCard', { roomId, cardId: card.id });
    }
  };

  const chooseColor = (color) => {
    socket.emit('playCard', { roomId, cardId: pendingCard.id, chosenColor: color });
    setShowColorPicker(false);
    setPendingCard(null);
  };

  const drawCard = () => {
    if (!isMyTurn) return;
    socket.emit('drawCard', { roomId });
  };

  const sendChat = () => {
    if (!chatInput.trim()) return;
    const myName = gs.players.find(p => p.id === myId)?.name || 'Me';
    socket.emit('chatMessage', { roomId, playerName: myName, message: chatInput.trim() });
    setChatInput('');
  };

  const topCard = gs.discardTop;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '10px 20px', background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: 2 }}>🃏 UNO</span>
        <span style={{ fontSize: 13, color: '#888' }}>Room: <b style={{ color: '#667eea' }}>{roomId}</b></span>
        <span style={{ fontSize: 13, color: '#888' }}>Direction: {gs.direction === 1 ? '↻ CW' : '↺ CCW'}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {gs.players.map((p, i) => (
            <div key={p.id} style={{
              padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              background: i === gs.currentPlayerIndex ? 'rgba(102,126,234,0.3)' : 'rgba(255,255,255,0.05)',
              border: `2px solid ${i === gs.currentPlayerIndex ? '#667eea' : 'transparent'}`,
              color: p.id === myId ? '#667eea' : '#ccc',
            }}>
              {p.name} ({p.handCount || 0}) {p.id === myId ? '👤' : ''}
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: 0 }}>

        {/* Main game area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 20 }}>

          {/* Status message */}
          <div style={{
            padding: '8px 20px', borderRadius: 20, marginBottom: 16, fontSize: 14,
            background: isMyTurn ? 'rgba(102,126,234,0.25)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${isMyTurn ? '#667eea' : 'rgba(255,255,255,0.1)'}`,
            fontWeight: isMyTurn ? 700 : 400,
            color: isMyTurn ? '#a78bfa' : '#aaa',
          }}>
            {isMyTurn ? '⚡ YOUR TURN!' : `⏳ ${gs.players[gs.currentPlayerIndex]?.name || '?'}'s turn`}
            {gs.drawCount > 0 && <span style={{ marginLeft: 10, color: '#e74c3c' }}>⚠ Must draw +{gs.drawCount}</span>}
          </div>

          {/* Current color indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <span style={{ fontSize: 13, color: '#888' }}>Current color:</span>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: COLOR_MAP[gs.currentColor] || '#888', border: '2px solid rgba(255,255,255,0.3)' }} />
            <span style={{ fontWeight: 600, color: COLOR_MAP[gs.currentColor] || '#888', textTransform: 'capitalize' }}>{gs.currentColor}</span>
          </div>

          {/* Center: Deck + Discard */}
          <div style={{ display: 'flex', gap: 32, alignItems: 'center', marginBottom: 30 }}>
            {/* Deck */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div
                onClick={isMyTurn ? drawCard : undefined}
                style={{
                  width: 70, height: 100, borderRadius: 10, cursor: isMyTurn ? 'pointer' : 'default',
                  background: 'linear-gradient(135deg, #2c3e50, #3498db)',
                  border: `3px solid ${isMyTurn ? '#3498db' : 'rgba(255,255,255,0.2)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 26, boxShadow: isMyTurn ? '0 0 20px rgba(52,152,219,0.5)' : 'none',
                  transition: 'all 0.2s',
                  transform: isMyTurn ? 'scale(1.05)' : 'scale(1)',
                }}
                title={isMyTurn ? 'Draw a card' : undefined}
              >
                🂠
              </div>
              <span style={{ fontSize: 12, color: '#888' }}>{gs.deckCount} left</span>
              {isMyTurn && <span style={{ fontSize: 11, color: '#3498db', fontWeight: 600 }}>DRAW</span>}
            </div>

            {/* Discard pile */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              {topCard ? (
                <UnoCard card={{ ...topCard, color: topCard.color === 'wild' ? gs.currentColor : topCard.color }} playable={false} />
              ) : (
                <div style={{ width: 70, height: 100, borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '2px dashed #444', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>?</div>
              )}
              <span style={{ fontSize: 12, color: '#888' }}>Discard</span>
            </div>
          </div>

          {/* Other players' hand counts */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
            {gs.players.filter(p => p.id !== myId).map((p) => (
              <div key={p.id} style={{
                padding: '8px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.05)',
                border: `1px solid rgba(255,255,255,0.1)`, fontSize: 13, textAlign: 'center',
              }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{p.name}</div>
                <div style={{ color: '#888' }}>🃏 {p.handCount} cards</div>
                {p.handCount === 1 && <div style={{ color: '#f1c40f', fontSize: 11, fontWeight: 700 }}>UNO!</div>}
              </div>
            ))}
          </div>

          {/* Player's hand */}
          <div style={{ width: '100%', maxWidth: 900 }}>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 10, textAlign: 'center' }}>
              Your hand ({hand.length} cards)
              {!isMyTurn && <span style={{ marginLeft: 8, color: '#555' }}>— not your turn</span>}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', padding: '10px 0' }}>
              {hand.map(card => (
                <UnoCard
                  key={card.id}
                  card={card}
                  playable={isMyTurn && canPlay(card, topCard, gs.currentColor)}
                  onClick={handleCardClick}
                />
              ))}
              {hand.length === 0 && <span style={{ color: '#555' }}>No cards</span>}
            </div>
          </div>
        </div>

        {/* Right panel: Log + Chat */}
        <div style={{ width: 240, background: 'rgba(0,0,0,0.25)', borderLeft: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', fontSize: 13 }}>
          {/* Event log */}
          <div style={{ flex: 1, padding: 12, overflowY: 'auto' }}>
            <div style={{ fontSize: 11, color: '#555', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Game Log</div>
            {log.map((l, i) => (
              <div key={i} style={{ color: '#aaa', marginBottom: 5, fontSize: 12, lineHeight: 1.4, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{l}</div>
            ))}
          </div>

          {/* Chat */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: 12 }}>
            <div style={{ fontSize: 11, color: '#555', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Chat</div>
            <div ref={chatRef} style={{ height: 100, overflowY: 'auto', marginBottom: 8 }}>
              {chat.map((c, i) => (
                <div key={i} style={{ fontSize: 12, color: '#aaa', marginBottom: 4 }}>
                  <span style={{ color: '#667eea', fontWeight: 600 }}>{c.playerName}: </span>{c.message}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                style={{ flex: 1, padding: '6px 8px', fontSize: 12 }}
                placeholder="Say something..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChat()}
              />
              <button onClick={sendChat} style={{ padding: '6px 10px', background: '#667eea', color: 'white', fontSize: 12, borderRadius: 6 }}>→</button>
            </div>
          </div>
        </div>
      </div>

      {/* Color picker modal */}
      {showColorPicker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#1e1e3f', borderRadius: 16, padding: 30, textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Choose a color</div>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
              {['red','green','blue','yellow'].map(c => (
                <div key={c} className="color-dot" style={{ background: COLOR_MAP[c], width: 50, height: 50 }} onClick={() => chooseColor(c)} title={c} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
