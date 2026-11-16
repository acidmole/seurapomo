import {
  AI_CLUB_NAMES, BOARD, CUP_ROUND_NAMES, EURO_COMPS, EURO_ROUND_NAMES, CARDS, FIRST_NAMES, FOREIGN_CLUBS, FORMATIONS, LAST_NAMES, POS_NAME, fmt,
  type Card, type FormationId, type Pos,
} from './data';

export const START_CASH = 80;
export const MAX_SQUAD = 20;
/** A manager whose squad would fall below this is out of the game. */
export const MIN_SQUAD = 11;
export const LEAGUE_SIZE = 10;
export const ROUNDS = (LEAGUE_SIZE - 1) * 2;
/** Cup rounds are played right after these league rounds (0-based). */
export const CUP_AFTER = [1, 5, 10, 15];
/** European rounds are played right after these league rounds (0-based), from the second season on. */
export const EURO_AFTER = [3, 8, 13];
export const LEAGUE_PRIZE = [130, 100, 80, 65, 50, 40, 30, 20, 10, 0];
export const LEAGUE_VP = [10, 7, 5, 4, 3, 2, 1, 1, 0, 0];
export const CUP_PRIZE = { winner: 100, finalist: 40 };
export const CUP_VP = { winner: 5, finalist: 2 };
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
  /** -1, 0 or 1: applies to the next league match only. */
  morale: number;
  vp: number;
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
}
export interface CupTie { a: number; b: number; ag: number | null; bg: number | null; winner: number | null; pens: boolean }

/** A league club (`clubId`) or a foreign club with fixed ratings. */
export interface EuroEntrant { clubId: number | null; name: string; level: number }
export interface EuroTie { a: EuroEntrant; b: EuroEntrant; ag: number | null; bg: number | null; winner: 'a' | 'b' | null; pens: boolean }
export interface EuroComp { tier: number; rounds: EuroTie[][] }

export type Pending =
  | { kind: 'auctionPick'; options: Player[] }
  | {
      kind: 'auction'; player: Player; minBid: number; bid: number; leader: number | null; active: number[]; idx: number;
      /** A sponsor pays this much of the price if this club wins. */
      subsidy: { club: number; amount: number } | null;
    }
  | { kind: 'scout'; options: Player[] }
  | { kind: 'training'; free: boolean };

export type Phase = 'roll' | 'manage' | 'matchday' | 'seasonEnd' | 'gameOver';

export interface SeasonRow { id: number; pos: number; prize: number; vp: number }

/** Raised whenever the shape of a saved game changes, so an older game is never played with newer rules. */
export const STATE_VERSION = 9;

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
  seasons: number;
  round: number;
  schedule: Fixture[][];
  cup: CupTie[][];
  /** Clubs that skip the cup's preliminary round. */
  cupByes: number[];
  /** Club ids that earned a European place last season, by competition. Empty in the first season. */
  qualified: number[][];
  euro: EuroComp[];
  /** Indexes into CARDS still to be drawn; reshuffled when it runs out. */
  deck: number[];
  phase: Phase;
  die: number | null;
  pending: Pending | null;
  notice: { square: number; lines: string[] } | null;
  results: { round: number; cupRound: number | null; euroRound: number | null } | null;
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
  | { type: 'SET_FORMATION'; formation: FormationId }
  | { type: 'SELL'; playerId: number }
  | { type: 'BANKRUPT' }
  | { type: 'END_TURN' }
  | { type: 'CONTINUE' };

export interface GameConfig { clubs: { name: string; color: string }[]; seasons: number; seed: number }

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
export const sellPrice = (p: Player) => Math.round(playerValue(p.skill, p.spirit) * SELL_RATE);
export const trainingCost = (p: Player) => 5 * p.skill;
/** Paid on every payday, per level of skill in the squad. */
export const WAGE_PER_LEVEL = 2;
export const wages = (c: Club) => Math.round(WAGE_PER_LEVEL * c.squad.reduce((sum, p) => sum + p.skill, 0));

