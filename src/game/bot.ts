import { FORMATIONS, type FormationId } from './data';
import {
  MATCH_BONUS_COST, MAX_LEVEL, MAX_SQUAD, MIN_SQUAD, actingClubId, currentClubId, expectedChances, isBroke, lineup,
  mustSell, valueOf, reduce, scoringOdds, sellPrice, thisWeek, trainingCost, wages,
  type Action, type Club, type GameState, type Player,
} from './engine';

/** Weeks of wages the computer keeps in the bank before it spends on anything. */
const RESERVE_WEEKS = 2;
const spare = (c: Club) => c.cash - RESERVE_WEEKS * wages(c);
/**
 * What the computer can put into a bid. For a player who would start, it is prepared to sell from the bench
 * to pay for him, as a person would, so the bench's sale value counts as money in hand.
 */
function biddingPower(c: Club, p: Player): number {
  if (!improves(c, p)) return spare(c);
  const starters = new Set(lineup(c).slots.flatMap((x) => (x.player ? [x.player.id] : [])));
  const bench = c.squad.filter((x) => !starters.has(x.id)).sort((a, b) => a.skill - b.skill);
  const sellable = bench.slice(0, Math.max(0, Math.min(2, c.squad.length - 13)));
  return spare(c) + sellable.reduce((sum, x) => sum + sellPrice(x), 0);
}

/** The league club this manager meets this week, if any. */
function rivalOf(s: GameState, me: Club): Club | null {
  const week = thisWeek(s);
  if (!week) return null;
  if (week.kind === 'league') {
    const f = s.schedule[week.index].find((x) => x.home === me.id || x.away === me.id);
    return f ? s.clubs[f.home === me.id ? f.away : f.home] : null;
  }
  const ties = week.kind === 'cup' ? s.cup[week.index] : s.euro.flatMap((c) => c.rounds[week.index]);
  const tie = ties.find((t) => t.a.clubId === me.id || t.b.clubId === me.id);
  const id = tie && (tie.a.clubId === me.id ? tie.b.clubId : tie.a.clubId);
  return id != null ? s.clubs[id] : null;
}

function hasTie(s: GameState, me: Club): boolean {
  const week = thisWeek(s);
  if (!week || week.kind === 'league') return false;
  const ties = week.kind === 'cup' ? s.cup[week.index] : s.euro.flatMap((c) => c.rounds[week.index]);
  return ties.some((t) => t.a.clubId === me.id || t.b.clubId === me.id);
}

/** Expected goals for minus against, were `me` to meet `rival` in this formation. */
function edge(me: Club, formation: FormationId, rival: Club): number {
  const x = lineup({ ...me, formation });
  const y = lineup(rival);
  return expectedChances(x, y) * scoringOdds(x, y) - expectedChances(y, x) * scoringOdds(y, x);
}

/** The formation that does best against this week's opponent with the players available. */
function bestFormation(s: GameState, me: Club): FormationId {
  const rival = rivalOf(s, me);
  if (!rival) return me.formation;
  let best = me.formation;
  let bestEdge = edge(me, me.formation, rival) + 0.02; // do not switch for nothing
  for (const f of Object.keys(FORMATIONS) as FormationId[]) {
    const e = edge(me, f, rival);
    if (e > bestEdge) {
      best = f;
      bestEdge = e;
    }
  }
  return best;
}

/** Would this player walk into the starting eleven? */
function improves(c: Club, p: Player): boolean {
  const slots = lineup(c).slots.filter((x) => x.pos === p.pos);
  return slots.some((x) => x.eff < p.skill);
}

/** What the computer is prepared to pay: full value for a starter, much less for a squad player. */
function worth(c: Club, p: Player): number {
  return valueOf(p) * (improves(c, p) ? 1.15 : 0.6);
}

const worstFirst = (c: Club) => {
  const starters = new Set(lineup(c).slots.flatMap((x) => (x.player ? [x.player.id] : [])));
  return [...c.squad].sort((a, b) => Number(starters.has(a.id)) - Number(starters.has(b.id)) || a.skill - b.skill);
};

