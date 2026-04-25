// UNO Card Game Logic

const COLORS = ['red', 'green', 'blue', 'yellow'];
const VALUES = ['0','1','2','3','4','5','6','7','8','9','skip','reverse','draw2'];
const WILD_CARDS = ['wild', 'wild_draw4'];

function createDeck() {
  const deck = [];
  for (const color of COLORS) {
    for (const value of VALUES) {
      deck.push({ color, value, id: `${color}_${value}_1` });
      if (value !== '0') {
        deck.push({ color, value, id: `${color}_${value}_2` });
      }
    }
  }
  for (const value of WILD_CARDS) {
    for (let i = 0; i < 4; i++) {
      deck.push({ color: 'wild', value, id: `${value}_${i}` });
    }
  }
  return deck;
}

function shuffleDeck(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function canPlay(card, topCard, currentColor) {
  if (card.value === 'wild' || card.value === 'wild_draw4') return true;
  if (card.color === currentColor) return true;
  if (card.value === topCard.value) return true;
  return false;
}

function getCardPoints(card) {
  if (['skip','reverse','draw2'].includes(card.value)) return 20;
  if (['wild','wild_draw4'].includes(card.value)) return 50;
  return parseInt(card.value) || 0;
}

function calcScore(hand) {
  return hand.reduce((sum, card) => sum + getCardPoints(card), 0);
}

module.exports = { createDeck, shuffleDeck, canPlay, calcScore, COLORS };