function newPlayer(s: GameState, pos: Pos, skill: number): Player {
  return {
    id: s.nextId++,
    name: `${pick(s, FIRST_NAMES)} ${pick(s, LAST_NAMES)}`,
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
  return positions.map((pos, i) => newPlayer(s, pos, skills[i] + offset));
}

export interface Slot { pos: Pos; player: Player | null; eff: number }
/** What a side brings to a match: summed levels of its forwards, midfielders, defenders and keeper. */
export interface Strength { att: number; mid: number; def: number; gk: number; /** Average sisu of the starters. */ spirit: number; shape: { PU: number; KK: number; HY: number } }
export interface Lineup extends Strength { slots: Slot[] }

/** Best available eleven for the club's formation. Gaps are filled out of position at half skill. */
export function lineup(club: Club): Lineup {
  const f = FORMATIONS[club.formation];
  const avail = club.squad.filter((p) => p.out === 0).sort((a, b) => level(b) - level(a) || b.skill - a.skill);
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

function makeCupRound(ids: number[]): CupTie[] {
  const ties: CupTie[] = [];
  for (let i = 0; i < ids.length; i += 2) ties.push({ a: ids[i], b: ids[i + 1], ag: null, bg: null, winner: null, pens: false });
  return ties;
}

// A match is a series of scoring chances. Midfield decides how many a side gets; each one is then two dice
// against a target that the forwards lower and the defence and keeper raise.
//
// Players count by how far they are above or below the average level on the pitch, so two evenly matched
// sides score the same whether they are all level 3 or all level 8. Formation shape gives fixed shifts on
// top: an extra forward makes every chance better, an extra defender makes every chance against worse, an
// extra midfielder wins chances.
export const CHANCES_BASE = 5;
export const HOME_CHANCES = 0.5;
export const MORALE_CHANCES = 0.5;
export const SCORE_TARGET = 9.15;
/** Target shift per level of a forward or defender; a midfielder moves the chance count by the same amount. */
export const LEVEL_WEIGHT = 0.1;
export const KEEPER_WEIGHT = 1.5;
/** Target shift per forward beyond two, and per defender beyond four. */
export const SHAPE_WEIGHT = 0.45;
/** Chances won per midfielder more than the opponent has. */
export const MIDFIELD_COUNT_CHANCES = 0.5;
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

/** Starters pay for the match; after a league round the whole squad recovers. */
function applyFatigue(c: Club, played: Lineup, leagueRound: boolean) {
  const started = new Set(played.slots.flatMap((x) => (x.player ? [x.player.id] : [])));
  for (const p of c.squad) {
    if (started.has(p.id)) p.fitness = Math.max(1, p.fitness - MATCH_FATIGUE);
    if (leagueRound) p.fitness = Math.min(FULL_FITNESS, p.fitness + ROUND_RECOVERY);
  }
}

/** Probability that two dice total at least `need`, interpolated between whole numbers. */
function twoDiceAtLeast(need: number): number {
  const exact = (k: number) => (k <= 2 ? 1 : k > 12 ? 0 : [36, 35, 33, 30, 26, 21, 15, 10, 6, 3, 1][k - 2] / 36);
  const low = Math.floor(need);
  return exact(low) + (exact(low + 1) - exact(low)) * (need - low);
}

const pitchAverage = (x: Strength, y: Strength) => (x.att + x.mid + x.def + x.gk + y.att + y.mid + y.def + y.gk) / 22;

/** Chance that one scoring chance of `x` ends up in `y`'s net. */
export function scoringOdds(x: Strength, y: Strength): number {
  const avg = pitchAverage(x, y);
  const defence = y.def - y.shape.PU * avg + KEEPER_WEIGHT * (y.gk - avg);
  const attack = x.att - x.shape.HY * avg;
  return twoDiceAtLeast(
    SCORE_TARGET + LEVEL_WEIGHT * (defence - attack) - SHAPE_WEIGHT * (x.shape.HY - 2) + SHAPE_WEIGHT * (y.shape.PU - 4),
  );
}

export function expectedChances(x: Strength, y: Strength, bonus = 0): number {
  const avg = pitchAverage(x, y);
  const quality = x.mid - x.shape.KK * avg - (y.mid - y.shape.KK * avg);
  return Math.max(0.5, CHANCES_BASE + MIDFIELD_COUNT_CHANCES * (x.shape.KK - y.shape.KK) + LEVEL_WEIGHT * quality + bonus);
}

function playSide(s: GameState, x: Strength, y: Strength, bonus: number): { chances: number; goals: number } {
  const chances = poisson(s, expectedChances(x, y, bonus));
  const odds = scoringOdds(x, y);
  let goals = 0;
  for (let i = 0; i < chances; i++) if (rand(s) < odds) goals++;
  return { chances, goals };
}

function playMatch(s: GameState, a: Strength, b: Strength, aBonus = 0, bBonus = 0) {
  const x = playSide(s, a, b, aBonus);
  const y = playSide(s, b, a, bBonus);
  return { ag: x.goals, bg: y.goals, chances: [x.chances, y.chances] as [number, number] };
}

/** Ticket income for a home match. Meetings of teams high in the table draw bigger crowds. */
export function gateIncome(homePos: number, awayPos: number): number {
  return 15 + 3 * (LEAGUE_SIZE - homePos) + 2 * (LEAGUE_SIZE - awayPos);
}

function makeEuroRound(entrants: EuroEntrant[]): EuroTie[] {
  const ties: EuroTie[] = [];
  for (let i = 0; i < entrants.length; i += 2) ties.push({ a: entrants[i], b: entrants[i + 1], ag: null, bg: null, winner: null, pens: false });
  return ties;
}

/** Eight-club knockout. Two league clubs in the same competition start in opposite halves. */
function makeEuro(s: GameState, tier: number, clubIds: number[], names: string[]): EuroComp {
  const info = EURO_COMPS[tier];
  const level = () => info.level[0] + rand(s) * (info.level[1] - info.level[0]) + 0.3 * (s.season - 2);
  const entrants = Array.from({ length: 8 }, (_, i): EuroEntrant => {
    const clubId = i === 0 ? clubIds[0] : i === 4 ? clubIds[1] : undefined;
    return clubId !== undefined
      ? { clubId, name: '', level: 0 }
      : { clubId: null, name: names.pop()!, level: level() };
  });
  return { tier, rounds: [makeEuroRound(entrants)] };
}

// ---------- helpers ----------

const club = (s: GameState, id: number) => s.clubs.find((c) => c.id === id)!;
export const currentClubId = (s: GameState) => s.order[0] ?? s.humans[s.round % Math.max(1, s.humans.length)] ?? 0;

/** Every manager moves once per round; who goes first rotates. */
function startRound(s: GameState) {
  const n = s.humans.length;
  s.order = s.humans.map((_, i) => s.humans[(s.round + i) % n]);
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
  s.schedule = makeSchedule(s);
  const cupDraw = shuffle(s, s.clubs.map((c) => c.id));
  s.cup = [makeCupRound(cupDraw.slice(0, 4))];
  s.cupByes = cupDraw.slice(4);
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
    seed: config.seed | 0, nextId: 1, clubs: [], humans: [], bankrupt: [], order: [], season: 1, seasons: config.seasons, round: 0,
    schedule: [], cup: [], cupByes: [], qualified: [], euro: [], deck: [], phase: 'roll', die: null, pending: null, notice: null, results: null,
    seasonSummary: null, log: [],
  };
  const aiOffsets = [1, 0, 1, 0, -1, 0, 1, -1];
  for (let i = 0; i < LEAGUE_SIZE; i++) {
    const human = config.clubs[i];
    const ai = i - config.clubs.length;
    s.clubs.push({
      id: i,
      name: human ? human.name : AI_CLUB_NAMES[ai],
      human: !!human,
      color: human ? human.color : '#7b8794',
      cash: START_CASH,
      squad: newSquad(s, human ? 0 : aiOffsets[ai]),
      formation: human ? '4-4-2' : pick(s, ['4-4-2', '4-3-3', '4-4-2', '5-3-2'] as FormationId[]),
      boardPos: 0,
      morale: 0,
      vp: 0,
    });
    if (human) s.humans.push(i);
  }
  startSeason(s);
  return s;
}

// ---------- turn ----------

function payday(s: GameState, c: Club, lines: string[]) {
  const w = wages(c);
  c.cash -= w;
  lines.push(`Palkkapäivä: maksat palkkoja ${fmt(w)}.`);
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

function startAuction(s: GameState, player: Player, starter: number, subsidy: { club: number; amount: number } | null) {
  const from = Math.max(0, s.humans.indexOf(starter));
  const active = s.humans.map((_, i) => s.humans[(from + i) % s.humans.length]);
  s.pending = { kind: 'auction', player, minBid: Math.round(playerValue(player.skill, player.spirit) / 10) * 5, bid: 0, leader: null, active, idx: 0, subsidy };
}

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
        const fee = playerValue(target.skill, target.spirit);
        c.squad.splice(c.squad.indexOf(target), 1);
        c.cash += fee;
        lines.push(`Saat hänestä täyden hinnan, ${fmt(fee)}.`);
      }
      break;
    case 'heal':
      for (const p of c.squad) {
        if (p.outReason === 'injury') { p.out = 0; delete p.outReason; }
      }
      break;
    case 'morale':
      c.morale = card.amount;
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
      if (card.subsidy) lines.push(`Sponsorin osuus on ${fmt(card.subsidy)}.`);
      startAuction(s, player, c.id, card.subsidy ? { club: c.id, amount: card.subsidy } : null);
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
  if (!s.deck.length) s.deck = shuffle(s, CARDS.map((_, i) => i));
  return CARDS[s.deck.pop()!];
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
  if (c.boardPos + die >= BOARD.length) payday(s, c, lines);
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
    s.notice!.lines.push(`Kukaan ei huutanut. ${a.player.name} jää ilman seuraa.`);
    s.pending = null;
  } else if (a.active.length === 1 && a.leader === a.active[0]) {
    const winner = club(s, a.leader);
    const sponsored = a.subsidy?.club === winner.id ? Math.min(a.subsidy.amount, a.bid) : 0;
    winner.cash -= a.bid - sponsored;
    winner.squad.push(a.player);
    const line = `${winner.name} voittaa huutokaupan: ${a.player.name} (${POS_NAME[a.player.pos]}, taso ${a.player.skill}) hintaan ${fmt(a.bid)}.${sponsored ? ` Sponsori maksaa siitä ${fmt(sponsored)}.` : ''}`;
    s.notice!.lines.push(line);
    log(s, line);
    s.pending = null;
  }
}