/** What a computer-run manager does next. Only meaningful while it is that manager's move. */
export function botAction(s: GameState): Action {
  const p = s.pending;
  const me = s.clubs[currentClubId(s)];

  if (p?.kind === 'auction') {
    const bidder = s.clubs[actingClubId(s)];
    const min = p.leader === null ? p.minBid : p.bid + 5;
    const owner = p.owner === bidder.id;
    const limit = owner ? valueOf(p.player) * 1.1 : worth(bidder, p.player);
    const room = owner || bidder.squad.length < MAX_SQUAD;
    if (!room || min > limit || min > biddingPower(bidder, p.player)) return { type: 'PASS' };
    // Short of cash for a player worth having: sell the weakest reserve first, then bid.
    if (min > bidder.cash) {
      const starters = new Set(lineup(bidder).slots.flatMap((x) => (x.player ? [x.player.id] : [])));
      const spareMan = bidder.squad.filter((x) => !starters.has(x.id) && x.id !== p.player.id).sort((a, b) => a.skill - b.skill)[0];
      return spareMan && bidder.squad.length > MIN_SQUAD ? { type: 'SELL', playerId: spareMan.id } : { type: 'PASS' };
    }
    return { type: 'BID', amount: min };
  }
  if (p?.kind === 'auctionPick') {
    return { type: 'AUCTION_PICK', index: p.options[1].skill > p.options[0].skill ? 1 : 0 };
  }
  if (p?.kind === 'scout') {
    const choice = p.options
      .map((o, index) => ({ o, index }))
      .filter(({ o }) => improves(me, o) && valueOf(o) <= spare(me))
      .sort((a, b) => b.o.skill - a.o.skill)[0];
    return choice && me.squad.length < MAX_SQUAD ? { type: 'SCOUT_BUY', index: choice.index } : { type: 'SKIP' };
  }
  if (p?.kind === 'training') {
    const starters = lineup(me).slots.flatMap((x) => (x.player ? [x.player] : []));
    const pupil = starters
      .filter((x) => x.skill < MAX_LEVEL && (p.free || trainingCost(x) <= spare(me)))
      .sort((a, b) => b.skill - a.skill)[0];
    return pupil ? { type: 'TRAIN', playerId: pupil.id } : { type: 'SKIP' };
  }
  if (p?.kind === 'steal') {
    const target = s.clubs
      .filter((c) => c.id !== me.id && c.squad.length > MIN_SQUAD)
      .flatMap((c) => c.squad.map((x) => ({ clubId: c.id, x })))
      .sort((a, b) => b.x.skill - a.x.skill)[0];
    return target ? { type: 'STEAL', clubId: target.clubId, playerId: target.x.id } : { type: 'SKIP' };
  }

  if (isBroke(me)) return { type: 'BANKRUPT' };
  if (mustSell(me)) return { type: 'SELL', playerId: worstFirst(me)[0].id };

  const formation = bestFormation(s, me);
  if (formation !== me.formation) return { type: 'SET_FORMATION', formation };

  if (s.phase === 'roll') {
    // A promised bonus is saved for knockout ties, where one match decides everything.
    if (hasTie(s, me) && me.morale < 1 && spare(me) >= MATCH_BONUS_COST) return { type: 'MATCH_BONUS' };
    return { type: 'ROLL' };
  }
  return { type: 'END_TURN' };
}

/**
 * Plays one move for the computer. If the engine turns the chosen move down, falls back on moves that always
 * get a turn moving again, so a computer manager can never leave the game stuck.
 */
export function botStep(s: GameState): GameState {
  const fallbacks: Action[] = [botAction(s), { type: 'PASS' }, { type: 'SKIP' }, { type: 'ROLL' }, { type: 'END_TURN' }, { type: 'BANKRUPT' }];
  for (const action of fallbacks) {
    const next = reduce(s, action);
    if (next !== s) return next;
  }
  return s;
}

/** True while the game is waiting for a computer-run manager. */
export function botToMove(s: GameState): boolean {
  return (s.phase === 'roll' || s.phase === 'manage') && !!s.clubs[actingClubId(s)]?.auto;
}
