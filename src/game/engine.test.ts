import { describe, expect, it } from 'vitest';
import { AI_CLUB_NAMES, BOARD, CARDS, EURO_COMPS, FOREIGN_NAMES, LOWER_LEVELS, FORMATIONS, HUMAN_COLORS, type FormationId } from './data';
import { botAction, botStep, botToMove } from './bot';
import {
  EURO_AFTER, LOAN_MAX, LOAN_STEP, MATCH_BONUS_COST, MAX_LEVEL, MAX_SQUAD, MIN_SQUAD, ROUNDS, createGame, cupGate, currentClubId, duel, euroGate, expectedChances, gateIncome, level, lineup, playCardNow, scoringOdds, shootoutOdds, spiritBonus, standing, stoppageOdds, lateChanceOdds, thisWeek, topScorers, GOLDEN_BOOT_PRIZE, LEAGUE_PRIZE, MENTAL_COST, SCORER_SHARE, isBroke, loanInterest, plays, posBadge, UTILITY_SHARE, valueOf, wages, wealth, winStreak, playerValue, reduce, table, trainingCost,
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
  if (p?.kind === 'release') return { type: 'SELL', playerId: [...club(p.club).squad].sort((a, b) => a.skill - b.skill)[0].id };
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
  if (p?.kind === 'steal' || p?.kind === 'mental') return { type: 'SKIP' };
  if (p?.kind === 'crisis') return { type: 'CRISIS', pay: false };
  if (p?.kind === 'windfall') return { type: 'WINDFALL', keep: true };
  if (p?.kind === 'training') {
    const best = [...me.squad].sort((a, b) => b.skill - a.skill).find((x) => x.skill < MAX_LEVEL && trainingCost(x) <= me.cash);
    return best ? { type: 'TRAIN', playerId: best.id } : { type: 'SKIP' };
  }
  if (s.phase === 'roll') return { type: 'ROLL' };
  if (s.phase === 'manage' && me.cash < 0) {
    if (me.squad.length <= MIN_SQUAD) return me.loan < LOAN_MAX ? { type: 'BORROW' } : { type: 'BANKRUPT' };
    return { type: 'SELL', playerId: [...me.squad].sort((a, b) => a.skill - b.skill)[0].id };
  }
  if (s.phase === 'manage') return { type: 'END_TURN' };
  return { type: 'CONTINUE' };
}

/** Lets the test managers play until `done`. Fails instead of hanging if the game stops moving first. */
function until(s: GameState, done: (s: GameState) => boolean): GameState {
  for (let i = 0; !done(s); i++) {
    const next = reduce(s, bot(s));
    if (next === s || i > 40000) throw new Error(`the game stopped in phase ${s.phase} before the test got where it was going`);
    s = next;
  }
  return s;
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
      expect(new Set(finnish.map((n) => n.split(' ').pop())).size).toBe(finnish.length);
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
    s = until(s, (s) => !(s.phase !== 'matchday'));
    expect(s.clubs[me].morale).toBe(0);
  });
});

describe('cup and European ticket income', () => {
  it('pays every league club in a cup tie, more in later rounds', () => {
    let s = newGame(2, 5);
    for (const id of s.humans) s.clubs[id].cash = 5000;
    s = until(s, (s) => !(s.results?.kind !== 'cup'));
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
    s = until(s, (s) => !(s.results?.kind !== 'euro'));
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
    expect(rolled.notice!.upkeep[0]).toContain('Viikon palkat');

    // From the last square any roll completes the lap.
    start.clubs[me].boardPos = BOARD.length - 1;
    const lapped = reduce(start, { type: 'ROLL' });
    expect(lapped.notice!.upkeep.some((line) => line.includes('kierrosbonuksen'))).toBe(true);
    expect(lapped.clubs[me].boardPos).toBeLessThan(6);
  });
});