function playMatchday(s: GameState) {
  const before = table(s);
  const posOf = (id: number) => before.findIndex((r) => r.id === id) + 1;
  for (const f of s.schedule[s.round]) {
    const home = club(s, f.home);
    const away = club(s, f.away);
    const h = lineup(home);
    const a = lineup(away);
    const played = playMatch(
      s, h, a,
      HOME_CHANCES + MORALE_CHANCES * home.morale + spiritBonus(h, a, false),
      MORALE_CHANCES * away.morale + spiritBonus(a, h, true),
    );
    applyFatigue(home, h, true);
    applyFatigue(away, a, true);
    f.hg = played.ag;
    f.ag = played.bg;
    f.chances = played.chances;
    f.gate = gateIncome(posOf(home.id), posOf(away.id));
    home.cash += f.gate;
    log(s, `${home.name} – ${away.name} ${f.hg}–${f.ag}${home.human ? `. Lipputulot ${fmt(f.gate)}.` : ''}`);
  }
  for (const c of s.clubs) {
    c.morale = 0;
    for (const p of c.squad) {
      if (p.out > 0 && --p.out === 0) delete p.outReason;
      if (p.form && p.form.matches !== null && --p.form.matches <= 0) delete p.form;
    }
  }

  const cupRound = CUP_AFTER.indexOf(s.round);
  if (cupRound >= 0) {
    const ties = s.cup[cupRound];
    for (const t of ties) {
      const a = club(s, t.a);
      const b = club(s, t.b);
      const la = lineup(a);
      const lb = lineup(b);
      ({ ag: t.ag, bg: t.bg } = playMatch(s, la, lb, spiritBonus(la, lb, true), spiritBonus(lb, la, true)));
      t.pens = t.ag === t.bg;
      t.winner = t.ag > t.bg ? t.a : t.bg > t.ag ? t.b : rand(s) < shootoutOdds(la, lb) ? t.a : t.b;
      applyFatigue(a, la, false);
      applyFatigue(b, lb, false);
      log(s, `Cup, ${CUP_ROUND_NAMES[cupRound].toLowerCase()}: ${a.name} – ${b.name} ${t.ag}–${t.bg}${t.pens ? ` (rp. ${club(s, t.winner).name})` : ''}`);
    }
    const winners = ties.map((t) => t.winner!);
    if (cupRound === 0) {
      s.cup.push(makeCupRound(shuffle(s, [...winners, ...s.cupByes])));
    } else if (ties.length > 1) {
      s.cup.push(makeCupRound(winners));
    } else {
      const final = ties[0];
      const winner = club(s, final.winner!);
      const loser = club(s, final.winner === final.a ? final.b : final.a);
      winner.cash += CUP_PRIZE.winner;
      winner.vp += CUP_VP.winner;
      loser.cash += CUP_PRIZE.finalist;
      loser.vp += CUP_VP.finalist;
      log(s, `${winner.name} voittaa cupin.`);
    }
  }

  const euroRound = s.euro.length ? EURO_AFTER.indexOf(s.round) : -1;
  if (euroRound >= 0) for (const comp of s.euro) playEuroRound(s, comp, euroRound);

  s.results = { round: s.round, cupRound: cupRound >= 0 ? cupRound : null, euroRound: euroRound >= 0 ? euroRound : null };
  s.phase = 'matchday';
  s.notice = null;
  s.die = null;
}

