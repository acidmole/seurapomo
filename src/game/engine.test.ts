import { describe, expect, it } from 'vitest';
import { HUMAN_COLORS } from './data';
import {
  MAX_SQUAD, ROUNDS, createGame, currentClubId, lineup, playerValue, reduce, table, trainingCost,
  type Action, type GameState,
} from './engine';

function newGame(humans: number, seasons = 1, seed = 1): GameState {
  return createGame({
    clubs: Array.from({ length: humans }, (_, i) => ({ name: `Seura ${i + 1}`, color: HUMAN_COLORS[i] })),
    seasons,
    seed,
  });
}

/** A simple manager that buys what it can afford. */
function bot(s: GameState): Action {
  const p = s.pending;
  const club = (id: number) => s.clubs.find((c) => c.id === id)!;
  if (p?.kind === 'auctionPick') return { type: 'AUCTION_PICK', index: 0 };
  if (p?.kind === 'auction') {
    const bidder = club(p.active[p.idx]);
    const min = p.leader === null ? p.minBid : p.bid + 5;
    const wants = bidder.squad.length < MAX_SQUAD && min <= bidder.cash && min <= playerValue(p.player.skill);
    return wants ? { type: 'BID', amount: min } : { type: 'PASS' };
  }
  const me = club(currentClubId(s));
  if (p?.kind === 'scout') {
    const index = me.squad.length < MAX_SQUAD ? p.options.findIndex((o) => playerValue(o.skill) + 100 <= me.cash) : -1;
    return index >= 0 ? { type: 'SCOUT_BUY', index } : { type: 'SKIP' };
  }
  if (p?.kind === 'training') {
    const best = [...me.squad].sort((a, b) => b.skill - a.skill).find((x) => x.skill < 10 && trainingCost(x) <= me.cash);
    return best ? { type: 'TRAIN', playerId: best.id } : { type: 'SKIP' };
  }
  if (s.phase === 'roll') return { type: 'ROLL' };
  if (s.phase === 'manage') return { type: 'END_TURN' };
  return { type: 'CONTINUE' };
}

function playOut(s: GameState): GameState {
  for (let i = 0; i < 20000 && s.phase !== 'gameOver'; i++) {
    const next = reduce(s, bot(s));
    expect(next).not.toBe(s);
    s = next;
  }
  return s;
}

describe('schedule', () => {
  it('is a double round robin', () => {
    const s = newGame(2);
    expect(s.schedule).toHaveLength(ROUNDS);
    const pairs = new Set<string>();
    for (const round of s.schedule) {
      expect(new Set(round.flatMap((f) => [f.home, f.away])).size).toBe(8);
      for (const f of round) pairs.add(`${f.home}-${f.away}`);
    }
    expect(pairs.size).toBe(56);
  });
});

describe('lineup', () => {
  it('fields eleven players and fills gaps out of position', () => {
    const club = newGame(2).clubs[0];
    club.formation = '3-5-2';
    const l = lineup(club);
    expect(l.slots).toHaveLength(11);
    expect(l.slots.every((x) => x.player)).toBe(true);
    const makeshift = l.slots.find((x) => x.player!.pos !== x.pos)!;
    expect(makeshift.eff).toBeLessThan(makeshift.player!.skill);
  });

  it('leaves injured players out', () => {
    const club = newGame(2).clubs[0];
    const star = lineup(club).slots[0].player!;
    star.out = 2;
    expect(lineup(club).slots.some((x) => x.player?.id === star.id)).toBe(false);
  });
});

describe('full game', () => {
  it.each([2, 4, 6])('finishes with %i managers', (humans) => {
    const s = playOut(newGame(humans, 2, humans));
    expect(s.phase).toBe('gameOver');
    expect(s.season).toBe(2);
    expect(table(s).every((r) => r.p === ROUNDS)).toBe(true);
    expect(s.cup).toHaveLength(3);
    expect(s.cup[2][0].winner).not.toBeNull();
  });

  it('is deterministic for a seed', () => {
    expect(playOut(newGame(3, 1, 42))).toEqual(playOut(newGame(3, 1, 42)));
  });

  it('keeps the economy playable', () => {
    const cash: number[] = [];
    for (let seed = 1; seed <= 30; seed++) {
      const s = playOut(newGame(4, 1, seed));
      for (const id of s.humans) cash.push(s.clubs[id].cash);
    }
    const mean = cash.reduce((a, b) => a + b, 0) / cash.length;
    const inDebt = cash.filter((c) => c < 0).length / cash.length;
    console.log(`mean cash ${mean.toFixed(0)}, min ${Math.min(...cash)}, max ${Math.max(...cash)}, in debt ${(inDebt * 100).toFixed(0)} %`);
    expect(inDebt).toBeLessThan(0.15);
  });
});