describe('ticket income', () => {
  it('pays the home club and grows with league position', () => {
    expect(gateIncome(1, 2)).toBeGreaterThan(gateIncome(8, 7));
    let s = newGame(2, 7);
    const before = s.clubs.map((c) => c.cash);
    s = until(s, (s) => !(s.phase !== 'matchday'));
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
    s = until(s, (s) => !(s.deck.length === 0));
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
    s.clubs[worst].cash = 500;
    const cash = s.clubs[worst].cash;
    for (let i = 0; i < 20 && s.pending?.kind === 'auction'; i++) {
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
      s = until(s, (s) => !(s.round === round || s.phase === 'matchday'));
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
    expect(s.clubs[me].cash).toBe(start.clubs[me].cash + valueOf(gone[0]));
  });

  it('pays half as much again when a foreign club buys a player out of his contract', () => {
    const start = newGame(2, 9);
    const me = currentClubId(start);
    const s = playCardNow(start, CARDS.findIndex((c) => c.kind === 'leave' && c.rate > 1));
    const gone = start.clubs[me].squad.filter((p) => !s.clubs[me].squad.some((q) => q.id === p.id));
    expect(gone).toHaveLength(1);
    const fee = s.clubs[me].cash - start.clubs[me].cash;
    expect(fee).toBe(Math.round((valueOf(gone[0]) * 1.5) / 5) * 5);
    expect(fee).toBeGreaterThan(valueOf(gone[0]));
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


  it('gives FC Jääs its own players, without first names', () => {
    const game = createGame({ seed: 5, clubs: [{ name: 'A', color: '#000' }, { name: 'B', color: '#111' }] });
    const club = game.clubs.find((c) => c.name === 'FC Jääs')!;
    const names = club.squad.map((p) => p.name);
    for (const name of ['Koljonen', 'Maco', 'Siitonen', 'Raski', 'Poikku', 'Pulla', 'Zeeri', 'Kärtsy', 'Viljanen', 'Kossu', 'Tim', 'Kai', 'Piippo']) expect(names).toContain(name);
    expect(club.squad).toHaveLength(14);
    expect(club.squad.find((p) => p.name === 'Pulla')).toMatchObject({ pos: 'KK', also: 'PU' });
    expect(club.squad.filter((p) => p.pos === 'MV').map((p) => p.name).sort()).toEqual(['Poikku', 'Raski']);
    // Koljonen, Kossu, Piippo and one more, plus Pulla, who can drop back from midfield.
    expect(club.squad.filter((p) => p.pos === 'PU' || p.also === 'PU')).toHaveLength(5);
    expect(game.clubs.some((c) => c.name === 'Hanhivaaran Pallo')).toBe(false);
  });
  it('brings the legend to auction once, at half the price and half the wages', () => {
    let s = playCardNow(newGame(3, 9), find('legend'));
    if (s.pending?.kind !== 'auction') throw new Error('expected an auction');
    const leo = s.pending.player;
    expect(leo).toMatchObject({ name: 'Leo Kaukomies', skill: 9, legend: true });
    expect(valueOf(leo)).toBe(Math.round(playerValue(9, leo.spirit) / 2 / 5) * 5);
    expect(s.pending.minBid).toBeLessThan(playerValue(9, leo.spirit) / 3);

    const buyer = s.pending.active[s.pending.idx];
    s.clubs[buyer].cash = 500;
    const wagesBefore = wages(s.clubs[buyer]);
    s = reduce(s, { type: 'BID', amount: s.pending.minBid });
    for (let i = 0; i < 10 && s.pending; i++) s = reduce(s, { type: 'PASS' });
    expect(s.clubs[buyer].squad.some((p) => p.legend)).toBe(true);
    expect(s.legendSigned).toBe(true);
    // Nine levels of skill would normally add 9 × the weekly rate; he adds half of that.
    expect(wages(s.clubs[buyer]) - wagesBefore).toBeLessThanOrEqual(Math.ceil(9 * 0.27 * 0.5) + 1);

    // Once he has a club the card is no longer drawn, and playing it again does nothing.
    expect(playCardNow(s, find('legend')).pending).toBeNull();
    let later = s;
    later.deck = [find('legend')];
    for (let i = 0; i < 400 && later.phase !== 'matchday'; i++) later = reduce(later, bot(later));
    expect(later.clubs.flatMap((c) => c.squad).filter((p) => p.legend)).toHaveLength(1);
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
  /** A manager in debt in the middle of his turn. With eleven players he has also borrowed all the bank will lend. */
  const inDebt = (humans: number, squadSize: number, loan = squadSize <= MIN_SQUAD ? LOAN_MAX : 0) => {
    const s = playCardNow(newGame(humans, 9), CARDS.findIndex((c) => c.kind === 'morale'));
    const me = s.clubs[currentClubId(s)];
    me.cash = -30;
    me.loan = loan;
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
    // Once everyone else has passed, the notice names the club that got the player.
    let done = after;
    while (done.pending?.kind === 'auction') done = reduce(done, { type: 'PASS' });
    expect(done.notice?.buyer).toBe(bidder.id);

    let scout = playCardNow(newGame(2, 9), CARDS.findIndex((c) => c.kind === 'goto' && c.square === 'scout'));
    const me = scout.clubs[currentClubId(scout)];
    scout = reduce(scout, { type: 'SELL', playerId: me.squad[0].id });
    expect(scout.pending?.kind).toBe('scout');
    expect(scout.clubs[me.id].squad).toHaveLength(me.squad.length - 1);
  });

  it('lets a full squad bid, and makes the winner sell a player before the game goes on', () => {
    let s = playCardNow(newGame(3, 9), CARDS.findIndex((c) => c.kind === 'auction'));
    if (s.pending?.kind !== 'auction') throw new Error('expected an auction');
    const bidder = s.clubs[s.pending.active[s.pending.idx]];
    while (bidder.squad.length < MAX_SQUAD) bidder.squad.push({ ...bidder.squad[0], id: 9000 + bidder.squad.length });
    bidder.cash = 500;
    const lot = s.pending.player.id;
    s = reduce(s, { type: 'BID', amount: s.pending.minBid });
    expect(s.pending?.kind === 'auction' && s.pending.leader).toBe(bidder.id);
    while (s.pending?.kind === 'auction') s = reduce(s, { type: 'PASS' });

    // He has the player and one man too many; nothing else moves until he sells somebody.
    expect(s.pending).toEqual({ kind: 'release', club: bidder.id });
    expect(s.clubs[bidder.id].squad).toHaveLength(MAX_SQUAD + 1);
    expect(s.clubs[bidder.id].squad.some((p) => p.id === lot)).toBe(true);
    expect(reduce(s, { type: 'END_TURN' })).toBe(s);
    expect(reduce(s, { type: 'ROLL' })).toBe(s);
    const out = s.clubs[bidder.id].squad[0];
    s = reduce(s, { type: 'SELL', playerId: out.id });
    expect(s.pending).toBeNull();
    expect(s.clubs[bidder.id].squad).toHaveLength(MAX_SQUAD);

    // The computer does the same by itself: it sells its weakest reserve.
    let t = playCardNow(newGame(3, 9), CARDS.findIndex((c) => c.kind === 'auction'));
    t.pending = { kind: 'release', club: currentClubId(t) };
    const c = t.clubs[currentClubId(t)];
    c.auto = true;
    while (c.squad.length <= MAX_SQUAD) c.squad.push({ ...c.squad[0], id: 9500 + c.squad.length });
    expect(botToMove(t)).toBe(true);
    t = botStep(t);
    expect(t.pending).toBeNull();
    expect(t.clubs[c.id].squad).toHaveLength(MAX_SQUAD);
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
    last.loan = LOAN_MAX;
    last.squad.length = MIN_SQUAD;
    s = reduce(s, { type: 'BANKRUPT' });
    expect(s.phase).toBe('gameOver');
    expect(s.bankrupt).toHaveLength(2);
  });
});

describe('bank loan', () => {
  const midTurn = () => playCardNow(newGame(2, 9), CARDS.findIndex((c) => c.kind === 'morale'));

  it('lends in lumps up to a limit and takes them back the same way', () => {
    let s = midTurn();
    const me = currentClubId(s);
    const cash = s.clubs[me].cash;
    for (let i = 1; i <= LOAN_MAX / LOAN_STEP; i++) {
      s = reduce(s, { type: 'BORROW' });
      expect(s.clubs[me]).toMatchObject({ loan: i * LOAN_STEP, cash: cash + i * LOAN_STEP });
    }
    expect(reduce(s, { type: 'BORROW' })).toBe(s);
    s = reduce(s, { type: 'REPAY' });
    expect(s.clubs[me]).toMatchObject({ loan: LOAN_MAX - LOAN_STEP, cash: cash + LOAN_MAX - LOAN_STEP });
    s.clubs[me].cash = LOAN_STEP - 1;
    expect(reduce(s, { type: 'REPAY' })).toBe(s);
  });

  it('charges more for every further lump, on the Fibonacci scale', () => {
    let s = midTurn();
    const me = currentClubId(s);
    const totals: number[] = [];
    for (let i = 0; i < 7; i++) {
      s = reduce(s, { type: 'BORROW' });
      totals.push(loanInterest(s.clubs[me]));
    }
    expect(totals).toEqual([1, 2, 4, 7, 12, 20, 33]);
    expect(reduce(s, { type: 'BORROW' })).toBe(s);
    // Paying a lump back sheds the dearest one first.
    expect(loanInterest(reduce(s, { type: 'REPAY' }).clubs[me])).toBe(20);
  });

  it('counts the loan against a manager\'s wealth', () => {
    const s = midTurn();
    const me = currentClubId(s);
    expect(wealth(reduce(s, { type: 'BORROW' }).clubs[me])).toBe(wealth(s.clubs[me]));
    s.clubs[me].loan = 50;
    expect(wealth(s.clubs[me])).toBe(s.clubs[me].cash + s.clubs[me].squad.reduce((sum, p) => sum + valueOf(p), 0) - 50);
  });

  it('charges interest every week along with the wages', () => {
    let s = newGame(2, 9);
    const me = s.clubs[currentClubId(s)];
    me.loan = LOAN_MAX;
    const before = me.cash;
    s = reduce(s, { type: 'ROLL' });
    const paid = wages(me) + loanInterest(me);
    expect(loanInterest(me)).toBeGreaterThan(0);
    expect(s.notice?.upkeep.join(' ')).toContain('korko');
    expect(s.notice?.lines.join(' ')).not.toContain('korko');
    expect(before - s.clubs[me.id].cash).toBeGreaterThanOrEqual(paid - 60);
    const plain = reduce(newGame(2, 9), { type: 'ROLL' });
    expect(plain.clubs[me.id].cash - s.clubs[me.id].cash).toBe(loanInterest(me));
  });

  it('lets a manager with eleven players borrow his way out of debt', () => {
    let s = playCardNow(newGame(2, 9), CARDS.findIndex((c) => c.kind === 'morale'));
    const me = s.clubs[currentClubId(s)];
    me.cash = -30;
    me.squad.length = MIN_SQUAD;
    expect(isBroke(me)).toBe(false);
    expect(reduce(s, { type: 'BANKRUPT' })).toBe(s);
    expect(reduce(s, { type: 'END_TURN' })).toBe(s);
    s = reduce(reduce(s, { type: 'BORROW' }), { type: 'BORROW' });
    expect(s.clubs[me.id]).toMatchObject({ cash: 20, loan: 2 * LOAN_STEP });
    expect(currentClubId(reduce(s, { type: 'END_TURN' }))).not.toBe(me.id);
  });

  it('is bankruptcy all the same once the bank\'s money no longer covers the debt', () => {
    const s = midTurn();
    const me = s.clubs[currentClubId(s)];
    me.squad.length = MIN_SQUAD;
    me.cash = -30;
    me.loan = LOAN_MAX - LOAN_STEP;
    expect(isBroke(me)).toBe(true);
    expect(reduce(s, { type: 'BANKRUPT' }).bankrupt).toEqual([me.id]);
  });

  it('has the computer borrow before it sells a starter, and repay when it can', () => {
    let s = midTurn();
    const me = s.clubs[currentClubId(s)];
    me.auto = true;
    me.cash = -10;
    me.squad.length = MIN_SQUAD;
    expect(botAction(s)).toEqual({ type: 'BORROW' });
    me.cash = 500;
    me.loan = LOAN_STEP;
    // It may first settle on a formation for its eleven; the repayment follows within a move or two.
    for (let i = 0; i < 3 && s.clubs[me.id].loan > 0; i++) s = botStep(s);
    expect(s.clubs[me.id].loan).toBe(0);
  });
});

describe('utility players', () => {
  /** A squad of plain players, exactly enough for a 4-4-2, all at skill 4. */
  const plainClub = () => {
    const s = newGame(2, 3);
    const c = s.clubs[s.humans[0]];
    c.formation = '4-4-2';
    const lines = ['MV', 'PU', 'PU', 'PU', 'PU', 'KK', 'KK', 'KK', 'KK', 'HY', 'HY'] as const;
    c.squad = lines.map((pos, i) => ({ id: 1000 + i, name: `P${i}`, pos, skill: 4, fitness: 9, spirit: 5, out: 0 }));
    return c;
  };

  it('play at full level in either of their two lines', () => {
    const c = plainClub();
    const dm = c.squad.find((p) => p.pos === 'PU')!;
    Object.assign(dm, { pos: 'KK', also: 'PU', skill: 7 });
    // Four plain midfielders are there already, so he is needed at the back, and plays there at his full 7.
    const slot = lineup(c).slots.find((x) => x.player?.id === dm.id)!;
    expect(slot).toMatchObject({ pos: 'PU', eff: 7 });
    expect(lineup(c).def).toBe(4 + 4 + 4 + 7);

    // Were he an ordinary midfielder, somebody would have to fill the hole at the back at half his level.
    delete dm.also;
    expect(lineup(c).def).toBe(4 + 4 + 4 + 2);
  });

  it('go to the line where they make the eleven strongest', () => {
    const c = plainClub();
    const am = c.squad.find((p) => p.pos === 'KK')!;
    Object.assign(am, { also: 'HY', skill: 8 });
    c.squad.find((p) => p.pos === 'HY')!.out = 2;
    // A forward is missing: moving the attacking midfielder up front leaves a midfield gap just as big, so he stays.
    const total = (x: ReturnType<typeof lineup>) => x.slots.reduce((sum, y) => sum + y.eff, 0);
    expect(total(lineup(c))).toBe(1 * 4 + 4 * 4 + 3 * 4 + 8 + 4);
    // With a spare midfielder on the bench he moves up and the spare man takes his place.
    c.squad.push({ id: 2000, name: 'Spare', pos: 'KK', skill: 4, fitness: 9, spirit: 5, out: 0 });
    const xi = lineup(c);
    expect(xi.slots.find((x) => x.player?.id === am.id)).toMatchObject({ pos: 'HY', eff: 8 });
    expect(xi.att).toBe(12);
    expect(xi.mid).toBe(16);
  });

  it('are midfielders, never keepers, and turn up about as often as intended', () => {
    let outfield = 0, utility = 0;
    for (let seed = 1; seed <= 20; seed++) {
      for (const c of newGame(2, seed).clubs) {
        for (const p of c.squad) {
          if (p.pos !== 'MV') outfield++;
          if (!p.also) continue;
          utility++;
          expect(p.pos).toBe('KK');
          expect(plays(p, p.also) && plays(p, 'KK') && !plays(p, 'MV')).toBe(true);
          expect(posBadge(p)).toBe(p.also === 'PU' ? 'PK' : 'HK');
        }
        expect(c.squad.filter((p) => p.pos === 'MV')).toHaveLength(2);
      }
    }
    expect(utility / outfield).toBeGreaterThan(UTILITY_SHARE - 0.04);
    expect(utility / outfield).toBeLessThan(UTILITY_SHARE + 0.04);
  });

  it('cost more than an ordinary player of the same skill', () => {
    const plain = { id: 1, name: 'A', pos: 'KK' as const, skill: 6, fitness: 9, spirit: 5, out: 0 };
    expect(valueOf({ ...plain, also: 'PU' })).toBeGreaterThan(valueOf(plain));
    expect(valueOf({ ...plain, also: 'PU' }) % 5).toBe(0);
  });

  it('do not include the legend', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = playCardNow(newGame(2, seed), CARDS.findIndex((c) => c.kind === 'legend'));
      if (s.pending?.kind !== 'auction') throw new Error('expected an auction');
      expect(s.pending.player).toMatchObject({ pos: 'HY', legend: true });
      expect(s.pending.player.also).toBeUndefined();
    }
  });
});

describe('crisis cards', () => {
  const draw = (find: (c: (typeof CARDS)[number]) => boolean) => {
    const before = newGame(2, 9);
    return { before, s: playCardNow(before, CARDS.findIndex((c) => c.crisis && find(c))) };
  };

  it('are marked as crises, and there are several kinds', () => {
    expect(new Set(CARDS.filter((c) => c.crisis).map((c) => c.kind)).size).toBeGreaterThanOrEqual(5);
    const { s } = draw((c) => c.kind === 'cash');
    expect(s.notice?.mark).toBe('crisis');
    expect(playCardNow(newGame(2, 9), CARDS.findIndex((c) => c.kind === 'morale')).notice?.mark).toBeUndefined();
  });

  it('let the chairman run off with the money', () => {
    const { before, s } = draw((c) => c.kind === 'cash');
    const me = currentClubId(s);
    expect(s.clubs[me].cash).toBe(before.clubs[me].cash - 30);
  });

  it('let the manager pay off a strike or take the bad morale', () => {
    const { before, s } = draw((c) => c.kind === 'crisisChoice');
    const me = currentClubId(s);
    expect(s.pending).toEqual({ kind: 'crisis', cost: 20 });
    expect(reduce(s, { type: 'END_TURN' })).toBe(s);
    const paid = reduce(s, { type: 'CRISIS', pay: true });
    expect(paid.clubs[me]).toMatchObject({ cash: before.clubs[me].cash - 20, morale: 0 });
    expect(paid.pending).toBeNull();
    const refused = reduce(s, { type: 'CRISIS', pay: false });
    expect(refused.clubs[me]).toMatchObject({ cash: before.clubs[me].cash, morale: -1 });
    s.clubs[me].cash = 19;
    expect(reduce(s, { type: 'CRISIS', pay: true })).toBe(s);
    s.clubs[me].auto = true;
    expect(botAction(s)).toEqual({ type: 'CRISIS', pay: false });
  });

  it('knock two points of fitness off the whole squad', () => {
    const { before, s } = draw((c) => c.kind === 'fatigue');
    const me = currentClubId(s);
    before.clubs[me].squad.forEach((p, i) => expect(s.clubs[me].squad[i].fitness).toBe(p.fitness - 2));
  });

  it('keep the supporters away from the next home league match only', () => {
    let { s } = draw((c) => c.kind === 'boycott');
    const me = currentClubId(s);
    expect(s.clubs[me].boycott).toBe(true);
    const homeGates: number[] = [];
    while (homeGates.length < 2) {
      s = until(s, (s) => s.phase === 'matchday' && s.results?.kind === 'league');
      const f = s.schedule[s.results!.index].find((x) => x.home === me);
      if (f) homeGates.push(f.gate!);
      s = reduce(s, { type: 'CONTINUE' });
    }
    expect(homeGates[0]).toBe(0);
    expect(homeGates[1]).toBeGreaterThan(0);
    expect(s.clubs[me].boycott).toBeUndefined();
  });
});

describe('lucky break cards', () => {
  const draw = (find: (c: (typeof CARDS)[number]) => boolean) => {
    const before = newGame(2, 9);
    return { before, s: playCardNow(before, CARDS.findIndex((c) => c.lucky && find(c))) };
  };

  it('are marked as strokes of luck and never as crises', () => {
    expect(CARDS.filter((c) => c.lucky).length).toBeGreaterThanOrEqual(4);
    expect(CARDS.some((c) => c.lucky && c.crisis)).toBe(false);
    expect(draw((c) => c.kind === 'cash').s.notice?.mark).toBe('lucky');
  });

  it('leave the club money in a will', () => {
    const { before, s } = draw((c) => c.kind === 'cash');
    const me = currentClubId(s);
    expect(s.clubs[me].cash).toBe(before.clubs[me].cash + 30);
  });

  it('let the manager bank a gift or pass it on to the players', () => {
    const { before, s } = draw((c) => c.kind === 'windfall');
    const me = currentClubId(s);
    expect(s.pending).toEqual({ kind: 'windfall', amount: 20 });
    expect(reduce(s, { type: 'END_TURN' })).toBe(s);
    expect(reduce(s, { type: 'WINDFALL', keep: true }).clubs[me]).toMatchObject({ cash: before.clubs[me].cash + 20, morale: 0 });
    const shared = reduce(s, { type: 'WINDFALL', keep: false });
    expect(shared.clubs[me]).toMatchObject({ cash: before.clubs[me].cash, morale: 1 });
    expect(shared.pending).toBeNull();
    s.clubs[me].auto = true;
    expect(botAction(s)).toEqual({ type: 'WINDFALL', keep: true });
  });

  it('double the gate of the next home league match only', () => {
    let { s } = draw((c) => c.kind === 'sellout');
    const me = currentClubId(s);
    expect(s.clubs[me].sellout).toBe(true);
    s = until(s, (s) => s.phase === 'matchday' && s.results?.kind === 'league' && s.schedule[s.results.index].some((x) => x.home === me));
    const f = s.schedule[s.results!.index].find((x) => x.home === me)!;
    expect(f.gate! % 2).toBe(0);
    expect(f.gate!).toBeGreaterThanOrEqual(2 * 20);
    expect(s.clubs[me].sellout).toBeUndefined();
  });

  it('put a random player anywhere in the squad through a development programme: two levels of skill for good', () => {
    expect(CARDS.filter((c) => c.kind === 'develop')).toHaveLength(2);
    const picked = new Set<number>();
    for (let seed = 1; seed <= 30; seed++) {
      const before = newGame(2, seed);
      const me = currentClubId(before);
      const s = playCardNow(before, CARDS.findIndex((c) => c.kind === 'develop'));
      expect(s.notice?.mark).toBe('lucky');
      const changed = s.clubs[me].squad.filter((p, i) => p.skill !== before.clubs[me].squad[i].skill);
      expect(changed).toHaveLength(1);
      const was = before.clubs[me].squad.find((p) => p.id === changed[0].id)!;
      expect(changed[0].skill).toBe(Math.min(9, was.skill + 2));
      expect(changed[0].form).toBeUndefined();
      picked.add(before.clubs[me].squad.indexOf(was));
    }
    // Starters and reserves alike.
    expect(picked.size).toBeGreaterThan(8);
  });

  it('cancel a boycott, and a boycott cancels a sell-out', () => {
    let s = playCardNow(newGame(2, 9), CARDS.findIndex((c) => c.kind === 'boycott'));
    s = playCardNow(s, CARDS.findIndex((c) => c.kind === 'sellout'));
    expect(s.clubs[currentClubId(s)]).toMatchObject({ sellout: true });
    expect(s.clubs[currentClubId(s)].boycott).toBeUndefined();
  });
});

describe('scorers and the golden boot', () => {
  it('names a scorer for every league goal and keeps a tally that matches the results', () => {
    let s = newGame(2, 4);
    for (const id of s.humans) s.clubs[id].cash = 5000;
    s = until(s, (s) => s.round >= 6 && s.phase !== 'matchday');
    const goals = s.schedule.flat().flatMap((f) => (f.events ?? []).filter((e) => e.goal));
    expect(goals.length).toBeGreaterThan(40);
    expect(goals.every((e) => typeof e.scorer === 'string' && e.scorer.length > 0)).toBe(true);
    // Nobody has left the league in six rounds unless sold; the tally can only be at most the goals scored.
    const tally = s.clubs.flatMap((c) => c.squad).reduce((sum, p) => sum + (p.goals ?? 0), 0);
    expect(tally).toBeGreaterThan(0);
    expect(tally).toBeLessThanOrEqual(goals.length);
    const list = topScorers(s);
    expect(list[0].player.goals).toBeGreaterThanOrEqual(list[list.length - 1].player.goals!);
    expect(s.clubs.flatMap((c) => c.squad).filter((p) => p.pos === 'MV').every((p) => !p.goals)).toBe(true);
  });

  it('shares the goals between the lines 20, 35 and 45 per cent, and by skill within a line', () => {
    const byLine = { PU: 0, KK: 0, HY: 0 } as Record<string, number>;
    let star = 0, others = 0;
    for (let seed = 1; seed <= 12; seed++) {
      let s = newGame(2, seed);
      for (const id of s.humans) s.clubs[id].cash = 5000;
      // One league club gets a single outstanding forward among ordinary ones.
      const c = s.clubs.find((x) => !x.human)!;
      c.formation = '4-3-3';
      const forwards = c.squad.filter((p) => p.pos === 'HY' && !p.also).slice(0, 3);
      forwards.forEach((p, i) => { p.skill = i === 0 ? 9 : 3; });
      const starId = forwards[0].id;
      s = until(s, (s) => s.round >= 8 && s.phase !== 'matchday');
      for (const club of s.clubs) {
        for (const p of club.squad) {
          if (!p.goals) continue;
          if (club.id === c.id && forwards.some((f) => f.id === p.id)) {
            if (p.id === starId) star += p.goals; else others += p.goals;
          }
        }
      }
      // Count by the line each scorer's name belongs to, over clubs whose squads have no utility players in doubt.
      for (const f of s.schedule.flat()) {
        for (const e of f.events ?? []) {
          if (!e.goal) continue;
          const who = [...s.clubs[f.home].squad, ...s.clubs[f.away].squad].find((p) => p.name === e.scorer);
          if (who && !who.also) byLine[who.pos]++;
        }
      }
    }
    const total = byLine.PU + byLine.KK + byLine.HY;
    expect(byLine.PU / total).toBeGreaterThan(SCORER_SHARE.PU - 0.07);
    expect(byLine.PU / total).toBeLessThan(SCORER_SHARE.PU + 0.07);
    expect(byLine.HY / total).toBeGreaterThan(SCORER_SHARE.HY - 0.07);
    expect(byLine.HY / total).toBeLessThan(SCORER_SHARE.HY + 0.07);
    // A forward three times as good as each of his two partners scores well over half the forwards' goals.
    expect(star).toBeGreaterThan(others);
  });

  it('leaves cup goals out of the tally but still names the scorer', () => {
    let s = newGame(2, 4);
    for (const c of s.clubs) for (const p of c.squad) p.goals = 0;
    s = until(s, (s) => s.results?.kind === 'league' && s.results.index === 1 && s.phase === 'matchday');
    const before = new Map(s.clubs.flatMap((c) => c.squad).map((p) => [p.id, p.goals ?? 0]));
    s = until(s, (s) => s.results?.kind === 'cup');
    // A player may have left the league on a card in between, but nobody's count has moved.
    for (const p of s.clubs.flatMap((c) => c.squad)) expect(p.goals ?? 0).toBe(before.get(p.id) ?? 0);
    const cupGoals = s.cup[0].flatMap((t) => (t.events ?? []).filter((e) => e.goal && (e.side === 0 ? t.a : t.b).clubId !== null));
    expect(cupGoals.length).toBeGreaterThan(0);
    expect(cupGoals.every((e) => !!e.scorer)).toBe(true);
  });

  it('pays the top scorer\'s club at the end of the season and starts the count again', () => {
    let s = newGame(2, 8);
    for (const id of s.humans) s.clubs[id].cash = 5000;
    s = until(s, (s) => s.week === s.calendar.length - 1 && s.phase === 'matchday');
    const best = topScorers(s)[0];
    const pos = table(s).findIndex((r) => r.id === best.clubId);
    const cash = s.clubs[best.clubId].cash;
    s = reduce(s, { type: 'CONTINUE' });
    expect(s.phase).toBe('seasonEnd');
    expect(s.goldenBoot).toEqual({ name: best.player.name, clubId: best.clubId, goals: best.player.goals });
    expect(s.clubs[best.clubId].cash).toBe(cash + LEAGUE_PRIZE[pos] + GOLDEN_BOOT_PRIZE);
    s = reduce(s, { type: 'CONTINUE' });
    expect(s.goldenBoot).toBeNull();
    expect(s.clubs.flatMap((c) => c.squad).every((p) => p.goals === undefined)).toBe(true);
  });
});

describe('academy', () => {
  it('never produces a player worse than the weakest one in the squad', () => {
    for (const floor of [2, 5, 7]) {
      for (let seed = 1; seed <= 8; seed++) {
        const start = newGame(2, seed);
        const me = start.clubs[currentClubId(start)];
        for (const p of me.squad) p.skill = Math.max(p.skill, floor);
        const weakest = Math.min(...me.squad.map((p) => p.skill));
        const s = playCardNow(start, CARDS.findIndex((c) => c.kind === 'youth'));
        const youth = s.clubs[me.id].squad.find((p) => !me.squad.some((q) => q.id === p.id))!;
        expect(youth.skill).toBeGreaterThanOrEqual(weakest);
        // He is no better than the weakest either, unless the weakest is below what the academy turns out anyway.
        expect(youth.skill).toBeLessThanOrEqual(Math.max(weakest, 4));
      }
    }
  });
});

describe('mental coach', () => {
  /** The current manager standing on the mental coach's square. */
  const atCoach = () => {
    const s = newGame(2, 9);
    const me = s.clubs[currentClubId(s)];
    // The square before it, so that the card that moves a manager on is not needed: land there directly.
    me.boardPos = BOARD.indexOf('mental');
    s.phase = 'manage';
    s.pending = { kind: 'mental' };
    s.notice = { square: me.boardPos, upkeep: [], lines: [] };
    return s;
  };

  it('has a square of its own, where there used to be a third training camp', () => {
    expect(BOARD.filter((x) => x === 'mental')).toHaveLength(1);
    expect(BOARD.filter((x) => x === 'training')).toHaveLength(2);
    expect(BOARD).toHaveLength(24);
  });

  it('raises one player\'s sisu by one for much less than a training camp', () => {
    const s = atCoach();
    const me = s.clubs[currentClubId(s)];
    const pupil = me.squad.find((p) => p.spirit < 9)!;
    expect(MENTAL_COST).toBeLessThan(trainingCost(pupil));
    const after = reduce(s, { type: 'COACH', playerId: pupil.id });
    expect(after.clubs[me.id].squad.find((p) => p.id === pupil.id)!.spirit).toBe(pupil.spirit + 1);
    expect(after.clubs[me.id].squad.find((p) => p.id === pupil.id)!.skill).toBe(pupil.skill);
    expect(after.clubs[me.id].cash).toBe(me.cash - MENTAL_COST);
    expect(after.pending).toBeNull();
  });

  it('can be turned down, cannot be had on credit and stops at nine', () => {
    const s = atCoach();
    const me = s.clubs[currentClubId(s)];
    expect(reduce(s, { type: 'SKIP' }).pending).toBeNull();
    me.squad[0].spirit = 9;
    expect(reduce(s, { type: 'COACH', playerId: me.squad[0].id })).toBe(s);
    me.cash = MENTAL_COST - 1;
    expect(reduce(s, { type: 'COACH', playerId: me.squad[1].id })).toBe(s);
    me.auto = true;
    expect(botAction(s)).toEqual({ type: 'SKIP' });
    me.cash = 500;
    expect(botAction(s).type).toBe('COACH');
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

  it('takes a point of fitness for every match started and gives it back only for a whole week off', () => {
    let s = newGame(2, 4);
    // A league club nobody manages, with a fitness the computer sees no reason to rest.
    const id = s.clubs.find((c) => !c.human)!.id;
    for (const p of s.clubs[id].squad) p.fitness = 5;
    const fitness = () => new Map(s.clubs[id].squad.map((p) => [p.id, p.fitness]));

    // Week 1 has a league round only: eleven started and lost a point, the rest sat the week out and gained three.
    s = until(s, (s) => s.phase === 'matchday');
    const afterOne = fitness();
    expect([...afterOne.values()].filter((f) => f === 4)).toHaveLength(11);
    expect([...afterOne.values()].filter((f) => f === 8)).toHaveLength(afterOne.size - 11);
    expect(s.clubs[id].squad.every((p) => p.played === undefined)).toBe(true);

    // Week 2 has a league round and then the cup's first round, with a turn on the board in between.
    s = until(s, (s) => s.phase === 'matchday' && s.results?.kind === 'league' && s.results.index === 1);
    expect(s.calendar[s.week + 1]).toMatchObject({ kind: 'cup', no: s.calendar[s.week].no });
    expect(s.clubs[id].squad.filter((p) => p.played)).toHaveLength(11);
    // Nobody has recovered yet, because the week is not over.
    for (const p of s.clubs[id].squad) expect(p.fitness).toBe(afterOne.get(p.id)! - (p.played ? 1 : 0));

    s = until(s, (s) => s.results?.kind === 'cup');
    const squad = s.clubs[id].squad;
    expect(squad.every((p) => p.played === undefined)).toBe(true);
    // Whoever started all three matches is three points down.
    expect(squad.some((p) => p.fitness === 2)).toBe(true);
    // Whoever started neither match of week 2 has three points more than after week 1.
    expect(squad.some((p) => p.fitness === Math.min(9, afterOne.get(p.id)! + 3))).toBe(true);
  });

  it('has the computer rest a tired starter when it has cover for him', () => {
    let s = newGame(2, 4);
    const c = s.clubs.find((x) => !x.human)!;
    const xi = lineup(c);
    const starters = new Set(xi.slots.map((x) => x.player!.id));
    const slot = xi.slots.find((x) => c.squad.some((b) => !starters.has(b.id) && plays(b, x.pos) && b.skill >= x.player!.skill - 2))!;
    slot.player!.fitness = 3;
    s = until(s, (s) => s.phase === 'matchday');
    expect(s.clubs[c.id].squad.find((p) => p.id === slot.player!.id)!.fitness).toBe(6);
  });

  it('lets a manager rest a player for one week', () => {
    let s = newGame(2, 4);
    const me = currentClubId(s);
    const star = lineup(s.clubs[me]).slots[1].player!;
    s.clubs[me].squad.find((p) => p.id === star.id)!.fitness = 6;
    s = reduce(s, { type: 'REST', playerId: star.id });
    expect(lineup(s.clubs[me]).slots.some((x) => x.player?.id === star.id)).toBe(false);
    expect(reduce(reduce(s, { type: 'REST', playerId: star.id }), { type: 'REST', playerId: star.id })).toEqual(s);

    s = until(s, (s) => !(s.phase !== 'matchday'));
    const after = s.clubs[me].squad.find((p) => p.id === star.id);
    if (after) {
      expect(after.fitness).toBe(9);
      expect(after.resting).toBeUndefined();
    }
  });

  it('gives a gritty side an extra chance in the last ten minutes: five per cent per point of sisu, up to 25', () => {
    const side = (spirit: number) => ({ att: 10, mid: 20, def: 20, gk: 5, spirit, shape: FORMATIONS['4-4-2'] });
    expect(lateChanceOdds(side(3))).toBe(0);
    expect(lateChanceOdds(side(4))).toBe(0);
    expect(lateChanceOdds(side(5))).toBeCloseTo(0.05);
    expect(lateChanceOdds(side(7))).toBeCloseTo(0.15);
    expect(lateChanceOdds(side(9))).toBeCloseTo(0.25);

    // Over many matches a side of sisu 9 has more chances in minutes 81-90 than one of sisu 1.
    const late = (spirit: number) => {
      let n = 0;
      for (let seed = 1; seed <= 12; seed++) {
        let s = newGame(2, seed);
        const c = s.clubs.find((x) => !x.human)!;
        for (const p of c.squad) p.spirit = spirit;
        for (const id of s.humans) s.clubs[id].cash = 5000;
        s = until(s, (s) => s.round >= 6 && s.phase !== 'matchday');
        for (const f of s.schedule.flat()) {
          if (f.home !== c.id && f.away !== c.id) continue;
          n += (f.events ?? []).filter((e) => e.minute > 80 && e.minute <= 90 && e.side === (f.home === c.id ? 0 : 1)).length;
        }
      }
      return n;
    };
    expect(late(9)).toBeGreaterThan(late(1));
  });

  it('gives a gritty side a stoppage-time chance more often, and a card can promise one', () => {
    const side = (spirit: number) => ({ att: 10, mid: 20, def: 20, gk: 5, spirit, shape: FORMATIONS['4-4-2'] });
    expect(stoppageOdds(side(3))).toBe(0);
    expect(stoppageOdds(side(7))).toBeGreaterThan(stoppageOdds(side(5)));
    expect(stoppageOdds(side(9))).toBe(0.5);

    let s = playCardNow(newGame(2, 4), CARDS.findIndex((c) => c.kind === 'surge'));
    const me = currentClubId(s);
    expect(s.clubs[me].surge).toBe(true);
    s = until(s, (s) => !(s.phase !== 'matchday'));
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

  it('always draws EPS/I against a league club in the first round of the cup', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const s = newGame(2, seed);
      expect(s.cup[0]).toHaveLength(16);
      const tie = s.cup[0].find((t) => t.a.name === 'EPS/I' || t.b.name === 'EPS/I')!;
      const other = tie.a.name === 'EPS/I' ? tie.b : tie.a;
      expect(other.clubId).not.toBeNull();
      // Everybody is still in the draw exactly once.
      const ids = s.cup[0].flatMap((t) => [t.a, t.b]).map((e) => e.clubId ?? e.name);
      expect(new Set(ids).size).toBe(32);
    }
  });

  it('gives clubs from outside the league a sisu of their own, within modest limits', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 5; seed++) {
      const s = newGame(2, seed);
      const outside = [...s.cup[0], ...s.euro.flatMap((c) => c.rounds[0])].flatMap((t) => [t.a, t.b]).filter((e) => e.clubId === null);
      expect(outside.length).toBeGreaterThan(30);
      for (const e of outside) {
        expect(e.spirit).toBeGreaterThanOrEqual(4);
        expect(e.spirit).toBeLessThanOrEqual(6.5);
        seen.add(e.spirit!);
      }
    }
    expect(seen.size).toBeGreaterThan(10);
  });

  it('compensates a gritty side more the heavier an underdog it is', () => {
    // 11 levels per step of `lvl`: level 4 against 5 is a gap of 11, capped at 10.
    const side = (spirit: number, total: number) => ({ att: 0, mid: total, def: 0, gk: 0, spirit, shape: FORMATIONS['4-4-2'] });
    const even = spiritBonus(side(7, 50), side(5, 50), true);
    const slight = spiritBonus(side(7, 48), side(5, 50), true);
    const heavy = spiritBonus(side(7, 40), side(5, 50), true);
    expect(even).toBeCloseTo(1.2);
    expect(slight).toBeCloseTo(1.2 + 2 * 0.05 * 2);
    expect(heavy).toBeCloseTo(1.2 + 2 * 0.05 * 10);
    // The gap counts up to ten levels and no further.
    expect(spiritBonus(side(7, 20), side(5, 50), true)).toBeCloseTo(heavy);
    // It rewards sisu and never punishes the lack of it beyond the ordinary rule, and the favourite gets nothing extra.
    expect(spiritBonus(side(3, 40), side(5, 50), true)).toBeCloseTo(-1.2);
    expect(spiritBonus(side(7, 50), side(5, 40), true)).toBeCloseTo(1.2);
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
  it('fits a season into twenty weeks, with a turn on the board before every matchday', () => {
    let s = newGame(2, 5);
    for (const id of s.humans) s.clubs[id].cash = 5000; // nobody goes bankrupt before the season is over
    expect(s.calendar.filter((w) => w.kind === 'league')).toHaveLength(ROUNDS);
    expect(s.calendar.filter((w) => w.kind === 'cup').map((w) => w.index)).toEqual([0, 1, 2, 3, 4]);
    expect(s.calendar.filter((w) => w.kind === 'euro').map((w) => w.index)).toEqual([0, 1, 2]);
    // Cup rounds and the European quarter-finals share a week with a league round; semi-finals and finals do not.
    expect(s.calendar[s.calendar.length - 1].no).toBe(19);
    const weekOf = (kind: string, index: number) => s.calendar.find((w) => w.kind === kind && w.index === index)!.no;
    const leagueWeeks = s.calendar.filter((w) => w.kind === 'league').map((w) => w.no);
    for (let i = 0; i < 5; i++) expect(leagueWeeks).toContain(weekOf('cup', i));
    expect(leagueWeeks).toContain(weekOf('euro', 0));
    expect(leagueWeeks).not.toContain(weekOf('euro', 1));
    expect(leagueWeeks).not.toContain(weekOf('euro', 2));

    const seen: string[] = [];
    while (s.phase !== 'seasonEnd') {
      if (s.phase === 'matchday' && s.results) {
        seen.push(s.results.kind);
        // Managers take a turn before every matchday, and a cup tie leaves the league table alone.
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
      const others = clubs.filter((e) => e.name !== 'EPS/I');
      expect(others.every((e) => e.level >= LOWER_LEVELS[division][0] && e.level <= LOWER_LEVELS[division][1])).toBe(true);
    }
    // EPS/I is always there, in the bottom division, and weaker than everyone else.
    const eps = lower.find((e) => e.name === 'EPS/I')!;
    expect(eps.division).toBe(3);
    expect(eps.level).toBeLessThan(1.5);
    expect(lower.every((e) => e === eps || e.level > eps.level)).toBe(true);
  });

  it('fills the league with the named clubs, Kasiysi Rovers always among them', () => {
    for (const [humans, seed] of [[2, 1], [4, 2], [6, 3]]) {
      const s = newGame(humans, seed);
      const names = s.clubs.filter((c) => !c.human).map((c) => c.name);
      expect(names).toHaveLength(10 - humans);
      expect(names).toContain('Kasiysi Rovers');
      expect(new Set(names).size).toBe(names.length);
      expect(names.every((n) => AI_CLUB_NAMES.includes(n))).toBe(true);
    }
  });

  it('gives every club without a tie in a European semi-final week the week off', () => {
    const before = until(newGame(2, 6), (s) => s.phase !== 'matchday' && thisWeek(s)?.kind === 'euro' && thisWeek(s)!.index === 1);
    const after = until(before, (s) => s.phase === 'matchday');
    const playing = new Set(after.euro.flatMap((c) => c.rounds[1]).flatMap((t) => [t.a.clubId, t.b.clubId]));
    const idle = before.clubs.filter((c) => !c.human && !playing.has(c.id));
    expect(idle.length).toBeGreaterThan(0);
    for (const c of idle) {
      for (const p of c.squad) expect(after.clubs[c.id].squad.find((x) => x.id === p.id)!.fitness).toBe(Math.min(9, p.fitness + 3));
    }
  });
});

describe('computer managers', () => {
  const withBots = (seed: number, seats = 4) =>
    createGame({ clubs: Array.from({ length: seats }, (_, i) => ({ name: `Seura ${i + 1}`, color: HUMAN_COLORS[i], computer: i > 0 })), seed });

  it('marks the seats and waits for the computer only on its own moves', () => {
    const s = withBots(1);
    expect(s.humans.map((id) => !!s.clubs[id].auto)).toEqual([false, true, true, true]);
    expect(botToMove(s)).toBe(false);
    let next = s;
    while (currentClubId(next) === s.humans[0]) next = reduce(next, bot(next));
    expect(botToMove(next)).toBe(true);
  });

  it('play whole seasons by themselves without getting stuck or all going bankrupt', () => {
    let bankrupt = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      let s = withBots(seed);
      for (let i = 0; i < 20000 && s.phase !== 'seasonEnd' && s.phase !== 'gameOver'; i++) {
        const next = botToMove(s) ? botStep(s) : reduce(s, bot(s));
        expect(next).not.toBe(s);
        s = next;
      }
      expect(s.phase).toBe('seasonEnd');
      bankrupt += s.bankrupt.filter((id) => id !== 0).length;
    }
    expect(bankrupt).toBeLessThanOrEqual(3);
  });

  it('answers an offer sensibly', () => {
    const s = withBots(2);
    s.order = [s.humans[1], s.humans[0], s.humans[2], s.humans[3]];
    const scouting = playCardNow(s, CARDS.findIndex((c) => c.kind === 'goto' && c.square === 'scout'));
    expect(['SCOUT_BUY', 'SKIP']).toContain(botAction(scouting).type);
    const broke = structuredClone(s);
    broke.phase = 'manage';
    broke.clubs[s.humans[1]].cash = -10;
    expect(botAction(broke).type).toBe('SELL');
  });
});

describe('ending the game', () => {
  it('goes on for as long as the managers want and is decided by cash plus squad value', () => {
    let s = newGame(2, 8);
    for (const id of s.humans) s.clubs[id].cash = 5000;
    s = until(s, (s) => !(s.phase !== 'seasonEnd'));
    expect(reduce(s, { type: 'CONTINUE' }).season).toBe(2);
    expect(reduce(s, { type: 'ROLL' })).toBe(s);

    const done = reduce(s, { type: 'FINISH' });
    expect(done.phase).toBe('gameOver');
    const club = done.clubs[done.humans[0]];
    expect(wealth(club)).toBe(club.cash + club.squad.reduce((sum, p) => sum + valueOf(p), 0) - club.loan);
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
    s = until(s, (s) => !(s.phase !== 'seasonEnd'));
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
