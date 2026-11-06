import type { Card, CardKind, Player } from '../types/game';

/**
 * Generates the standard 51-card Kookriko deck:
 * - Numbers 0–8: 4 copies of each (36 cards)
 * - Chickens (9): 9 copies (9 cards)
 * - Fox Peek: 3 copies (3 cards)
 * - Fox Swap: 3 copies (3 cards)
 */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  let seq = 1;

  const makeId = (prefix: string) => `${prefix}-${seq++}`;

  // Numbers 0 through 8 (4 copies each = 36)
  for (let value = 0; value <= 8; value++) {
    for (let copy = 0; copy < 4; copy++) {
      deck.push({
        id: makeId(`num-${value}`),
        kind: 'NUMBER',
        value,
      });
    }
  }

  // Chickens = value 9 (9 copies)
  for (let copy = 0; copy < 9; copy++) {
    deck.push({
      id: makeId('chicken-9'),
      kind: 'CHICKEN',
      value: 9,
    });
  }

  // Fox Power Cards: 3 Peek, 3 Swap
  const foxKinds: CardKind[] = ['FOX_PEEK', 'FOX_SWAP'];
  for (const kind of foxKinds) {
    for (let copy = 0; copy < 3; copy++) {
      deck.push({
        id: makeId(kind.toLowerCase()),
        kind,
        value: null,
      });
    }
  }

  return deck;
}

/**
 * Unbiased Fisher-Yates shuffle returning a new array.
 */
export function shuffleDeck(cards: readonly Card[]): Card[] {
  const copy = [...cards];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

export function isFoxCard(card: Card): boolean {
  return card.kind === 'FOX_PEEK' || card.kind === 'FOX_SWAP';
}

export interface DealResult {
  players: Player[];
  deck: Card[];
  discardPile: Card[];
}

/**
 * Shuffles a fresh deck, deals 4 cards to each player, and flips the first
 * non-Fox card onto the discard pile to begin the round.
 */
export function dealInitialHands(players: readonly Player[]): DealResult {
  const deck = shuffleDeck(createDeck());

  const dealtPlayers: Player[] = players.map((player) => {
    const hand = deck.splice(0, 4);
    return {
      ...player,
      hand,
      hasCompletedInitialPeek: false,
      roundScore: null,
    };
  });

  // Flip the first non-Fox card to start the discard pile.
  // Any Fox card drawn here is returned to a random spot in the deck.
  const discardPile: Card[] = [];
  while (deck.length > 0) {
    const candidate = deck.shift()!;
    if (!isFoxCard(candidate)) {
      discardPile.push(candidate);
      break;
    } else {
      const insertIdx = Math.floor(Math.random() * (deck.length + 1));
      deck.splice(insertIdx, 0, candidate);
    }
  }

  return {
    players: dealtPlayers,
    deck,
    discardPile,
  };
}

/**
 * Draws the top card from the deck. If the deck is empty, reshuffles all cards
 * beneath the top of the discard pile back into the deck first.
 */
export function drawCardFromDeckWithReshuffle(
  currentDeck: readonly Card[],
  currentDiscard: readonly Card[]
): { drawn: Card | null; deck: Card[]; discardPile: Card[] } {
  let deck = [...currentDeck];
  let discardPile = [...currentDiscard];

  if (deck.length === 0 && discardPile.length > 1) {
    const topDiscard = discardPile[discardPile.length - 1];
    const underCards = discardPile.slice(0, discardPile.length - 1);
    deck = shuffleDeck(underCards);
    discardPile = [topDiscard];
  }

  const drawn = deck.shift() ?? null;
  return { drawn, deck, discardPile };
}

/**
 * At the end of a round (when Kookriko final turns conclude), any Fox power card
 * still hidden in a player's 4-card hand (e.g., from initial deal or a blind swap)
 * is replaced by drawing from the deck until a Number/Chicken card is found.
 * Then each player's roundScore and totalScore are computed.
 */
export function resolveHandsAndScoreAtRoundEnd(
  players: readonly Player[],
  currentDeck: readonly Card[],
  currentDiscard: readonly Card[]
): {
  players: Player[];
  deck: Card[];
  discardPile: Card[];
  winnerIds: string[];
} {
  let deck = [...currentDeck];
  let discardPile = [...currentDiscard];

  const drawReplacementNumberOrChicken = (): Card => {
    let safety = 0;
    while (safety++ < 100) {
      const res = drawCardFromDeckWithReshuffle(deck, discardPile);
      deck = res.deck;
      discardPile = res.discardPile;
      if (!res.drawn) {
        return { id: `fallback-0-${safety}`, kind: 'NUMBER', value: 0 };
      }
      if (!isFoxCard(res.drawn)) {
        return res.drawn;
      }
      // Discard the drawn Fox card and keep drawing
      discardPile.push(res.drawn);
    }
    return { id: 'fallback-0', kind: 'NUMBER', value: 0 };
  };

  const resolvedPlayers: Player[] = players.map((player) => {
    const resolvedHand = player.hand.map((card) =>
      isFoxCard(card) ? drawReplacementNumberOrChicken() : card
    );
    const roundScore = resolvedHand.reduce(
      (sum, card) => sum + (card.value ?? 0),
      0
    );
    return {
      ...player,
      hand: resolvedHand,
      roundScore,
      totalScore: player.totalScore + roundScore,
    };
  });

  const minScore = Math.min(
    ...resolvedPlayers.map((p) => p.roundScore ?? Infinity)
  );
  const winnerIds = resolvedPlayers
    .filter((p) => p.roundScore === minScore)
    .map((p) => p.id);

  return {
    players: resolvedPlayers,
    deck,
    discardPile,
    winnerIds,
  };
}
