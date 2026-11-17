import {
  AI_CLUB_NAMES, BOARD, CUP_ROUND_NAMES, EURO_COMPS, EURO_ROUND_NAMES, CARDS, CUP_SIZE, FIRST_NAMES, FOREIGN_CLUBS, FOREIGN_NAMES, FOREIGN_SHARE, FORMATIONS, LAST_NAMES, LEGEND, LOWER_CLUBS, LOWER_LEVELS, POS_NAME, WEAKEST_CLUB, fmt,
  type Card, type FormationId, type Pos, type Shape,
} from './data';

export const START_CASH = 70;
export const MAX_SQUAD = 20;
/** A manager whose squad would fall below this is out of the game. */
export const MIN_SQUAD = 11;
export const LEAGUE_SIZE = 10;
export const ROUNDS = (LEAGUE_SIZE - 1) * 2;
/** A cup round gets a week of its own right after these league rounds (0-based). */
export const CUP_AFTER = [1, 4, 7, 11, 16];
/** European rounds are played right after these league rounds (0-based). */
export const EURO_AFTER = [3, 9, 14];
export const LEAGUE_PRIZE = [250, 170, 120, 90, 70, 50, 35, 25, 15, 0];
export const CUP_PRIZE = { winner: 200, finalist: 80 };
/** Ticket income for a league club from a cup tie: this much in the first round, and 5 more each round after. */
export const CUP_GATE = 15;
export const cupGate = (round: number) => CUP_GATE + 5 * round;
/** Ticket and television money from a European tie. The top competition is where the real money is. */
export const euroGate = (tier: number, round: number) => Math.round(EURO_COMPS[tier].gate * (1 + 0.25 * round));
/** Promising the players a bonus costs this much and wins extra chances in the club's next match. */
export const MATCH_BONUS_COST = 15;
/** Extra ticket income per league win in a row, up to five. */
export const STREAK_GATE = 5;
export const SELL_RATE = 0.6;
export const MAX_LEVEL = 9;
export const FULL_FITNESS = 9;
/** A starter is tired at this fitness or below (one level off) and exhausted at 1 (two levels off). */
export const TIRED_AT = 3;
/** Fitness lost per match started, and regained by everyone after each league round. */
export const MATCH_FATIGUE = 3;
export const ROUND_RECOVERY = 3;

export interface Player {
  id: number;
  name: string;
  pos: Pos;
  /** What the player can do when fresh. */
  skill: number;
  /**
   * 1–9. A match started costs three and every league round gives three back, so a week with a cup or
   * European tie on top wears a player down until he sits a round out.
   */
  fitness: number;
  /** 1–9 ("sisu"). Counts when the side is in a tough spot: away, as the weaker side, or in a knockout tie. */
  spirit: number;
  /** Temporary form from a card: added to skill for `matches` more league rounds, or all season when null. */
  form?: { amount: number; matches: number | null };
  /** The legend: his value and wages are a fraction of what his skill would normally cost. */
  legend?: boolean;
  /** The manager has told him to sit out this week's match. */
  resting?: boolean;
  /** League matches the player still misses. */
  out: number;
  outReason?: 'injury' | 'ban';
}

export interface Club {
  id: number;
  name: string;
  human: boolean;
  color: string;
  cash: number;
  squad: Player[];
  formation: FormationId;
  boardPos: number;
  /** -1, 0 or 1: applies to the club's next match only. */
  morale: number;
  /** A manager's seat played by the computer rather than a person. */
  auto?: boolean;
  /** A card has promised a stoppage-time chance in the next league match. */
  surge?: boolean;
  /** A manager who could not pay his debts. The computer runs the club from then on. */
  bankrupt?: boolean;
}

export interface Fixture {
  home: number;
  away: number;
  hg: number | null;
  ag: number | null;
  /** Ticket income paid to the home club once the match is played. */
  gate: number | null;
  /** Scoring chances each side had: [home, away]. */
  chances: [number, number] | null;
  /** The chances in the order they came, for showing the match live. */
  events?: MatchEvent[];
}

/** A league club (`clubId`), or a foreign or lower-division club that is only a name and a level. */
export interface Entrant { clubId: number | null; name: string; level: number; /** Set for a lower-division club. */ division?: 2 | 3 }
/**
 * One knockout match. After a shoot-out (`pens`) the winner is credited with one extra goal, so the score
 * always shows who went through.
 */
export interface Tie { a: Entrant; b: Entrant; ag: number | null; bg: number | null; winner: 'a' | 'b' | null; pens: boolean; events?: MatchEvent[]; /** Paid to each league club in the tie. */ gate?: number }
export interface EuroComp { tier: number; rounds: Tie[][] }

/** One week of the season. `index` is the round within that competition. */
export interface Week { kind: 'league' | 'cup' | 'euro'; index: number }

export type Pending =
  | { kind: 'auctionPick'; options: Player[] }
  | {
      kind: 'auction'; player: Player; minBid: number; bid: number; leader: number | null; active: number[]; idx: number;
      /** A sponsor pays this much of the price if this club wins. */
      subsidy: { club: number; amount: number } | null;
      /**
       * Set when the player already belongs to a manager (a contract re-negotiation). If the owner wins he
       * pays the bid to keep him; if someone else wins, the owner is paid the bid.
       */
      owner: number | null;
    }
  /** The manager may take any one player from another club. */
  | { kind: 'steal' }
  | { kind: 'scout'; options: Player[] }
  | { kind: 'training'; free: boolean };

export type Phase = 'roll' | 'manage' | 'matchday' | 'seasonEnd' | 'gameOver';

export interface SeasonRow { id: number; pos: number; prize: number }

/** Raised whenever the shape of a saved game changes, so an older game is never played with newer rules. */
export const STATE_VERSION = 25;

export interface GameState {
  version: number;
  seed: number;
  nextId: number;
  clubs: Club[];
  /** Clubs still run by a manager. */
  humans: number[];
  /** Managers who went bankrupt, in the order they dropped out. */
  bankrupt: number[];
  /** Managers still to take their turn this round; the first one is up. */
  order: number[];
  season: number;
  round: number;
  schedule: Fixture[][];
  cup: Tie[][];
  /**
   * Club ids playing in Europe this season, by competition. In the first season these are computer clubs;
   * after that, last season's top four.
   */
  qualified: number[][];
  euro: EuroComp[];
  /** True once a manager has signed the legend; his card then stays out of the deck. */
  legendSigned: boolean;
  /** Piles of name indexes still to be used. */
  names: { first: number[]; last: number[]; foreign: number[] };
  /** Indexes into CARDS still to be drawn; reshuffled when it runs out. */
  deck: number[];
  phase: Phase;
  die: number | null;
  pending: Pending | null;
  notice: { square: number; lines: string[] } | null;
  /** The season week by week: league rounds, with cup and European rounds on weeks of their own in between. */
  calendar: Week[];
  /** Index into `calendar` of the week being played. */
  week: number;
  /** What was just played, while its results are on screen. */
  results: Week | null;
  seasonSummary: SeasonRow[] | null;
  log: string[];
}

