import React from 'react';

const SYMBOLS = {
  skip: '⊘', reverse: '⇄', draw2: '+2',
  wild: '★', wild_draw4: '+4★',
};

function getSymbol(value) {
  return SYMBOLS[value] || value?.toUpperCase();
}

export default function UnoCard({ card, onClick, playable = true, small = false }) {
  if (!card) return null;

  const colorClass = `card-${card.color}`;
  const sym = getSymbol(card.value);
  const unplayable = !playable;

  const style = small ? { width: 48, height: 68, fontSize: 10 } : {};

  return (
    <div
      className={`uno-card ${colorClass} ${unplayable ? 'unplayable' : ''}`}
      style={style}
      onClick={() => playable && onClick && onClick(card)}
      title={`${card.color} ${card.value}`}
    >
      <span className="card-corner-tl">{sym}</span>
      <span className="card-symbol" style={small ? { fontSize: 16 } : {}}>{sym}</span>
      <span className="card-corner-br">{sym}</span>
    </div>
  );
}
