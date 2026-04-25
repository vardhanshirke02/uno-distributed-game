import React from 'react';

export default function GameOver({ data, myId, onRestart }) {
  const { winner, players, message } = data;
  const sorted = [...(players || [])].sort((a, b) => b.score - a.score);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a1a2e, #16213e)', padding: 20,
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 40,
        maxWidth: 440, width: '100%', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{ fontSize: 60, marginBottom: 10 }}>🏆</div>
        <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>{winner?.name} Wins!</div>
        <div style={{ color: '#aaa', fontSize: 14, marginBottom: 28 }}>{message}</div>

        <div style={{ marginBottom: 24 }}>
          {sorted.map((p, i) => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 16px', borderRadius: 10, marginBottom: 8,
              background: p.id === winner?.id ? 'rgba(241,196,15,0.12)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${p.id === winner?.id ? 'rgba(241,196,15,0.4)' : 'rgba(255,255,255,0.07)'}`,
            }}>
              <span style={{ fontSize: 20 }}>{['🥇','🥈','🥉','4️⃣'][i]}</span>
              <span style={{ fontWeight: 600, flex: 1, textAlign: 'left' }}>
                {p.name} {p.id === myId ? '(you)' : ''}
              </span>
              <span style={{ color: '#f1c40f', fontWeight: 700 }}>{p.score} pts</span>
            </div>
          ))}
        </div>

        <button
          onClick={onRestart}
          style={{
            width: '100%', padding: '13px 0', fontSize: 16,
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            color: 'white', borderRadius: 12,
          }}
        >
          🔄 Back to Lobby
        </button>
      </div>
    </div>
  );
}