export type Action =
  | { type: 'ROLL' }
  | { type: 'AUCTION_PICK'; index: number }
  | { type: 'BID'; amount: number }
  | { type: 'PASS' }
  | { type: 'SCOUT_BUY'; index: number }
  | { type: 'TRAIN'; playerId: number }
  | { type: 'SKIP' }
  | { type: 'STEAL'; clubId: number; playerId: number }
  | { type: 'SET_FORMATION'; formation: FormationId }
  | { type: 'SELL'; playerId: number }
  | { type: 'REST'; playerId: number }
  /** Promise the players a bonus for the next match. */
  | { type: 'MATCH_BONUS' }
  | { type: 'BANKRUPT' }
  | { type: 'END_TURN' }
  | { type: 'CONTINUE' }
  /** At the end of a season: stop here and count up instead of playing another year. */
  | { type: 'FINISH' };

export interface GameConfig { clubs: { name: string; color: string; computer?: boolean }[]; seed: number }

// ---------- random ----------

function rand(s: GameState): number {
  s.seed = (s.seed + 0x6d2b79f5) | 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const randInt = (s: GameState, n: number) => Math.floor(rand(s) * n);
const pick = <T,>(s: GameState, a: T[]): T => a[randInt(s, a.length)];
function shuffle<T>(s: GameState, a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(s, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function poisson(s: GameState, mean: number): number {
  const limit = Math.exp(-mean);
  let k = 0;
  let p = rand(s);
  while (p > limit) {
    k++;
    p *= rand(s);
  }
  return k;
}

// ---------- players and lineups ----------

export function playerValue(skill: number, spirit = 5): number {
  return Math.max(5, Math.round((8 + 2.2 * skill * skill + 3 * (spirit - 5)) / 5) * 5);
}

/** The level a player actually plays at: skill plus current form, less one when tired and two when exhausted. */
export function level(p: Player): number {
  const tired = (p.fitness <= TIRED_AT ? 1 : 0) + (p.fitness <= 1 ? 1 : 0);
  return Math.max(1, Math.min(MAX_LEVEL, p.skill + (p.form?.amount ?? 0) - tired));
}
/** What a player is worth: by skill and sisu, except that the legend comes at a discount. */
export function valueOf(p: Player): number {
  const full = playerValue(p.skill, p.spirit);
  return p.legend ? Math.round((full * LEGEND.discount) / 5) * 5 : full;
}
export const sellPrice = (p: Player) => Math.round(valueOf(p) * SELL_RATE);
export const trainingCost = (p: Player) => 5 * p.skill;
/** Paid at the start of every turn, per level of skill in the squad. */
export const WAGE_PER_LEVEL = 0.27;
/** Paid each time a manager completes a lap of the board. */
export const LAP_BONUS = 25;
export const wages = (c: Club) => Math.round(WAGE_PER_LEVEL * c.squad.reduce((sum, p) => sum + p.skill * (p.legend ? LEGEND.discount : 1), 0));

/** Draws from a shuffled pile of the list, so a name does not come round again until the pile is used up. */
function drawName(s: GameState, key: 'first' | 'last' | 'foreign', list: string[]): string {
  if (!s.names[key].length) s.names[key] = shuffle(s, list.map((_, i) => i));
  return list[s.names[key].pop()!];
}

function newName(s: GameState): string {
  if (rand(s) < FOREIGN_SHARE) return drawName(s, 'foreign', FOREIGN_NAMES);
  return `${drawName(s, 'first', FIRST_NAMES)} ${drawName(s, 'last', LAST_NAMES)}`;
}

function newPlayer(s: GameState, pos: Pos, skill: number): Player {
  return {
    id: s.nextId++,
    name: newName(s),
    pos,
    skill: Math.max(1, Math.min(MAX_LEVEL, skill)),
    fitness: FULL_FITNESS,
    spirit: 1 + randInt(s, 5) + randInt(s, 5),
    out: 0,
  };
}
const randomPos = (s: GameState): Pos => pick(s, ['MV', 'PU', 'PU', 'PU', 'KK', 'KK', 'KK', 'HY', 'HY'] as Pos[]);

function newSquad(s: GameState, offset: number): Player[] {
  const skills = shuffle(s, [6, 6, 5, 5, 5, 5, 4, 4, 4, 4, 4, 3, 3, 3]);
  const positions: Pos[] = ['MV', 'MV', 'PU', 'PU', 'PU', 'PU', 'PU', 'KK', 'KK', 'KK', 'KK', 'HY', 'HY', 'HY'];
  // No two players in a squad share a first name or a surname, so nobody is mistaken for a team-mate.
  const taken = new Set<string>();
  return positions.map((pos, i) => {
    const player = newPlayer(s, pos, skills[i] + offset);
    for (let tries = 0; tries < 20 && player.name.split(' ').some((part) => taken.has(part)); tries++) player.name = newName(s);
    for (const part of player.name.split(' ')) taken.add(part);
    return player;
  });
}

export interface Slot { pos: Pos; player: Player | null; eff: number }
/** What a side brings to a match: summed levels of its forwards, midfielders, defenders and keeper. */
export interface Strength { att: number; mid: number; def: number; gk: number; /** Average sisu of the starters. */ spirit: number; shape: Shape }
export interface Lineup extends Strength { slots: Slot[] }

/** Best available eleven for the club's formation. Gaps are filled out of position at half skill. */
export function lineup(club: Club): Lineup {
  const f = FORMATIONS[club.formation];
  const avail = club.squad.filter((p) => p.out === 0 && !p.resting).sort((a, b) => level(b) - level(a) || b.skill - a.skill);
  const used = new Set<number>();
  const slots: Slot[] = [];
  const need: [Pos, number][] = [['MV', 1], ['PU', f.PU], ['KK', f.KK], ['HY', f.HY]];
  for (const [pos, n] of need) {
    const own = avail.filter((p) => p.pos === pos).slice(0, n);
    for (const p of own) {
      used.add(p.id);
      slots.push({ pos, player: p, eff: level(p) });
    }
    for (let i = own.length; i < n; i++) slots.push({ pos, player: null, eff: 0 });
  }
  for (const slot of slots) {
    if (slot.player) continue;
    const p = avail.find((x) => !used.has(x.id));
    if (!p) break;
    used.add(p.id);
    slot.player = p;
    slot.eff = slot.pos === 'MV' ? 1 : Math.max(1, Math.floor(level(p) / 2));
  }
  const starters = slots.flatMap((x) => (x.player ? [x.player] : []));
  const sum = (pos: Pos) => slots.filter((x) => x.pos === pos).reduce((t, x) => t + x.eff, 0);
  return {
    slots,
    att: sum('HY'),
    mid: sum('KK'),
    def: sum('PU'),
    gk: sum('MV'),
    spirit: starters.length ? starters.reduce((total, p) => total + p.spirit, 0) / starters.length : 5,
    shape: f,
  };
}

// ---------- league and cup ----------

export interface Row { id: number; p: number; w: number; d: number; l: number; gf: number; ga: number; pts: number }

export function table(s: GameState): Row[] {
  const rows = new Map<number, Row>(s.clubs.map((c) => [c.id, { id: c.id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }]));
  for (const round of s.schedule) {
    for (const f of round) {
      if (f.hg === null || f.ag === null) continue;
      const h = rows.get(f.home)!;
      const a = rows.get(f.away)!;
      h.p++; a.p++;
      h.gf += f.hg; h.ga += f.ag; a.gf += f.ag; a.ga += f.hg;
      if (f.hg > f.ag) { h.w++; a.l++; h.pts += 3; }
      else if (f.hg < f.ag) { a.w++; h.l++; a.pts += 3; }
      else { h.d++; a.d++; h.pts++; a.pts++; }
    }
  }
  return [...rows.values()].sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || x.id - y.id);
}

export const position = (s: GameState, clubId: number) => table(s).findIndex((r) => r.id === clubId) + 1;

function makeSchedule(s: GameState): Fixture[][] {
  const t = shuffle(s, s.clubs.map((c) => c.id));
  const n = t.length;
  const first: Fixture[][] = [];
  for (let r = 0; r < n - 1; r++) {
    const round: Fixture[] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = t[i];
      const b = t[n - 1 - i];
      round.push((r + i) % 2 === 0 ? { home: a, away: b, hg: null, ag: null, gate: null, chances: null } : { home: b, away: a, hg: null, ag: null, gate: null, chances: null });
    }
    first.push(round);
    t.splice(1, 0, t.pop()!);
  }
  const second = first.map((round) => round.map((f) => ({ home: f.away, away: f.home, hg: null, ag: null, gate: null, chances: null })));
  return [...first, ...second];
}

// A match is a series of scoring chances. Midfield decides how many a side gets; each one is then two dice
// against a target that the forwards lower and the defence and keeper raise.
//
// Players count by how far they are above or below the average level on the pitch, so two evenly matched
// sides score the same whether they are all level 3 or all level 8. Formation shape gives fixed shifts on
// top: forwards are counted against the opponent's defenders, an extra midfielder wins chances, and an open
// or closed formation raises or lowers the number of chances for both sides.
export const CHANCES_BASE = 4.85;
export const HOME_CHANCES = 0.5;
export const MORALE_CHANCES = 0.5;
export const SCORE_TARGET = 9.35;
/** Target shift per level of a forward or defender; a midfielder moves the chance count by the same amount. */
export const LEVEL_WEIGHT = 0.1;
export const KEEPER_WEIGHT = 1.5;
/**
 * Forwards against defenders is a head count. With two defenders kept back for cover, every forward more than
 * the opponent has left to mark him makes each chance better by this much, and every one fewer makes it worse.
 */
export const DUEL_STEP = 0.45;
/** Extra when the forwards match the whole back line (three against three). */
export const OVERLOAD_BONUS = 0.3;
/** Extra penalty for a lone forward against a back five. */
export const ISOLATED_PENALTY = 0.6;
/** Chances added to both sides per open formation on the pitch, and removed per closed one. */
export const TEMPO_CHANCES = 0.5;
/** Chances won per midfielder more than the opponent has. */
export const MIDFIELD_COUNT_CHANCES = 0.6;
/** Chances won or lost per point of average sisu above or below 5, when the side is in a tough spot. */
export const SPIRIT_CHANCES = 0.3;

/**
 * Sisu only counts in a tough spot: playing away, in a knockout tie, or as the weaker side on paper.
 * There a gritty side wins extra chances and a soft one loses them.
 */
export function spiritBonus(x: Strength, y: Strength, tough: boolean): number {
  const total = (z: Strength) => z.att + z.mid + z.def + z.gk;
  return tough || total(x) < total(y) ? SPIRIT_CHANCES * (x.spirit - 5) : 0;
}

/** Chance that `x` wins a penalty shoot-out against `y`: nerve decides. */
export const shootoutOdds = (x: Strength, y: Strength) => Math.max(0.2, Math.min(0.8, 0.5 + 0.06 * (x.spirit - y.spirit)));

/**
 * Starters pay for the match and everyone who sat it out recovers. A league week gives the starters the same
 * back, so only the extra cup and European weeks wear a player down.
 */
function applyFatigue(c: Club, played: Lineup, leagueRound: boolean) {
  const started = new Set(played.slots.flatMap((x) => (x.player ? [x.player.id] : [])));
  for (const p of c.squad) {
    if (started.has(p.id)) p.fitness = Math.max(1, p.fitness - MATCH_FATIGUE);
    if (leagueRound || !started.has(p.id)) p.fitness = Math.min(FULL_FITNESS, p.fitness + ROUND_RECOVERY);
  }
}

/** Probability that two dice total at least `need`, interpolated between whole numbers. */
function twoDiceAtLeast(need: number): number {
  const exact = (k: number) => (k <= 2 ? 1 : k > 12 ? 0 : [36, 35, 33, 30, 26, 21, 15, 10, 6, 3, 1][k - 2] / 36);
  const low = Math.floor(need);
  return exact(low) + (exact(low + 1) - exact(low)) * (need - low);
}

const pitchAverage = (x: Strength, y: Strength) => (x.att + x.mid + x.def + x.gk + y.att + y.mid + y.def + y.gk) / 22;

/** How much the attackers' numbers against the defenders' numbers lower the target. This is where formations counter each other. */
export function duel(attackers: Shape, defenders: Shape): number {
  const margin = attackers.HY - (defenders.PU - 2);
  return DUEL_STEP * margin + (margin >= 2 ? OVERLOAD_BONUS : 0) - (margin <= -2 ? ISOLATED_PENALTY : 0);
}

/** Chance that one scoring chance of `x` ends up in `y`'s net. */
export function scoringOdds(x: Strength, y: Strength): number {
  const avg = pitchAverage(x, y);
  const defence = y.def - y.shape.PU * avg + KEEPER_WEIGHT * (y.gk - avg);
  const attack = x.att - x.shape.HY * avg;
  return twoDiceAtLeast(SCORE_TARGET + LEVEL_WEIGHT * (defence - attack) - duel(x.shape, y.shape));
}

export function expectedChances(x: Strength, y: Strength, bonus = 0): number {
  const avg = pitchAverage(x, y);
  const quality = x.mid - x.shape.KK * avg - (y.mid - y.shape.KK * avg);
  const tempo = TEMPO_CHANCES * (x.shape.style + y.shape.style);
  return Math.max(0.5, CHANCES_BASE + MIDFIELD_COUNT_CHANCES * (x.shape.KK - y.shape.KK) + LEVEL_WEIGHT * quality + tempo + bonus);
}

/**
 * One scoring chance: when it came, which side had it (0 = first-named side) and whether it went in.
 * Minutes 91–95 are stoppage time.
 */
export interface MatchEvent { minute: number; side: 0 | 1; goal: boolean }
export const FULL_TIME = 90;
export const STOPPAGE = 5;

/** Chance that a side forces one more scoring chance in stoppage time: sisu keeps a team going to the whistle. */
export const stoppageOdds = (x: Strength) => Math.max(0, Math.min(0.5, 0.1 * (x.spirit - 3.5)));

function playSide(s: GameState, side: 0 | 1, x: Strength, y: Strength, bonus: number, surge: boolean): MatchEvent[] {
  const chances = poisson(s, expectedChances(x, y, bonus));
  const odds = scoringOdds(x, y);
  const events = Array.from({ length: chances }, (): MatchEvent => ({ minute: 1 + randInt(s, FULL_TIME), side, goal: rand(s) < odds }));
  if (rand(s) < stoppageOdds(x) || surge) {
    events.push({ minute: FULL_TIME + 1 + randInt(s, STOPPAGE), side, goal: rand(s) < odds });
  }
  return events;
}

function playMatch(s: GameState, a: Strength, b: Strength, aBonus = 0, bBonus = 0, aSurge = false, bSurge = false) {
  const x = playSide(s, 0, a, b, aBonus, aSurge);
  const y = playSide(s, 1, b, a, bBonus, bSurge);
  const goals = (events: MatchEvent[]) => events.filter((e) => e.goal).length;
  return {
    ag: goals(x),
    bg: goals(y),
    chances: [x.length, y.length] as [number, number],
    // The two sides' chances interleaved in the order they happened.
    events: [...x, ...y].sort((p, q) => p.minute - q.minute),
  };
}

/** Ticket income for a home match. Meetings of teams high in the table draw bigger crowds. */
export function gateIncome(homePos: number, awayPos: number, streak = 0): number {
  return 15 + 3 * (LEAGUE_SIZE - homePos) + 2 * (LEAGUE_SIZE - awayPos) + STREAK_GATE * Math.min(5, streak);
}

/** League wins in a row, up to now. A side on a run fills its ground. */
export function winStreak(s: GameState, clubId: number): number {
  let streak = 0;
  for (let r = s.round - 1; r >= 0; r--) {
    const f = s.schedule[r].find((x) => x.home === clubId || x.away === clubId);
    if (!f || f.hg === null || f.ag === null) continue;
    const won = f.home === clubId ? f.hg > f.ag : f.ag > f.hg;
    if (!won) break;
    streak++;
  }
  return streak;
}

function makeTies(entrants: Entrant[]): Tie[] {
  const ties: Tie[] = [];
  for (let i = 0; i < entrants.length; i += 2) ties.push({ a: entrants[i], b: entrants[i + 1], ag: null, bg: null, winner: null, pens: false });
  return ties;
}

/** Eight-club knockout. Two league clubs in the same competition start in opposite halves. */
function makeEuro(s: GameState, tier: number, clubIds: number[], names: string[]): EuroComp {
  const info = EURO_COMPS[tier];
  const level = () => info.level[0] + rand(s) * (info.level[1] - info.level[0]) + 0.3 * (s.season - 2);
  const entrants = Array.from({ length: 8 }, (_, i): Entrant => {
    const clubId = i === 0 ? clubIds[0] : i === 4 ? clubIds[1] : undefined;
    return clubId !== undefined
      ? { clubId, name: '', level: 0 }
      : { clubId: null, name: names.pop()!, level: level() };
  });
  return { tier, rounds: [makeTies(entrants)] };
}

// ---------- helpers ----------

const club = (s: GameState, id: number) => s.clubs.find((c) => c.id === id)!;
export const currentClubId = (s: GameState) => s.order[0] ?? s.humans[s.week % Math.max(1, s.humans.length)] ?? 0;
/** The club that has to act right now: the bidder during an auction, otherwise the manager whose turn it is. */
export const actingClubId = (s: GameState) => (s.pending?.kind === 'auction' ? s.pending.active[s.pending.idx] : currentClubId(s));
export const thisWeek = (s: GameState): Week | undefined => s.calendar[s.week];

/** Every manager moves once per round; who goes first rotates. */
function startRound(s: GameState) {
  const n = s.humans.length;
  s.order = s.humans.map((_, i) => s.humans[(s.week + i) % n]);
  s.phase = n ? 'roll' : 'gameOver';
}

/** A manager must clear his debts by selling players; with only eleven left there is nothing to sell. */
export const mustSell = (c: Club) => c.human && c.cash < 0;
export const isBroke = (c: Club) => mustSell(c) && c.squad.length <= MIN_SQUAD;
function log(s: GameState, line: string) {
  s.log.push(line);
  if (s.log.length > 80) s.log.shift();
}

function startSeason(s: GameState) {
  s.round = 0;
  s.week = 0;
  s.schedule = makeSchedule(s);
  s.calendar = [];
  for (let i = 0; i < ROUNDS; i++) {
    s.calendar.push({ kind: 'league', index: i });
    if (CUP_AFTER.includes(i)) s.calendar.push({ kind: 'cup', index: CUP_AFTER.indexOf(i) });
    if (EURO_AFTER.includes(i)) s.calendar.push({ kind: 'euro', index: EURO_AFTER.indexOf(i) });
  }
  const lowerNames = shuffle(s, [...LOWER_CLUBS]);
  const cupEntrants: Entrant[] = s.clubs.map((c) => ({ clubId: c.id, name: '', level: 0 }));
  const lowerCount = CUP_SIZE - cupEntrants.length;
  for (let i = 0; i < lowerCount; i++) {
    const division = i < lowerCount / 2 ? 2 : 3;
    const weakest = i === lowerCount - 1;
    const [min, max] = weakest ? WEAKEST_CLUB.level : LOWER_LEVELS[division];
    cupEntrants.push({ clubId: null, name: weakest ? WEAKEST_CLUB.name : lowerNames.pop()!, level: min + rand(s) * (max - min), division });
  }
  s.cup = [makeTies(shuffle(s, cupEntrants))];
  const foreign = shuffle(s, [...FOREIGN_CLUBS]);
  s.euro = s.qualified.map((ids, tier) => makeEuro(s, tier, ids, foreign));
  s.die = null;
  s.pending = null;
  s.notice = null;
  s.results = null;
  s.seasonSummary = null;
  log(s, `Kausi ${s.season} alkaa.`);
  s.qualified.forEach((ids, tier) => {
    for (const id of ids) {
      club(s, id).cash += EURO_COMPS[tier].entry;
      log(s, `${club(s, id).name} pelaa kilpailussa ${EURO_COMPS[tier].name} ja saa osallistumisrahaa ${fmt(EURO_COMPS[tier].entry)}.`);
    }
  });
  startRound(s);
}

export function createGame(config: GameConfig): GameState {
  const s: GameState = {
    version: STATE_VERSION,
    seed: config.seed | 0, nextId: 1, clubs: [], humans: [], bankrupt: [], order: [], season: 1, round: 0,
    schedule: [], cup: [], qualified: [], euro: [], legendSigned: false, names: { first: [], last: [], foreign: [] }, deck: [], phase: 'roll', die: null, pending: null, notice: null, calendar: [], week: 0, results: null,
    seasonSummary: null, log: [],
  };
  const aiOffsets = [1, 0, 1, 0, -1, 0, 1, -1];
  const aiNames = [AI_CLUB_NAMES[0], ...shuffle(s, AI_CLUB_NAMES.slice(1))];
  for (let i = 0; i < LEAGUE_SIZE; i++) {
    const human = config.clubs[i];
    const ai = i - config.clubs.length;
    s.clubs.push({
      id: i,
      name: human ? human.name : aiNames[ai],
      human: !!human,
      ...(human?.computer ? { auto: true } : {}),
      color: human ? human.color : '#7b8794',
      cash: START_CASH,
      squad: newSquad(s, human ? 0 : aiOffsets[ai]),
      formation: human ? '4-4-2' : pick(s, ['4-4-2', '4-3-3', '5-3-2', '3-4-3', '4-4-2'] as FormationId[]),
      boardPos: 0,
      morale: 0,
    });
    if (human) s.humans.push(i);
  }
  // Managers have to earn Europe: in the first season the places go to the strongest computer clubs.
  const total = (c: Club) => c.squad.reduce((sum, p) => sum + p.skill, 0);
  const seeded = s.clubs.filter((c) => !c.human).sort((a, b) => total(b) - total(a) || a.id - b.id).map((c) => c.id);
  s.qualified = [[seeded[0]], [seeded[1]], [seeded[2], seeded[3]]];
  startSeason(s);
  return s;
}

// ---------- turn ----------

function payWages(c: Club, lines: string[]) {
  const w = wages(c);
  c.cash -= w;
  lines.push(`Viikon palkat: maksat ${fmt(w)}.`);
}

function addYouth(s: GameState, c: Club, lines: string[]) {
  if (c.squad.length >= MAX_SQUAD) {
    lines.push('Joukkue on täynnä, joten juniori jää akatemiaan.');
    return;
  }
  const p = newPlayer(s, randomPos(s), 2 + randInt(s, 3));
  c.squad.push(p);
  lines.push(`Joukkueeseen nousee ${p.name} (${POS_NAME[p.pos]}, taso ${p.skill}).`);
}

/** Managers from best-placed to worst-placed in the league. Bad luck looks for the first, good luck for the last. */
export const standing = (s: GameState) => [...s.humans].sort((a, b) => position(s, a) - position(s, b));

function startAuction(
  s: GameState, player: Player, starter: number, subsidy: { club: number; amount: number } | null,
  barred: number | null = null, owner: number | null = null,
) {
  const from = Math.max(0, s.humans.indexOf(starter));
  const active = s.humans.map((_, i) => s.humans[(from + i) % s.humans.length]).filter((id) => id !== barred);
  s.pending = { kind: 'auction', player, minBid: Math.round(valueOf(player) / 10) * 5, bid: 0, leader: null, active, idx: 0, subsidy, owner };
}

const bestPlayer = (c: Club) => [...c.squad].sort((a, b) => b.skill - a.skill || b.spirit - a.spirit)[0] as Player | undefined;

function playCard(s: GameState, c: Club, card: Card, lines: string[]) {
  const starters = lineup(c).slots.flatMap((x) => (x.player ? [x.player] : []));
  const target = starters.length ? pick(s, starters) : null;
  const text = card.text.replace('{p}', target?.name ?? 'Pelaaja');
  lines.push(text);
  switch (card.kind) {
    case 'cash':
      c.cash += card.amount;
      lines.push(`${card.amount > 0 ? 'Saat' : 'Maksat'} ${fmt(Math.abs(card.amount))}.`);
      break;
    case 'form':
      if (target) target.form = { amount: card.amount, matches: card.matches };
      break;
    case 'ban':
      if (target) { target.out = Math.max(target.out, 1); target.outReason = 'ban'; }
      break;
    case 'leave':
      if (c.squad.length <= MIN_SQUAD) {
        lines.push('Joukkueessa on kuitenkin niin vähän pelaajia, että hän suostuu jäämään.');
      } else if (target) {
        const fee = valueOf(target);
        c.squad.splice(c.squad.indexOf(target), 1);
        c.cash += fee;
        lines.push(`Saat hänestä täyden hinnan, ${fmt(fee)}.`);
      }
      break;
    case 'raid': {
      // Success draws attention: the manager placed highest in the league is the one who loses a star.
      const victim = club(s, standing(s)[0]);
      const star = bestPlayer(victim);
      if (!star || victim.squad.length <= MIN_SQUAD) {
        lines.push(`${victim.name} on sarjan parhaiten sijoittunut manageriseura, mutta kauppaa ei synny.`);
        break;
      }
      const fee = Math.round(valueOf(star) / 2);
      victim.squad.splice(victim.squad.indexOf(star), 1);
      victim.cash += fee;
      lines.push(`${victim.name} menettää parhaan pelaajansa: ${star.name} lähtee, ja seura saa vain puolet hänen arvostaan, ${fmt(fee)}.`);
      break;
    }
    case 'leaderOut': {
      const victim = club(s, standing(s)[0]);
      const star = bestPlayer({ ...victim, squad: victim.squad.filter((p) => p.out === 0) });
      if (!star) break;
      star.out = card.matches;
      star.outReason = card.reason;
      lines.push(`${victim.name} on managereista parhaiten sijoittunut: ${star.name} ${card.reason === 'ban' ? 'saa pelikieltoa' : 'on sivussa'} ${card.matches} ottelua.`);
      break;
    }
    case 'prodigy': {
      const order = standing(s);
      const lucky = club(s, order[order.length - 1]);
      if (lucky.squad.length >= MAX_SQUAD) {
        lines.push(`${lucky.name} on managereista heikoiten sijoittunut, mutta joukkue on täynnä.`);
        break;
      }
      const p = newPlayer(s, randomPos(s), 6 + randInt(s, 2));
      lucky.squad.push(p);
      lines.push(`${lucky.name} on managereista heikoiten sijoittunut ja saa hänet ilmaiseksi: ${p.name} (${POS_NAME[p.pos]}, taito ${p.skill}).`);
      break;
    }
    case 'luckyDraw': {
      if (c.squad.length >= MAX_SQUAD) {
        lines.push('Joukkue on täynnä, joten joudut kieltäytymään.');
        break;
      }
      const p = newPlayer(s, randomPos(s), 2 + randInt(s, 7));
      c.squad.push(p);
      lines.push(`Joukkueeseen liittyy ${p.name} (${POS_NAME[p.pos]}, taito ${p.skill}).`);
      break;
    }
    case 'legend': {
      if (s.legendSigned) {
        lines.push('Hän on kuitenkin jo löytänyt seuran.');
        break;
      }
      const leo: Player = { ...newPlayer(s, LEGEND.pos, LEGEND.skill), name: LEGEND.name, spirit: LEGEND.spirit, legend: true };
      startAuction(s, leo, c.id, null);
      break;
    }
    case 'renegotiate': {
      const star = bestPlayer(c);
      if (!star || c.squad.length <= MIN_SQUAD) {
        lines.push('Joukkueessa on kuitenkin niin vähän pelaajia, että hän suostuu jatkamaan vanhalla sopimuksella.');
        break;
      }
      lines.push(`Huutokaupattavana on ${star.name}.`);
      startAuction(s, structuredClone(star), c.id, null, null, c.id);
      break;
    }
    case 'steal': {
      const order = standing(s);
      if (order.length > 1 && order[0] === c.id) {
        lines.push('Olet kuitenkin managereista parhaiten sijoittunut, eikä kukaan halua vahvistaa kärkiseuraa. Kortti raukeaa.');
      } else if (c.squad.length >= MAX_SQUAD) {
        lines.push('Joukkueesi on kuitenkin täynnä. Kortti raukeaa.');
      } else {
        s.pending = { kind: 'steal' };
      }
      break;
    }
    case 'expire': {
      const star = bestPlayer(c);
      if (star && c.squad.length > MIN_SQUAD) {
        c.squad.splice(c.squad.indexOf(star), 1);
        lines.push(`${star.name} lähtee, eikä seura saa hänestä mitään.`);
      } else {
        lines.push('Joukkueessa on kuitenkin niin vähän pelaajia, että hän suostuu jatkamaan.');
      }
      break;
    }
    case 'wealthTax': {
      const richest = s.humans.map((id) => club(s, id)).sort((a, b) => b.cash - a.cash)[0];
      const amount = Math.max(0, Math.round(richest.cash * card.share));
      richest.cash -= amount;
      lines.push(`${richest.name} on managereista rikkain ja maksaa ${fmt(amount)}.`);
      break;
    }
    case 'heal':
      for (const p of c.squad) {
        if (p.outReason === 'injury') { p.out = 0; delete p.outReason; }
      }
      break;
    case 'morale':
      c.morale = card.amount;
      break;
    case 'surge':
      c.surge = true;
      break;
    case 'spirit':
      if (target) target.spirit = Math.max(1, Math.min(9, target.spirit + card.amount));
      break;
    case 'fitness':
      for (const p of c.squad) p.fitness = FULL_FITNESS;
      break;
    case 'youth':
      addYouth(s, c, lines);
      break;
    case 'collect': {
      const others = s.humans.filter((id) => id !== c.id);
      for (const id of others) club(s, id).cash -= card.amount;
      c.cash += card.amount * others.length;
      lines.push(`Saat yhteensä ${fmt(card.amount * others.length)}.`);
      break;
    }
    case 'auction': {
      const player = newPlayer(s, randomPos(s), card.min + randInt(s, card.max - card.min + 1));
      const order = standing(s);
      // A player who turns up out of the blue is not for the side that is already winning.
      const barred = order.length > 1 ? order[0] : null;
      const last = order[order.length - 1];
      if (barred !== null) lines.push(`${club(s, barred).name} on managereista parhaiten sijoittunut eikä saa osallistua.`);
      if (card.subsidy) lines.push(`Sponsori maksaa ${fmt(card.subsidy)}, jos ${club(s, last).name} voittaa.`);
      startAuction(s, player, c.id, card.subsidy ? { club: last, amount: card.subsidy } : null, barred);
      break;
    }
    case 'goto':
      do c.boardPos = (c.boardPos + 1) % BOARD.length; while (BOARD[c.boardPos] !== card.square);
      landOn(s, c, lines);
      break;
    case 'freeTraining':
      s.pending = { kind: 'training', free: true };
      break;
  }
}

function drawCard(s: GameState): Card {
  for (;;) {
    if (!s.deck.length) s.deck = shuffle(s, CARDS.map((_, i) => i));
    const card = CARDS[s.deck.pop()!];
    if (card.kind !== 'legend' || !s.legendSigned) return card;
  }
}

/** Resolves the square the club stands on. */
function landOn(s: GameState, c: Club, lines: string[]) {
  switch (BOARD[c.boardPos]) {
    case 'start':
      break;
    case 'sponsor': {
      const amount = 30 + 5 * (LEAGUE_SIZE - position(s, c.id));
      c.cash += amount;
      lines.push(`Sponsori maksaa ${fmt(amount)}.`);
      break;
    }
    case 'tax': {
      const amount = Math.max(0, Math.round(c.cash * 0.1));
      c.cash -= amount;
      lines.push(amount > 0 ? `Verottaja vie kymmenen prosenttia kassasta: ${fmt(amount)}.` : 'Kassa on tyhjä, joten verottaja lähtee tyhjin käsin.');
      break;
    }
    case 'rest':
      lines.push('Vapaapäivä. Mitään ei tapahdu.');
      break;
    case 'injury': {
      const starters = lineup(c).slots.flatMap((x) => (x.player ? [x.player] : []));
      if (starters.length) {
        const p = pick(s, starters);
        const n = 1 + randInt(s, 3);
        p.out = n;
        p.outReason = 'injury';
        lines.push(`${p.name} loukkaantuu harjoituksissa ja on sivussa ${n === 1 ? 'yhden ottelun' : `${n} ottelua`}.`);
      }
      break;
    }
    case 'academy':
      addYouth(s, c, lines);
      break;
    case 'press':
      playCard(s, c, drawCard(s), lines);
      break;
    case 'training':
      s.pending = { kind: 'training', free: false };
      break;
    case 'scout':
      s.pending = { kind: 'scout', options: [0, 1, 2].map(() => newPlayer(s, randomPos(s), 3 + randInt(s, 4))) };
      break;
    case 'auction':
      s.pending = { kind: 'auctionPick', options: [0, 1].map(() => newPlayer(s, randomPos(s), 5 + Math.floor(Math.pow(rand(s), 1.5) * 5))) };
      break;
  }
}

function finishLanding(s: GameState, c: Club, lines: string[]) {
  s.phase = 'manage';
  s.notice = { square: c.boardPos, lines };
  for (const line of lines) log(s, `${c.name}: ${line}`);
}

function roll(s: GameState) {
  const c = club(s, currentClubId(s));
  const die = 1 + randInt(s, 6);
  const lines: string[] = [];
  s.die = die;
  payWages(c, lines);
  if (c.boardPos + die >= BOARD.length) {
    c.cash += LAP_BONUS;
    lines.push(`Kierros täynnä: saat kierrosbonuksen ${fmt(LAP_BONUS)}.`);
  }
  c.boardPos = (c.boardPos + die) % BOARD.length;
  landOn(s, c, lines);
  finishLanding(s, c, lines);
}

/** Plays one specific card for the club whose turn it is, as if it had just been drawn. */
export function playCardNow(state: GameState, index: number): GameState {
  const s = structuredClone(state);
  const c = club(s, currentClubId(s));
  const lines: string[] = [];
  playCard(s, c, CARDS[index], lines);
  finishLanding(s, c, lines);
  return s;
}

function settleAuction(s: GameState) {
  const a = s.pending;
  if (a?.kind !== 'auction') return;
  if (a.active.length === 0) {
    s.notice!.lines.push(a.owner === null
      ? `Kukaan ei huutanut. ${a.player.name} jää ilman seuraa.`
      : `Kukaan ei huutanut. ${a.player.name} jatkaa vanhalla sopimuksella.`);
    s.pending = null;
  } else if (a.active.length === 1 && a.leader === a.active[0]) {
    const winner = club(s, a.leader);
    const sponsored = a.subsidy?.club === winner.id ? Math.min(a.subsidy.amount, a.bid) : 0;
    winner.cash -= a.bid - sponsored;
    if (a.player.legend) s.legendSigned = true;
    if (a.owner === null) {
      winner.squad.push(a.player);
    } else if (a.owner !== winner.id) {
      // A re-negotiation lost: the player moves, and his old club is paid the price.
      const seller = club(s, a.owner);
      const i = seller.squad.findIndex((x) => x.id === a.player.id);
      winner.squad.push(...seller.squad.splice(i, 1));
      seller.cash += a.bid;
    }
    const kept = a.owner === winner.id;
    const line = kept
      ? `${winner.name} pitää pelaajansa: ${a.player.name} saa uuden sopimuksen, joka maksaa ${fmt(a.bid)}.`
      : a.owner !== null
        ? `${winner.name} vie pelaajan ${a.player.name} hintaan ${fmt(a.bid)}. ${club(s, a.owner).name} saa kauppahinnan.`
        : `${winner.name} voittaa huutokaupan: ${a.player.name} (${POS_NAME[a.player.pos]}, taso ${a.player.skill}) hintaan ${fmt(a.bid)}.${sponsored ? ` Sponsori maksaa siitä ${fmt(sponsored)}.` : ''}`;
    s.notice!.lines.push(line);
    log(s, line);
    s.pending = null;
  }
}

/** Plays whatever this week holds: a league round, a cup round or a European round. */
function playMatchday(s: GameState) {
  const week = s.calendar[s.week];
  if (week.kind === 'league') playLeagueRound(s);
  else if (week.kind === 'cup') playCupRound(s, week.index);
  else {
    for (const comp of s.euro) playEuroRound(s, comp, week.index);
    restOthers(s, s.euro.flatMap((comp) => comp.rounds[week.index]));
  }
  // A rest lasts for one week's match.
  for (const c of s.clubs) for (const p of c.squad) delete p.resting;
  s.results = week;
  s.phase = 'matchday';
  s.notice = null;
  s.die = null;
}

function playLeagueRound(s: GameState) {
  const before = table(s);
  const posOf = (id: number) => before.findIndex((r) => r.id === id) + 1;
  const streaks = new Map(s.clubs.map((c) => [c.id, winStreak(s, c.id)]));
  for (const f of s.schedule[s.round]) {
    const home = club(s, f.home);
    const away = club(s, f.away);
    const h = lineup(home);
    const a = lineup(away);
    const played = playMatch(
      s, h, a,
      HOME_CHANCES + MORALE_CHANCES * home.morale + spiritBonus(h, a, false),
      MORALE_CHANCES * away.morale + spiritBonus(a, h, true),
      !!home.surge, !!away.surge,
    );
    applyFatigue(home, h, true);
    applyFatigue(away, a, true);
    f.hg = played.ag;
    f.ag = played.bg;
    f.chances = played.chances;
    f.events = played.events;
    f.gate = gateIncome(posOf(home.id), posOf(away.id), streaks.get(home.id));
    home.cash += f.gate;
    log(s, `${home.name} – ${away.name} ${f.hg}–${f.ag}${home.human ? `. Lipputulot ${fmt(f.gate)}.` : ''}`);
  }
  for (const c of s.clubs) {
    c.morale = 0;
    delete c.surge;
    for (const p of c.squad) {
      if (p.out > 0 && --p.out === 0) delete p.outReason;
      if (p.form && p.form.matches !== null && --p.form.matches <= 0) delete p.form;
    }
  }
}

function playCupRound(s: GameState, cupRound: number) {
  const ties = s.cup[cupRound];
  const winners = ties.map((t) => {
    const won = playTie(s, t, cupGate(cupRound));
    if (t.a.clubId !== null || t.b.clubId !== null) log(s, `Cup, ${CUP_ROUND_NAMES[cupRound].toLowerCase()}: ${tieLine(s, t)}`);
    return won;
  });
  restOthers(s, ties);
  if (ties.length > 1) {
    s.cup.push(makeTies(winners));
    return;
  }
  const final = ties[0];
  const loser = final.winner === 'a' ? final.b : final.a;
  if (winners[0].clubId !== null) {
    const c = club(s, winners[0].clubId);
    c.cash += CUP_PRIZE.winner;
  }
  if (loser.clubId !== null) {
    const c = club(s, loser.clubId);
    c.cash += CUP_PRIZE.finalist;
  }
  log(s, `${entrantName(s, winners[0])} voittaa cupin.`);
}

export const entrantName = (s: GameState, e: Entrant) => (e.clubId === null ? e.name : s.clubs[e.clubId].name);
const tieLine = (s: GameState, t: Tie) => `${entrantName(s, t.a)} – ${entrantName(s, t.b)} ${t.ag}–${t.bg}${t.pens ? ' (rp.)' : ''}`;

/** Plays one knockout match on neutral ground and returns the side that goes through. */
function playTie(s: GameState, t: Tie, gate: number): Entrant {
  t.gate = gate;
  for (const e of [t.a, t.b]) if (e.clubId !== null) club(s, e.clubId).cash += gate;
  // A club from outside the league plays like a 4-4-2 whose players are all of its level.
  const strength = (e: Entrant): Strength =>
    e.clubId === null
      ? { att: 2 * e.level, mid: 4 * e.level, def: 4 * e.level, gk: e.level, spirit: 5, shape: FORMATIONS['4-4-2'] }
      : lineup(club(s, e.clubId));
  const a = strength(t.a);
  const b = strength(t.b);
  // Morale (from a card or a promised bonus) counts in the club's next match, whatever the competition.
  const mood = (e: Entrant) => {
    if (e.clubId === null) return 0;
    const c = club(s, e.clubId);
    const bonus = MORALE_CHANCES * c.morale;
    c.morale = 0;
    return bonus;
  };
  ({ ag: t.ag, bg: t.bg, events: t.events } = playMatch(s, a, b, spiritBonus(a, b, true) + mood(t.a), spiritBonus(b, a, true) + mood(t.b)));
  t.pens = t.ag === t.bg;
  t.winner = t.ag > t.bg ? 'a' : t.bg > t.ag ? 'b' : rand(s) < shootoutOdds(a, b) ? 'a' : 'b';
  if (t.pens) {
    if (t.winner === 'a') t.ag++;
    else t.bg++;
  }
  if (t.a.clubId !== null) applyFatigue(club(s, t.a.clubId), a as Lineup, false);
  if (t.b.clubId !== null) applyFatigue(club(s, t.b.clubId), b as Lineup, false);
  return t[t.winner];
}

/** A cup or European week is a week off for every club not involved: their players recover. */
function restOthers(s: GameState, ties: Tie[]) {
  const playing = new Set(ties.flatMap((t) => [t.a.clubId, t.b.clubId]));
  for (const c of s.clubs) {
    if (playing.has(c.id)) continue;
    for (const p of c.squad) p.fitness = Math.min(FULL_FITNESS, p.fitness + ROUND_RECOVERY);
  }
}

function playEuroRound(s: GameState, comp: EuroComp, round: number) {
  const info = EURO_COMPS[comp.tier];
  const ties = comp.rounds[round];
  const winners = ties.map((t) => {
    const won = playTie(s, t, euroGate(comp.tier, round));
    if (won.clubId !== null) club(s, won.clubId).cash += info.win;
    if (t.a.clubId !== null || t.b.clubId !== null) log(s, `${info.name}, ${EURO_ROUND_NAMES[round].toLowerCase()}: ${tieLine(s, t)}`);
    return won;
  });
  if (ties.length > 1) {
    comp.rounds.push(makeTies(winners));
    return;
  }
  const final = ties[0];
  const loser = final.winner === 'a' ? final.b : final.a;
  if (winners[0].clubId !== null) {
    club(s, winners[0].clubId).cash += info.title.winner;
    log(s, `${club(s, winners[0].clubId).name} voittaa kilpailun ${info.name}.`);
  }
  if (loser.clubId !== null) club(s, loser.clubId).cash += info.title.finalist;
}

function endSeason(s: GameState) {
  s.seasonSummary = table(s).map((row, i) => {
    const c = club(s, row.id);
    c.cash += LEAGUE_PRIZE[i];
    return { id: row.id, pos: i + 1, prize: LEAGUE_PRIZE[i] };
  });
  const ids = s.seasonSummary.map((row) => row.id);
  s.qualified = [[ids[0]], [ids[1]], [ids[2], ids[3]]];
  log(s, `Kausi ${s.season} päättyy. Mestari on ${club(s, s.seasonSummary[0].id).name}.`);
  s.phase = 'seasonEnd';
}

function nextSeason(s: GameState) {
  s.season++;
  for (const c of s.clubs) {
    c.morale = 0;
    for (const p of c.squad) { p.out = 0; p.fitness = FULL_FITNESS; delete p.outReason; delete p.form; }
    if (!c.human) {
      for (let i = 0; i < 3; i++) {
        const p = pick(s, c.squad);
        p.skill = Math.min(9, p.skill + 1);
      }
    }
  }
  startSeason(s);
}

export const squadValue = (c: Club) => c.squad.reduce((sum, p) => sum + valueOf(p), 0);
/** What decides the game when the managers choose to count up: cash plus the value of the squad. */
export const wealth = (c: Club) => c.cash + squadValue(c);

function endTurn(s: GameState) {
  s.order.shift();
  s.die = null;
  s.notice = null;
  s.pending = null;
  if (s.order.length) s.phase = 'roll';
  else if (s.humans.length) playMatchday(s);
  else s.phase = 'gameOver';
}

/** The manager is out. The club stays in the league under the computer, topped up to a playable squad. */
function goBankrupt(s: GameState, c: Club) {
  log(s, `${c.name} ei pysty maksamaan velkojaan. Manageri putoaa pelistä, ja tietokone ottaa seuran hoitoonsa.`);
  c.human = false;
  delete c.auto;
  c.bankrupt = true;
  c.cash = 0;
  if (!c.squad.some((p) => p.pos === 'MV')) c.squad.push(newPlayer(s, 'MV', 3));
  while (c.squad.length < 14) c.squad.push(newPlayer(s, randomPos(s), 3));
  s.humans = s.humans.filter((id) => id !== c.id);
  s.bankrupt.push(c.id);
  endTurn(s);
}

// ---------- reducer ----------

export function reduce(state: GameState, action: Action): GameState {
  const s = structuredClone(state);
  const me = club(s, currentClubId(s));
  const inTurn = s.phase === 'roll' || s.phase === 'manage';
  const p = s.pending;

  switch (action.type) {
    case 'ROLL':
      if (s.phase !== 'roll') return state;
      roll(s);
      return s;

    case 'AUCTION_PICK': {
      if (p?.kind !== 'auctionPick' || !p.options[action.index]) return state;
      const player = p.options[action.index];
      startAuction(s, player, me.id, null);
      return s;
    }

    case 'BID': {
      if (p?.kind !== 'auction') return state;
      const bidder = club(s, p.active[p.idx]);
      const min = p.leader === null ? p.minBid : p.bid + 5;
      const full = bidder.squad.length >= MAX_SQUAD && bidder.id !== p.owner;
      if (action.amount < min || action.amount > bidder.cash || full) return state;
      p.bid = action.amount;
      p.leader = bidder.id;
      p.idx = (p.idx + 1) % p.active.length;
      settleAuction(s);
      return s;
    }

    case 'PASS': {
      if (p?.kind !== 'auction') return state;
      p.active.splice(p.idx, 1);
      if (p.active.length) p.idx %= p.active.length;
      settleAuction(s);
      return s;
    }

    case 'SCOUT_BUY': {
      if (p?.kind !== 'scout') return state;
      const player = p.options[action.index];
      if (!player || me.cash < valueOf(player) || me.squad.length >= MAX_SQUAD) return state;
      me.cash -= valueOf(player);
      me.squad.push(player);
      const line = `Ostat pelaajan ${player.name} (${POS_NAME[player.pos]}, taso ${player.skill}) hintaan ${fmt(valueOf(player))}.`;
      s.notice!.lines.push(line);
      log(s, `${me.name}: ${line}`);
      s.pending = null;
      return s;
    }

    case 'TRAIN': {
      if (p?.kind !== 'training') return state;
      const player = me.squad.find((x) => x.id === action.playerId);
      if (!player || player.skill >= MAX_LEVEL) return state;
      const cost = p.free ? 0 : trainingCost(player);
      if (cost > 0 && me.cash < cost) return state;
      me.cash -= cost;
      player.skill++;
      const line = `${player.name} käy harjoitusleirillä. Taso nousee ${player.skill}:een.`;
      s.notice!.lines.push(line);
      log(s, `${me.name}: ${line}`);
      s.pending = null;
      return s;
    }

    case 'SKIP':
      if (p?.kind !== 'scout' && p?.kind !== 'training' && p?.kind !== 'steal') return state;
      s.pending = null;
      return s;

    case 'STEAL': {
      if (p?.kind !== 'steal' || action.clubId === me.id || me.squad.length >= MAX_SQUAD) return state;
      const victim = s.clubs.find((c) => c.id === action.clubId);
      const i = victim ? victim.squad.findIndex((x) => x.id === action.playerId) : -1;
      if (!victim || i < 0 || victim.squad.length <= MIN_SQUAD) return state;
      const [taken] = victim.squad.splice(i, 1);
      me.squad.push(taken);
      const line = `${me.name} houkuttelee pelaajan ${taken.name} (${POS_NAME[taken.pos]}, taito ${taken.skill}) seurasta ${victim.name}.`;
      s.notice!.lines.push(line);
      log(s, line);
      s.pending = null;
      return s;
    }

    case 'SET_FORMATION':
      if (!inTurn || p) return state;
      me.formation = action.formation;
      return s;

    case 'SELL': {
      // Selling is also allowed in the middle of an offer, so a manager can raise the money for it.
      const seller = club(s, actingClubId(s));
      if (!inTurn || seller.squad.length <= MIN_SQUAD) return state;
      const i = seller.squad.findIndex((x) => x.id === action.playerId);
      // A player who is under the hammer himself cannot be sold from under the bidders.
      if (i < 0 || (p?.kind === 'auction' && p.player.id === action.playerId)) return state;
      const [sold] = seller.squad.splice(i, 1);
      seller.cash += sellPrice(sold);
      log(s, `${seller.name} myy pelaajan ${sold.name} hintaan ${fmt(sellPrice(sold))}.`);
      return s;
    }

    case 'REST': {
      if (!inTurn || p) return state;
      const player = me.squad.find((x) => x.id === action.playerId);
      if (!player) return state;
      if (player.resting) delete player.resting;
      else player.resting = true;
      return s;
    }

    case 'MATCH_BONUS':
      if (!inTurn || p || me.morale >= 1 || me.cash < MATCH_BONUS_COST) return state;
      me.cash -= MATCH_BONUS_COST;
      me.morale = 1;
      log(s, `${me.name} lupaa pelaajille ottelubonuksen (${fmt(MATCH_BONUS_COST)}).`);
      return s;

    case 'BANKRUPT':
      if (!inTurn || p || !isBroke(me)) return state;
      goBankrupt(s, me);
      return s;

    case 'END_TURN':
      if (s.phase !== 'manage' || p || mustSell(me)) return state;
      endTurn(s);
      return s;

    case 'CONTINUE':
      if (s.phase === 'matchday') {
        if (s.results?.kind === 'league') s.round++;
        s.results = null;
        s.week++;
        if (s.week >= s.calendar.length) endSeason(s);
        else startRound(s);
        return s;
      }
      if (s.phase === 'seasonEnd') {
        if (s.humans.length === 0) s.phase = 'gameOver';
        else nextSeason(s);
        return s;
      }
      return state;

    case 'FINISH':
      if (s.phase !== 'seasonEnd') return state;
      s.phase = 'gameOver';
      return s;
  }
}
