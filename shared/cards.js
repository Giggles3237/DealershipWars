import cards from "../cards.json" with { type: "json" };

const numericValue = (value) => (value === "Auto-Win" ? 999 : Number(value));

export const baseCards = cards;

export const getNumericCardValue = (card) => numericValue(card.value);

export const cloneDeck = (random = Math.random) => {
  let nextUid = 1;
  const deck = baseCards.map((card) => ({
    ...card,
    uid: `card-${nextUid++}`
  }));

  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }

  return deck;
};
