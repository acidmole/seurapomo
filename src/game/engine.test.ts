import { describe, expect, it } from 'vitest';
import { BOARD, CARDS, EURO_COMPS, FOREIGN_NAMES, LOWER_LEVELS, FORMATIONS, HUMAN_COLORS, type FormationId } from './data';
import {
  EURO_AFTER, MATCH_BONUS_COST, MAX_LEVEL, MAX_SQUAD, MIN_SQUAD, ROUNDS, createGame, cupGate, currentClubId, duel, euroGate, expectedChances, gateIncome, level, lineup, playCardNow, scoringOdds, shootoutOdds, spiritBonus, standing, stoppageOdds, wages, wealth, winStreak, playerValue, reduce, table, trainingCost,
  type Action, type GameState,
} from './engine';

function newGame(humans: number, seed = 1): GameState {
  return createGame({
    clubs: Array.from({ length: humans }, (_, i) => ({ name: `Seura ${i + 1}`, color: HUMAN_COLORS[i] })),
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
    const wants = bidder.squad.length < MAX_SQUAD && min <= bidder.cash && min <= playerValue(p.player.skill, p.player.spirit);
    return wants ? { type: 'BID', amount: min } : { type: 'PASS' };
  }
  const me = club(currentClubId(s));
  if (p?.kind === 'scout') {
    const index = me.squad.length < MAX_SQUAD ? p.options.findIndex((o) => playerValue(o.skill, o.spirit) + 100 <= me.cash) : -1;
    return index >= 0 ? { type: 'SCOUT_BUY', index } : { type: 'SKIP' };
  }
  if (p?.kind === 'steal') return { type: 'SKIP' };
  if (p?.kind === 'training') {
    const best = [...me.squad].sort((a, b) => b.skill - a.skill).find((x) => x.skill < MAX_LEVEL && trainingCost(x) <= me.cash);
    return best ? { type: 'TRAIN', playerId: best.id } : { type: 'SKIP' };
  }
  if (s.phase === 'roll') return { type: 'ROLL' };
  if (s.phase === 'manage' && me.cash < 0) {
    if (me.squad.length <= MIN_SQUAD) return { type: 'BANKRUPT' };
    return { type: 'SELL', playerId: [...me.squad].sort((a, b) => a.skill - b.skill)[0].id };
  }
  if (s.phase === 'manage') return { type: 'END_TURN' };
  return { type: 'CONTINUE' };
}

/** Plays on until the managers count up after the given season, or all go bankrupt. */
function playOut(s: GameState, seasons = 1): GameState {
  for (let i = 0; i < 40000 && s.phase !== 'gameOver'; i++) {
    const next = reduce(s, s.phase === 'seasonEnd' && s.season >= seasons ? { type: 'FINISH' } : bot(s));
    expect(next).not.toBe(s);
    s = next;
  }
  return s;
}

describe('names', () => {
  it('gives every player in a club a different first and last name, with a few foreigners in the league', () => {
    const s = newGame(2, 21);
    for (const c of s.clubs) {
      const finnish = c.squad.map((p) => p.name).filter((n) => !FOREIGN_NAMES.includes(n));
      expect(new Set(finnish.map((n) => n.split(' ')[1])).size).toBe(finnish.length);
      expect(new Set(c.squad.map((p) => p.name)).size).toBe(c.squad.length);
    }
    const foreign = s.clubs.flatMap((c) => c.squad).filter((p) => FOREIGN_NAMES.includes(p.name)).length;
    expect(foreign).toBeGreaterThan(5);
    expect(foreign).toBeLessThan(45);
  });
});

describe('schedule', () => {
  it('is a double round robin', () => {
    const s = newGame(2);
    expect(s.schedule).toHaveLength(ROUNDS);
    const pairs = new Set<string>();
    for (const round of s.schedule) {
      expect(new Set(round.flatMap((f) => [f.home, f.away])).size).toBe(10);
      for (const f of round) pairs.add(`${f.home}-${f.away}`);
    }
    expect(pairs.size).toBe(90);
  });
});

describe('money for form and morale', () => {
  it('sells more tickets to a side on a winning run', () => {
    expect(gateIncome(3, 5, 3)).toBe(gateIncome(3, 5) + 15);
    expect(gateIncome(3, 5, 9)).toBe(gateIncome(3, 5, 5));
    const s = newGame(2, 3);
    const me = s.schedule[0][0].home;
    for (let r = 0; r < 3; r++) {
      const f = s.schedule[r].find((x) => x.home === me || x.away === me)!;
      [f.hg, f.ag] = f.home === me ? [r === 0 ? 0 : 2, 1] : [1, r === 0 ? 0 : 2];
    }
    s.round = 3;
    expect(winStreak(s, me)).toBe(2);
  });

  it('lets a manager pay a match bonus for better morale in the next match', () => {
    let s = newGame(2, 3);
    const me = currentClubId(s);
    const cash = s.clubs[me].cash;
    s = reduce(s, { type: 'MATCH_BONUS' });
    expect(s.clubs[me]).toMatchObject({ cash: cash - MATCH_BONUS_COST, morale: 1 });
    expect(reduce(s, { type: 'MATCH_BONUS' })).toBe(s);
    while (s.phase !== 'matchday') s = reduce(s, bot(s));
    expect(s.clubs[me].morale).toBe(0);
  });
});

describe('cup and European ticket income', () => {
  it('pays every league club in a cup tie, more in later rounds', () => {
    let s = newGame(2, 5);
    for (const id of s.humans) s.clubs[id].cash = 5000;
    while (s.results?.kind !== 'cup') s = reduce(s, bot(s));
    expect(s.cup[0].every((t) => t.gate === cupGate(0))).toBe(true);
    expect(cupGate(4)).toBeGreaterThan(cupGate(0));
  });

  it('makes Europe the jackpot, the top competition most of all', () => {
    expect(euroGate(0, 0)).toBeGreaterThan(euroGate(1, 0));
    expect(euroGate(1, 0)).toBeGreaterThan(euroGate(2, 0));
    expect(euroGate(2, 0)).toBeGreaterThan(cupGate(0));
    expect(euroGate(0, 2)).toBeGreaterThan(euroGate(0, 0));

    let s = newGame(2, 5);
    for (const id of s.humans) s.clubs[id].cash = 5000;
    const top = s.qualified[0][0];
    while (s.results?.kind !== 'euro') s = reduce(s, bot(s));
    const before = s.clubs[top].cash;
    const tie = s.euro[0].rounds[0].find((t) => t.a.clubId === top || t.b.clubId === top)!;
    expect(tie.gate).toBe(euroGate(0, 0));
    expect(before).toBeGreaterThan(0);
  });
});

describe('wages', () => {
  it('are paid every week at the start of the turn, and a lap of the board pays a bonus', () => {
    const start = newGame(2, 3);
    const me = currentClubId(start);
    const weekly = wages(start.clubs[me]);
    expect(weekly).toBeGreaterThan(0);
    const rolled = reduce(start, { type: 'ROLL' });
    expect(rolled.notice!.lines[0]).toContain('Viikon palkat');

    // From the last square any roll completes the lap.
    start.clubs[me].boardPos = BOARD.length - 1;
    const lapped = reduce(start, { type: 'ROLL' });
    expect(lapped.notice!.lines.some((line) => line.includes('kierrosbonuksen'))).toBe(true);
    expect(lapped.clubs[me].boardPos).toBeLessThan(6);
  });
});

describe('ticket income', () => {
  it('pays the home club and grows with league position', () => {
    expect(gateIncome(1, 2)).toBeGreaterThan(gateIncome(8, 7));
    let s = newGame(2, 7);
    const before = s.clubs.map((c) => c.cash);
    while (s.phase !== 'matchday') s = reduce(s, bot(s));
    for (const f of s.schedule[0]) {
      const events = f.events!;
      expect(events.filter((e) => e.side === 0 && e.goal)).toHaveLength(f.hg!);
      expect(events.filter((e) => e.side === 1 && e.goal)).toHaveLength(f.ag!);
      expect(events.map((e) => e.side).filter((side) => side === 0)).toHaveLength(f.chances![0]);
      expect(events.map((e) => e.minute)).toEqual([...events.map((e) => e.minute)].sort((a, b) => a - b));
      expect(events.every((e) => e.minute >= 1 && e.minute <= 95)).toBe(true);
      expect(f.chances![0]).toBeGreaterThanOrEqual(f.hg!);
      expect(f.chances![1]).toBeGreaterThanOrEqual(f.ag!);
      expect(f.gate).toBeGreaterThan(0);
      if (!s.clubs[f.home].human) expect(s.clubs[f.home].cash).toBe(before[f.home] + f.gate!);
    }
  });
});

describe('cards', () => {
  const find = (kind: string, extra: (i: number) => boolean = () => true) =>
    CARDS.findIndex((c, i) => c.kind === kind && extra(i));

  it.each(CARDS.map((c, i) => [i, c.kind]))('card %i (%s) can be played and the turn finished', (index) => {
    let s = playCardNow(newGame(3, 9), index);
    expect(s.notice!.lines.length).toBeGreaterThan(0);
    for (let i = 0; i < 50 && s.pending; i++) s = reduce(s, bot(s));
    expect(s.pending).toBeNull();
    for (let i = 0; i < 30 && s.clubs[currentClubId(s)].cash < 0; i++) s = reduce(s, bot(s));
    expect(reduce(s, { type: 'END_TURN' }).order).toHaveLength(2);
  });

  it('draws from a shuffled deck without repeats', () => {
    let s = newGame(2, 3);
    while (s.deck.length === 0) s = reduce(s, bot(s));
    expect(s.deck).toHaveLength(CARDS.length - 1);
    expect(new Set(s.deck).size).toBe(s.deck.length);
  });

  it('keeps windfall auctions from the leader and lets a sponsor back the manager who is last', () => {
    const index = find('auction', (i) => (CARDS[i] as { subsidy: number }).subsidy > 0);
    const start = newGame(3, 9);
    const [best, , worst] = standing(start);
    let s = playCardNow(start, index);
    if (s.pending?.kind !== 'auction') throw new Error('expected an auction');
    // The best-placed manager is left out, and the sponsor backs the worst-placed one.
    expect(s.pending.active).not.toContain(best);
    expect(s.pending.subsidy).toEqual({ club: worst, amount: 30 });
    const bid = s.pending.minBid;
    const cash = s.clubs[worst].cash;
    while (s.pending?.kind === 'auction') {
      const bidder = s.pending.active[s.pending.idx];
      s = reduce(s, bidder === worst && s.pending.leader === null ? { type: 'BID', amount: bid } : { type: 'PASS' });
    }
    expect(s.clubs[worst].cash).toBe(cash - bid + 30);
  });

  it('gives temporary form that wears off after the stated number of league rounds', () => {
    const index = CARDS.findIndex((c) => c.kind === 'form' && c.amount === 3 && c.matches === 2);
    let s = playCardNow(newGame(2, 9), index);
    const me = currentClubId(s);
    const player = s.clubs[me].squad.find((p) => p.form)!;
    expect(level(player)).toBe(Math.min(MAX_LEVEL, player.skill + 3));
    const find = () => s.clubs[me].squad.find((p) => p.id === player.id)!;
    for (const left of [1, undefined]) {
      const round = s.round;
      while (s.round === round || s.phase === 'matchday') s = reduce(s, bot(s));
      expect(find().form?.matches).toBe(left);
    }
    expect(find().skill).toBe(player.skill);
  });

  it('can also pull a player down', () => {
    const s = playCardNow(newGame(2, 9), CARDS.findIndex((c) => c.kind === 'form' && c.amount < 0));
    const player = s.clubs[currentClubId(s)].squad.find((p) => p.form)!;
    expect(level(player)).toBeLessThan(player.skill);
  });

  it('makes a starter leave for his full value', () => {
    const start = newGame(2, 9);
    const me = currentClubId(start);
    const starters = lineup(start.clubs[me]).slots.map((x) => x.player!);
    const s = playCardNow(start, find('leave'));
    const gone = start.clubs[me].squad.filter((p) => !s.clubs[me].squad.some((q) => q.id === p.id));
    expect(gone).toHaveLength(1);
    expect(starters.some((p) => p.id === gone[0].id)).toBe(true);
    expect(s.clubs[me].cash).toBe(start.clubs[me].cash + playerValue(gone[0].skill, gone[0].spirit));
  });

  it('has bad luck that finds the leaders', () => {
    const start = newGame(3, 9);
    const drawer = currentClubId(start);
    const leader = [...start.humans].sort((a, b) => table(start).findIndex((r) => r.id === a) - table(start).findIndex((r) => r.id === b))[0];
    const star = [...start.clubs[leader].squad].sort((a, b) => b.skill - a.skill || b.spirit - a.spirit)[0];
    const raided = playCardNow(start, find('raid'));
    expect(raided.clubs[leader].squad.some((p) => p.id === star.id)).toBe(false);
    expect(raided.clubs[leader].cash).toBe(start.clubs[leader].cash + Math.round(playerValue(star.skill, star.spirit) / 2));

    const expired = playCardNow(start, find('expire'));
    expect(expired.clubs[drawer].squad).toHaveLength(start.clubs[drawer].squad.length - 1);
    expect(expired.clubs[drawer].cash).toBe(start.clubs[drawer].cash);

    const out = playCardNow(start, find('leaderOut'));
    expect(out.clubs[leader].squad.find((p) => p.id === star.id)!.out).toBeGreaterThan(0);

    const last = standing(start)[2];
    const gifted = playCardNow(start, find('prodigy'));
    expect(gifted.clubs[last].squad).toHaveLength(start.clubs[last].squad.length + 1);
    expect(gifted.clubs[last].squad.at(-1)!.skill).toBeGreaterThanOrEqual(6);

    const drawn = playCardNow(start, find('luckyDraw'));
    expect(drawn.clubs[drawer].squad).toHaveLength(start.clubs[drawer].squad.length + 1);

    start.clubs[start.humans[2]].cash = 1000;
    const taxed = playCardNow(start, find('wealthTax'));
    expect(taxed.clubs[start.humans[2]].cash).toBe(850);
  });

  it('auctions the best player when his contract is re-negotiated', () => {
    const start = playCardNow(newGame(3, 9), find('renegotiate'));
    if (start.pending?.kind !== 'auction') throw new Error('expected an auction');
    const owner = start.pending.owner!;
    const star = start.pending.player;
    const bid = start.pending.minBid;
    expect(star.skill).toBe(Math.max(...start.clubs[owner].squad.map((p) => p.skill)));
    expect(reduce(start, { type: 'SELL', playerId: star.id })).toBe(start);

    // The owner bids and the others pass: he keeps the player and pays for the new contract.
    let kept = reduce(start, { type: 'BID', amount: bid });
    while (kept.pending) kept = reduce(kept, { type: 'PASS' });
    expect(kept.clubs[owner].squad.some((p) => p.id === star.id)).toBe(true);
    expect(kept.clubs[owner].cash).toBe(start.clubs[owner].cash - bid);

    // The owner passes and a rival bids: the player moves and the owner is paid.
    let lost = reduce(start, { type: 'PASS' });
    if (lost.pending?.kind !== 'auction') throw new Error('expected an auction');
    const rival = lost.pending.active[lost.pending.idx];
    lost = reduce(lost, { type: 'BID', amount: bid });
    while (lost.pending) lost = reduce(lost, { type: 'PASS' });
    expect(lost.clubs[owner].squad.some((p) => p.id === star.id)).toBe(false);
    expect(lost.clubs[rival].squad.some((p) => p.id === star.id)).toBe(true);
    expect(lost.clubs[owner].cash).toBe(start.clubs[owner].cash + bid);
    expect(lost.clubs[rival].cash).toBe(start.clubs[rival].cash - bid);

    // Nobody bids: he stays where he is.
    let nobody = start;
    while (nobody.pending) nobody = reduce(nobody, { type: 'PASS' });
    expect(nobody.clubs[owner].squad.some((p) => p.id === star.id)).toBe(true);
  });

  it('lets a manager who is not leading steal a player from any other club', () => {
    const base = newGame(3, 9);
    // The best-placed manager draws it in vain; move the turn to another manager to use it.
    const leader = standing(base)[0];
    const blocked = structuredClone(base);
    blocked.order = [leader, ...base.humans.filter((id) => id !== leader)];
    expect(playCardNow(blocked, find('steal')).pending).toBeNull();
    base.order = [...base.humans.filter((id) => id !== leader), leader];
    const me = currentClubId(base);
    const s = playCardNow(base, find('steal'));
    expect(s.pending).toEqual({ kind: 'steal' });
    const victim = s.clubs.find((c) => c.id !== me && !c.human)!;
    const target = victim.squad[0];
    expect(reduce(s, { type: 'STEAL', clubId: me, playerId: s.clubs[me].squad[0].id })).toBe(s);
    const done = reduce(s, { type: 'STEAL', clubId: victim.id, playerId: target.id });
    expect(done.pending).toBeNull();
    expect(done.clubs[me].squad.some((p) => p.id === target.id)).toBe(true);
    expect(done.clubs[victim.id].squad.some((p) => p.id === target.id)).toBe(false);
    expect(done.clubs[me].cash).toBe(s.clubs[me].cash);
  });

  it('gives a free training camp', () => {
    let s = playCardNow(newGame(2, 9), find('freeTraining'));
    s.clubs[currentClubId(s)].cash = -50; // even a club in debt can use it
    const me = s.clubs[currentClubId(s)];
    const player = me.squad[0];
    s = reduce(s, { type: 'TRAIN', playerId: player.id });
    const after = s.clubs[me.id];
    expect(after.cash).toBe(me.cash);
    expect(after.squad[0].skill).toBe(player.skill + 1);
  });

  it('moves to the nearest square of the kind the card names', () => {
    const start = newGame(2, 9);
    const s = playCardNow(start, find('goto'));
    const pos = s.clubs[currentClubId(s)].boardPos;
    expect(BOARD[pos]).toBe('training');
    expect(pos).toBe(BOARD.indexOf('training'));
    expect(s.pending).toEqual({ kind: 'training', free: false });
  });

  it('pays the birthday gift from every other manager', () => {
    const start = newGame(4, 9);
    const s = playCardNow(start, find('collect'));
    const me = currentClubId(s);
    expect(s.clubs[me].cash).toBe(start.clubs[me].cash + 30);
    expect(s.humans.filter((id) => id !== me).every((id) => s.clubs[id].cash === start.clubs[id].cash - 10)).toBe(true);
  });
});

describe('match model', () => {
  const side = (level: number, formation: FormationId = '4-4-2') => {
    const shape = FORMATIONS[formation];
    return { att: shape.HY * level, mid: shape.KK * level, def: shape.PU * level, gk: level, spirit: 5, shape };
  };

  it('plays the same at every level when the sides are evenly matched', () => {
    expect(scoringOdds(side(3), side(3))).toBeCloseTo(scoringOdds(side(8), side(8)));
    expect(expectedChances(side(3, '3-5-2'), side(3))).toBeCloseTo(expectedChances(side(8, '3-5-2'), side(8)));
  });

  it('rewards better forwards, defenders and midfield', () => {
    expect(scoringOdds({ ...side(5), att: 13 }, side(5))).toBeGreaterThan(scoringOdds(side(5), side(5)));
    expect(scoringOdds(side(5), { ...side(5), def: 24 })).toBeLessThan(scoringOdds(side(5), side(5)));
    expect(expectedChances({ ...side(5), mid: 24 }, side(5))).toBeGreaterThan(expectedChances(side(5), side(5)));
  });

  it('lets formations counter each other', () => {
    // Three forwards overload a back three but are held by a back five.
    expect(scoringOdds(side(5, '3-4-3'), side(5, '3-5-2'))).toBeGreaterThan(scoringOdds(side(5, '3-4-3'), side(5, '4-4-2')));
    expect(scoringOdds(side(5, '3-4-3'), side(5, '5-3-2'))).toBeLessThan(scoringOdds(side(5, '3-4-3'), side(5, '4-4-2')));
    expect(duel(FORMATIONS['4-5-1'], FORMATIONS['5-3-2'])).toBeLessThan(duel(FORMATIONS['4-5-1'], FORMATIONS['4-4-2']) - 0.45);
    // An open formation gives both sides more chances, a closed one fewer.
    const base = expectedChances(side(5), side(5));
    expect(expectedChances(side(5), { ...side(5), shape: { ...FORMATIONS['4-4-2'], style: 1 } })).toBeGreaterThan(base);
    expect(expectedChances({ ...side(5), shape: { ...FORMATIONS['4-4-2'], style: -1 } }, side(5))).toBeLessThan(base);
  });

  it('never lets a player go above the maximum level', () => {
    const s = playOut(newGame(3, 5), 2);
    expect(Math.max(...s.clubs.flatMap((c) => c.squad.map((p) => p.skill)))).toBeLessThanOrEqual(MAX_LEVEL);
  });
});

describe('debt', () => {
  const inDebt = (humans: number, squadSize: number) => {
    const s = playCardNow(newGame(humans, 9), CARDS.findIndex((c) => c.kind === 'morale'));
    const me = s.clubs[currentClubId(s)];
    me.cash = -30;
    me.squad.length = squadSize;
    return s;
  };

  it('does not let a manager in debt end his turn until he has sold enough', () => {
    let s = inDebt(2, 14);
    const me = currentClubId(s);
    expect(reduce(s, { type: 'END_TURN' })).toBe(s);
    expect(reduce(s, { type: 'BANKRUPT' })).toBe(s);
    while (s.clubs[me].cash < 0) s = reduce(s, { type: 'SELL', playerId: s.clubs[me].squad[0].id });
    expect(currentClubId(reduce(s, { type: 'END_TURN' }))).not.toBe(me);
  });

  it('lets a manager sell in the middle of an offer to raise the money', () => {
    let s = playCardNow(newGame(3, 9), CARDS.findIndex((c) => c.kind === 'auction'));
    if (s.pending?.kind !== 'auction') throw new Error('expected an auction');
    const bidder = s.clubs[s.pending.active[s.pending.idx]];
    bidder.cash = 0;
    const min = s.pending.minBid;
    expect(reduce(s, { type: 'BID', amount: min })).toBe(s);
    const sold = [...bidder.squad].sort((a, b) => b.skill - a.skill).slice(0, 3);
    for (const p of sold) s = reduce(s, { type: 'SELL', playerId: p.id });
    expect(s.pending?.kind).toBe('auction');
    expect(s.clubs[bidder.id].squad).toHaveLength(bidder.squad.length - 3);
    const after = reduce(s, { type: 'BID', amount: min });
    expect(after.pending?.kind === 'auction' && after.pending.leader).toBe(bidder.id);

    let scout = playCardNow(newGame(2, 9), CARDS.findIndex((c) => c.kind === 'goto' && c.square === 'scout'));
    const me = scout.clubs[currentClubId(scout)];
    scout = reduce(scout, { type: 'SELL', playerId: me.squad[0].id });
    expect(scout.pending?.kind).toBe('scout');
    expect(scout.clubs[me.id].squad).toHaveLength(me.squad.length - 1);
  });

  it('never lets a squad be sold below eleven', () => {
    const s = inDebt(2, MIN_SQUAD);
    expect(reduce(s, { type: 'SELL', playerId: s.clubs[currentClubId(s)].squad[0].id })).toBe(s);
  });

  it('puts a manager with eleven players and debts out of the game', () => {
    const before = inDebt(3, MIN_SQUAD);
    const me = currentClubId(before);
    const s = reduce(before, { type: 'BANKRUPT' });
    expect(s.humans).not.toContain(me);
    expect(s.bankrupt).toEqual([me]);
    expect(s.clubs[me]).toMatchObject({ human: false, bankrupt: true, cash: 0 });
    expect(s.clubs[me].squad.length).toBeGreaterThanOrEqual(14);
    expect(s.order).toHaveLength(2);
    expect(playOut(s).phase).toBe('gameOver');
  });

  it('ends the game when the last manager goes bankrupt', () => {
    let s = inDebt(2, MIN_SQUAD);
    s = reduce(s, { type: 'BANKRUPT' });
    s = playCardNow(s, CARDS.findIndex((c) => c.kind === 'morale'));
    const last = s.clubs[currentClubId(s)];
    last.cash = -1;
    last.squad.length = MIN_SQUAD;
    s = reduce(s, { type: 'BANKRUPT' });
    expect(s.phase).toBe('gameOver');
    expect(s.bankrupt).toHaveLength(2);
  });
});

describe('fitness and sisu', () => {
  it('makes a tired player play below his skill and drop out of the eleven', () => {
    const club = newGame(2).clubs[0];
    const keeper = lineup(club).slots[0].player!;
    const other = club.squad.find((p) => p.pos === 'MV' && p.id !== keeper.id)!;
    other.skill = keeper.skill;
    keeper.fitness = 3;
    expect(level(keeper)).toBe(keeper.skill - 1);
    expect(lineup(club).slots[0].player!.id).toBe(other.id);
    keeper.fitness = 1;
    expect(level(keeper)).toBe(Math.max(1, keeper.skill - 2));
  });

  it('keeps league starters level, rests the bench and wears down cup starters', () => {
    let s = newGame(2, 4);
    const starters = new Set(lineup(s.clubs[0]).slots.map((x) => x.player!.id));
    for (const p of s.clubs[0].squad) p.fitness = 5;
    while (s.phase !== 'matchday') s = reduce(s, bot(s));
    const stillThere = s.clubs[0].squad.filter((p) => starters.has(p.id));
    expect(stillThere.some((p) => p.fitness === 5)).toBe(true);
    expect(s.clubs[0].squad.some((p) => !starters.has(p.id) && p.fitness === 8)).toBe(true);

    // Round 2 is followed by the cup's first round: every league club plays twice that week.
    while (s.results?.kind !== 'cup') s = reduce(s, bot(s));
    const inCup = s.cup[0].flatMap((t) => [t.a.clubId, t.b.clubId]);
    expect(s.clubs.filter((c) => inCup.includes(c.id)).every((c) => c.squad.some((p) => p.fitness <= 6))).toBe(true);
  });

  it('lets a manager rest a player for one week', () => {
    let s = newGame(2, 4);
    const me = currentClubId(s);
    const star = lineup(s.clubs[me]).slots[1].player!;
    s.clubs[me].squad.find((p) => p.id === star.id)!.fitness = 6;
    s = reduce(s, { type: 'REST', playerId: star.id });
    expect(lineup(s.clubs[me]).slots.some((x) => x.player?.id === star.id)).toBe(false);
    expect(reduce(reduce(s, { type: 'REST', playerId: star.id }), { type: 'REST', playerId: star.id })).toEqual(s);

    while (s.phase !== 'matchday') s = reduce(s, bot(s));
    const after = s.clubs[me].squad.find((p) => p.id === star.id);
    if (after) {
      expect(after.fitness).toBe(9);
      expect(after.resting).toBeUndefined();
    }
  });

  it('gives a gritty side a stoppage-time chance more often, and a card can promise one', () => {
    const side = (spirit: number) => ({ att: 10, mid: 20, def: 20, gk: 5, spirit, shape: FORMATIONS['4-4-2'] });
    expect(stoppageOdds(side(3))).toBe(0);
    expect(stoppageOdds(side(7))).toBeGreaterThan(stoppageOdds(side(5)));
    expect(stoppageOdds(side(9))).toBe(0.5);

    let s = playCardNow(newGame(2, 4), CARDS.findIndex((c) => c.kind === 'surge'));
    const me = currentClubId(s);
    expect(s.clubs[me].surge).toBe(true);
    while (s.phase !== 'matchday') s = reduce(s, bot(s));
    const match = s.schedule[0].find((f) => f.home === me || f.away === me)!;
    expect(match.events!.some((e) => e.minute > 90 && e.side === (match.home === me ? 0 : 1))).toBe(true);
    expect(s.clubs[me].surge).toBeUndefined();
  });

  it('counts sisu only in a tough spot', () => {
    const side = (spirit: number, lvl = 5) => ({ att: 2 * lvl, mid: 4 * lvl, def: 4 * lvl, gk: lvl, spirit, shape: FORMATIONS['4-4-2'] });
    expect(spiritBonus(side(8), side(5), false)).toBe(0);
    expect(spiritBonus(side(8), side(5), true)).toBeGreaterThan(0);
    expect(spiritBonus(side(2), side(5), true)).toBeLessThan(0);
    expect(spiritBonus(side(8, 4), side(5, 6), false)).toBeGreaterThan(0);
    expect(shootoutOdds(side(8), side(4))).toBeGreaterThan(0.5);
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

describe('calendar', () => {
  it('gives every cup and European round a week of its own', () => {
    let s = newGame(2, 5);
    for (const id of s.humans) s.clubs[id].cash = 5000; // nobody goes bankrupt before the season is over
    expect(s.calendar.filter((w) => w.kind === 'league')).toHaveLength(ROUNDS);
    expect(s.calendar.filter((w) => w.kind === 'cup').map((w) => w.index)).toEqual([0, 1, 2, 3, 4]);
    expect(s.calendar.filter((w) => w.kind === 'euro').map((w) => w.index)).toEqual([0, 1, 2]);

    const seen: string[] = [];
    while (s.phase !== 'seasonEnd') {
      if (s.phase === 'matchday' && s.results) {
        seen.push(s.results.kind);
        // Managers take a turn before every week's matches, and a cup week leaves the league table alone.
        if (s.results.kind !== 'league') expect(table(s).every((r) => r.p === s.round)).toBe(true);
      }
      s = reduce(s, bot(s));
    }
    expect(seen).toHaveLength(ROUNDS + 5 + 3);
    expect(seen.slice(0, 4)).toEqual(['league', 'league', 'cup', 'league']);
  });
});

describe('cup', () => {
  it('starts with all ten league clubs and 22 weaker lower-division clubs', () => {
    const entrants = newGame(2).cup[0].flatMap((t) => [t.a, t.b]);
    expect(entrants).toHaveLength(32);
    expect(new Set(entrants.map((e) => e.clubId).filter((id) => id !== null)).size).toBe(10);
    const lower = entrants.filter((e) => e.clubId === null);
    expect(new Set(lower.map((e) => e.name)).size).toBe(22);
    for (const division of [2, 3] as const) {
      const clubs = lower.filter((e) => e.division === division);
      expect(clubs).toHaveLength(11);
      expect(clubs.every((e) => e.level >= LOWER_LEVELS[division][0] && e.level <= LOWER_LEVELS[division][1])).toBe(true);
    }
  });

  it('gives clubs without a European tie that week their fitness back', () => {
    let s = newGame(2, 6);
    while (s.results?.kind !== 'euro') s = reduce(s, bot(s));
    expect(s.round).toBe(EURO_AFTER[0] + 1);
    for (const id of s.humans) expect(s.clubs[id].squad.every((p) => p.fitness === 9)).toBe(true);
  });
});

describe('ending the game', () => {
  it('goes on for as long as the managers want and is decided by cash plus squad value', () => {
    let s = newGame(2, 8);
    for (const id of s.humans) s.clubs[id].cash = 5000;
    while (s.phase !== 'seasonEnd') s = reduce(s, bot(s));
    expect(reduce(s, { type: 'CONTINUE' }).season).toBe(2);
    expect(reduce(s, { type: 'ROLL' })).toBe(s);

    const done = reduce(s, { type: 'FINISH' });
    expect(done.phase).toBe('gameOver');
    const club = done.clubs[done.humans[0]];
    expect(wealth(club)).toBe(club.cash + club.squad.reduce((sum, p) => sum + playerValue(p.skill, p.spirit), 0));
    expect(reduce(newGame(2), { type: 'FINISH' }).phase).toBe('roll');
  });
});

describe('full game', () => {
  it.each([2, 4, 6])('finishes with %i managers', (humans) => {
    const start = newGame(humans, humans);
    for (const id of start.humans) start.clubs[id].cash = 5000; // rich enough that nobody drops out early
    const s = playOut(start, 2);
    expect(s.phase).toBe('gameOver');
    expect(s.season).toBe(2);
    expect(table(s).every((r) => r.p === ROUNDS)).toBe(true);
    expect(s.cup.map((round) => round.length)).toEqual([16, 8, 4, 2, 1]);
    expect(s.cup[4][0].winner).not.toBeNull();
    for (const t of [...s.cup.flat(), ...s.euro.flatMap((c) => c.rounds.flat())]) {
      expect(t.ag).not.toBe(t.bg);
      if (t.pens) expect(Math.abs(t.ag! - t.bg!)).toBe(1);
      expect(t.winner).toBe(t.ag! > t.bg! ? 'a' : 'b');
    }
  });

  it('sends the top four to Europe from the second season on', () => {
    let s = newGame(3, 11);
    for (const id of s.humans) s.clubs[id].cash = 9000; // nobody drops out before the second season is over
    const first = s.euro.flatMap((comp) => comp.rounds[0].flatMap((t) => [t.a.clubId, t.b.clubId])).filter((id) => id !== null);
    expect(first).toHaveLength(4);
    expect(first.every((id) => !s.clubs[id].human)).toBe(true);
    while (s.phase !== 'seasonEnd') s = reduce(s, bot(s));
    const top = s.seasonSummary!.map((row) => row.id);
    const cashBefore = s.clubs[top[0]].cash;
    s = reduce(s, { type: 'CONTINUE' });
    expect(s.clubs[top[0]].cash).toBe(cashBefore + EURO_COMPS[0].entry);
    const entrants = s.euro.map((comp) => comp.rounds[0].flatMap((t) => [t.a.clubId, t.b.clubId]).filter((id) => id !== null));
    expect(entrants).toEqual([[top[0]], [top[1]], [top[2], top[3]]]);

    s = playOut(s, 2);
    for (const comp of s.euro) {
      expect(comp.rounds.map((r) => r.length)).toEqual([4, 2, 1]);
      expect(comp.rounds[2][0].winner).not.toBeNull();
    }
  });

  it('is deterministic for a seed', () => {
    expect(playOut(newGame(3, 42))).toEqual(playOut(newGame(3, 42)));
  });

  it('keeps the economy playable', () => {
    const cash: number[] = [];
    for (let seed = 1; seed <= 12; seed++) {
      const s = playOut(newGame(4, seed));
      for (const id of s.humans) cash.push(s.clubs[id].cash);
    }
    const mean = cash.reduce((a, b) => a + b, 0) / cash.length;
    const inDebt = cash.filter((c) => c < 0).length / cash.length;
    console.log(`mean cash ${mean.toFixed(0)}, min ${Math.min(...cash)}, max ${Math.max(...cash)}, in debt ${(inDebt * 100).toFixed(0)} %`);
    expect(inDebt).toBeLessThan(0.15);
  });
});