export const entrantName = (s: GameState, e: EuroEntrant) => (e.clubId === null ? e.name : s.clubs[e.clubId].name);

function playEuroRound(s: GameState, comp: EuroComp, round: number) {
  const info = EURO_COMPS[comp.tier];
  const ties = comp.rounds[round];
  // A foreign club plays like a 4-4-2 whose players are all of its level.
  const strength = (e: EuroEntrant): Strength =>
    e.clubId === null
      ? { att: 2 * e.level, mid: 4 * e.level, def: 4 * e.level, gk: e.level, spirit: 5, shape: FORMATIONS['4-4-2'] }
      : lineup(club(s, e.clubId));
  for (const t of ties) {
    const a = strength(t.a);
    const b = strength(t.b);
    ({ ag: t.ag, bg: t.bg } = playMatch(s, a, b, spiritBonus(a, b, true), spiritBonus(b, a, true)));
    t.pens = t.ag === t.bg;
    t.winner = t.ag > t.bg ? 'a' : t.bg > t.ag ? 'b' : rand(s) < shootoutOdds(a, b) ? 'a' : 'b';
    if (t.a.clubId !== null) applyFatigue(club(s, t.a.clubId), a as Lineup, false);
    if (t.b.clubId !== null) applyFatigue(club(s, t.b.clubId), b as Lineup, false);
    const won = t[t.winner];
    if (won.clubId !== null) club(s, won.clubId).cash += info.win;
    if (t.a.clubId !== null || t.b.clubId !== null) {
      log(s, `${info.name}, ${EURO_ROUND_NAMES[round].toLowerCase()}: ${entrantName(s, t.a)} – ${entrantName(s, t.b)} ${t.ag}–${t.bg}${t.pens ? ` (rp. ${entrantName(s, won)})` : ''}`);
    }
  }
  if (ties.length > 1) {
    comp.rounds.push(makeEuroRound(ties.map((t) => t[t.winner!])));
    return;
  }
  const final = ties[0];
  const winner = final[final.winner!];
  const loser = final.winner === 'a' ? final.b : final.a;
  if (winner.clubId !== null) {
    club(s, winner.clubId).vp += info.vp.winner;
    log(s, `${club(s, winner.clubId).name} voittaa kilpailun ${info.name}.`);
  }
  if (loser.clubId !== null) club(s, loser.clubId).vp += info.vp.finalist;
}

