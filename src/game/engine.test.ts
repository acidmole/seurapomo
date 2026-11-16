import { describe, expect, it } from 'vitest';
import { BOARD, CARDS, EURO_COMPS, FOREIGN_NAMES, LOWER_LEVELS, FORMATIONS, HUMAN_COLORS, type FormationId } from './data';
import {
  EURO_AFTER, MAX_LEVEL, MAX_SQUAD, MIN_SQUAD, ROUNDS, createGame, currentClubId, expectedChances, gateIncome, level, lineup, playCardNow, scoringOdds, shootoutOdds, spiritBonus, playerValue, reduce, table, trainingCost,
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
    const wants = bidder.squad.length < MAX_SQUAD && min <= bidder.cash && min <= playerValue(p.player.skill, p.player.spirit);
    return wants ? { type: 'BID', amount: min } : { type: 'PASS' };
  }
  const me = club(currentClubId(s));
  if (p?.kind === 'scout') {
    const index = me.squad.length < MAX_SQUAD ? p.options.findIndex((o) => playerValue(o.skill, o.spirit) + 100 <= me.cash) : -1;
    return index >= 0 ? { type: 'SCOUT_BUY', index } : { type: 'SKIP' };
  }
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

function playOut(s: GameState): GameState {
  for (let i = 0; i < 20000 && s.phase !== 'gameOver'; i++) {
    const next = reduce(s, bot(s));
    expect(next).not.toBe(s);
    s = next;
  }
  return s;
}

describe('names', () => {
  it('gives every player in a club a different first and last name, with a few foreigners in the league', () => {
    const s = newGame(2, 1, 21);
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

describe('ticket income', () => {
  it('pays the home club and grows with league position', () => {
    expect(gateIncome(1, 2)).toBeGreaterThan(gateIncome(8, 7));
    let s = newGame(2, 1, 7);
    const before = s.clubs.map((c) => c.cash);
    while (s.phase !== 'matchday') s = reduce(s, bot(s));
    for (const f of s.schedule[0]) {
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
    let s = playCardNow(newGame(3, 1, 9), index);
    expect(s.notice!.lines.length).toBeGreaterThan(0);
    for (let i = 0; i < 50 && s.pending; i++) s = reduce(s, bot(s));
    expect(s.pending).toBeNull();
    for (let i = 0; i < 30 && s.clubs[currentClubId(s)].cash < 0; i++) s = reduce(s, bot(s));
    expect(reduce(s, { type: 'END_TURN' }).order).toHaveLength(2);
  });

  it('draws from a shuffled deck without repeats', () => {
    let s = newGame(2, 1, 3);
    while (s.deck.length === 0) s = reduce(s, bot(s));
    expect(s.deck).toHaveLength(CARDS.length - 1);
    expect(new Set(s.deck).size).toBe(s.deck.length);
  });

  it('lets a sponsor pay part of the price only for the club that drew the card', () => {
    const index = find('auction', (i) => (CARDS[i] as { subsidy: number }).subsidy > 0);
    let s = playCardNow(newGame(2, 1, 9), index);
    const me = currentClubId(s);
    const cash = s.clubs[me].cash;
    if (s.pending?.kind !== 'auction') throw new Error('expected an auction');
    const bid = s.pending.minBid;
    s = reduce(s, { type: 'BID', amount: bid });
    s = reduce(s, { type: 'PASS' });
    expect(s.pending).toBeNull();
    expect(s.clubs[me].cash).toBe(cash - bid + 30);
  });

  it('gives temporary form that wears off after the stated number of league rounds', () => {
    const index = CARDS.findIndex((c) => c.kind === 'form' && c.amount === 3 && c.matches === 2);
    let s = playCardNow(newGame(2, 1, 9), index);
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
    const s = playCardNow(newGame(2, 1, 9), CARDS.findIndex((c) => c.kind === 'form' && c.amount < 0));
    const player = s.clubs[currentClubId(s)].squad.find((p) => p.form)!;
    expect(level(player)).toBeLessThan(player.skill);
  });

  it('makes a starter leave for his full value', () => {
    const start = newGame(2, 1, 9);
    const me = currentClubId(start);
    const starters = lineup(start.clubs[me]).slots.map((x) => x.player!);
    const s = playCardNow(start, find('leave'));
    const gone = start.clubs[me].squad.filter((p) => !s.clubs[me].squad.some((q) => q.id === p.id));
    expect(gone).toHaveLength(1);
    expect(starters.some((p) => p.id === gone[0].id)).toBe(true);
    expect(s.clubs[me].cash).toBe(start.clubs[me].cash + playerValue(gone[0].skill, gone[0].spirit));
  });

  it('gives a free training camp', () => {
    let s = playCardNow(newGame(2, 1, 9), find('freeTraining'));
    s.clubs[currentClubId(s)].cash = -50; // even a club in debt can use it
    const me = s.clubs[currentClubId(s)];
    const player = me.squad[0];
    s = reduce(s, { type: 'TRAIN', playerId: player.id });
    const after = s.clubs[me.id];
    expect(after.cash).toBe(me.cash);
    expect(after.squad[0].skill).toBe(player.skill + 1);
  });

  it('moves to the nearest square of the kind the card names', () => {
    const start = newGame(2, 1, 9);
    const s = playCardNow(start, find('goto'));
    const pos = s.clubs[currentClubId(s)].boardPos;
    expect(BOARD[pos]).toBe('training');
    expect(pos).toBe(BOARD.indexOf('training'));
    expect(s.pending).toEqual({ kind: 'training', free: false });
  });

  it('pays the birthday gift from every other manager', () => {
    const start = newGame(4, 1, 9);
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

  it('never lets a player go above the maximum level', () => {
    const s = playOut(newGame(3, 2, 5));
    expect(Math.max(...s.clubs.flatMap((c) => c.squad.map((p) => p.skill)))).toBeLessThanOrEqual(MAX_LEVEL);
  });
});

describe('debt', () => {
  const inDebt = (humans: number, squadSize: number) => {
    const s = playCardNow(newGame(humans, 1, 9), CARDS.findIndex((c) => c.kind === 'morale'));
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
    let s = playCardNow(newGame(2, 1, 9), CARDS.findIndex((c) => c.kind === 'auction'));
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

    let scout = playCardNow(newGame(2, 1, 9), CARDS.findIndex((c) => c.kind === 'goto' && c.square === 'scout'));
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
    let s = newGame(2, 1, 4);
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
    let s = newGame(2, 1, 5);
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
    let s = newGame(2, 1, 6);
    while (s.results?.kind !== 'euro') s = reduce(s, bot(s));
    expect(s.round).toBe(EURO_AFTER[0] + 1);
    for (const id of s.humans) expect(s.clubs[id].squad.every((p) => p.fitness === 9)).toBe(true);
  });
});

describe('full game', () => {
  it.each([2, 4, 6])('finishes with %i managers', (humans) => {
    const start = newGame(humans, 2, humans);
    for (const id of start.humans) start.clubs[id].cash = 5000; // rich enough that nobody drops out early
    const s = playOut(start);
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
    let s = newGame(3, 2, 11);
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

    s = playOut(s);
    for (const comp of s.euro) {
      expect(comp.rounds.map((r) => r.length)).toEqual([4, 2, 1]);
      expect(comp.rounds[2][0].winner).not.toBeNull();
    }
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