function endSeason(s: GameState) {
  s.seasonSummary = table(s).map((row, i) => {
    const c = club(s, row.id);
    c.cash += LEAGUE_PRIZE[i];
    c.vp += LEAGUE_VP[i];
    return { id: row.id, pos: i + 1, prize: LEAGUE_PRIZE[i], vp: LEAGUE_VP[i] };
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

/** Victory points plus one point per full 100 000 € in the bank. Debt costs points. */
export function finalScore(c: Club): number {
  return c.vp + Math.floor(c.cash / 100);
}

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
      if (action.amount < min || action.amount > bidder.cash || bidder.squad.length >= MAX_SQUAD) return state;
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
      if (!player || me.cash < playerValue(player.skill, player.spirit) || me.squad.length >= MAX_SQUAD) return state;
      me.cash -= playerValue(player.skill, player.spirit);
      me.squad.push(player);
      const line = `Ostat pelaajan ${player.name} (${POS_NAME[player.pos]}, taso ${player.skill}) hintaan ${fmt(playerValue(player.skill, player.spirit))}.`;
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
      if (p?.kind !== 'scout' && p?.kind !== 'training') return state;
      s.pending = null;
      return s;

    case 'SET_FORMATION':
      if (!inTurn || p) return state;
      me.formation = action.formation;
      return s;

    case 'SELL': {
      if (!inTurn || p || me.squad.length <= MIN_SQUAD) return state;
      const i = me.squad.findIndex((x) => x.id === action.playerId);
      if (i < 0) return state;
      const [sold] = me.squad.splice(i, 1);
      me.cash += sellPrice(sold);
      log(s, `${me.name} myy pelaajan ${sold.name} hintaan ${fmt(sellPrice(sold))}.`);
      return s;
    }

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
        s.results = null;
        s.round++;
        if (s.round >= ROUNDS) endSeason(s);
        else startRound(s);
        return s;
      }
      if (s.phase === 'seasonEnd') {
        if (s.season >= s.seasons || s.humans.length === 0) s.phase = 'gameOver';
        else nextSeason(s);
        return s;
      }
      return state;
  }
}
