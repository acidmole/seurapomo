import {
  AI_CLUB_NAMES, BOARD, CUP_ROUND_NAMES, FIRST_NAMES, FORMATIONS, LAST_NAMES, PRESS_EVENTS, POS_NAME, fmt,
  type FormationId, type Pos,
} from './data';

export const START_CASH = 250;
export const MAX_SQUAD = 20;
export const LEAGUE_SIZE = 8;
export const ROUNDS = (LEAGUE_SIZE - 1) * 2;
/** Cup rounds are played right after these league rounds (0-based). */
export const CUP_AFTER = [3, 8, 12];
export const LEAGUE_PRIZE = [120, 90, 70, 50, 40, 30, 20, 10];
export const LEAGUE_VP = [10, 7, 5, 4, 3, 2, 1, 0];
export const CUP_PRIZE = { winner: 100, finalist: 40 };
export const CUP_VP = { winner: 5, finalist: 2 };
export const SELL_RATE = 0.6;

export interface Player {
  id: number;
  name: string;
  pos: Pos;
  skill: number;
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
}

export interface Fixture { home: number; away: number; hg: number | null; ag: number | null }
export interface CupTie { a: number; b: number; ag: number | null; bg: number | null; winner: number | null; pens: boolean }

export type Pending =
  | { kind: 'auctionPick'; options: Player[] }
  | { kind: 'auction'; player: Player; minBid: number; bid: number; leader: number | null; active: number[]; idx: number }
  | { kind: 'scout'; options: Player[] }
  | { kind: 'training' };

export type Phase = 'roll' | 'manage' | 'matchday' | 'seasonEnd' | 'gameOver';

export interface SeasonRow { id: number; pos: number; prize: number; vp: number }

export interface GameState {
  seed: number;
  nextId: number;
  clubs: Club[];
  humans: number[];
  season: number;
  seasons: number;
  round: number;
  schedule: Fixture[][];
  cup: CupTie[][];
  phase: Phase;
  turn: number;
  die: number | null;
  pending: Pending | null;
  notice: { square: number; lines: string[] } | null;
  results: { round: number; cupRound: number | null } | null;
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

export function playerValue(skill: number): number {
  return Math.round((8 + 2.2 * skill * skill) / 5) * 5;
}
export const sellPrice = (p: Player) => Math.round(playerValue(p.skill) * SELL_RATE);
export const trainingCost = (p: Player) => 5 * p.skill;
export const wages = (c: Club) => c.squad.reduce((sum, p) => sum + p.skill, 0);

function newPlayer(s: GameState, pos: Pos, skill: number): Player {
  return {
    id: s.nextId++,
    name: `${pick(s, FIRST_NAMES)} ${pick(s, LAST_NAMES)}`,
    pos,
    skill: Math.max(1, Math.min(10, skill)),
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
export interface Lineup { slots: Slot[]; attack: number; defense: number }

/** Best available eleven for the club's formation. Gaps are filled out of position at half skill. */
export function lineup(club: Club): Lineup {
  const f = FORMATIONS[club.formation];
  const avail = club.squad.filter((p) => p.out === 0).sort((a, b) => b.skill - a.skill);
  const used = new Set<number>();
  const slots: Slot[] = [];
  const need: [Pos, number][] = [['MV', 1], ['PU', f.PU], ['KK', f.KK], ['HY', f.HY]];
  for (const [pos, n] of need) {
    const own = avail.filter((p) => p.pos === pos).slice(0, n);
    for (const p of own) {
      used.add(p.id);
      slots.push({ pos, player: p, eff: p.skill });
    }
    for (let i = own.length; i < n; i++) slots.push({ pos, player: null, eff: 0 });
  }
  for (const slot of slots) {
    if (slot.player) continue;
    const p = avail.find((x) => !used.has(x.id));
    if (!p) break;
    used.add(p.id);
    slot.player = p;
    slot.eff = slot.pos === 'MV' ? 1 : Math.max(1, Math.floor(p.skill / 2));
  }
  const sum = (pos: Pos) => slots.filter((x) => x.pos === pos).reduce((t, x) => t + x.eff, 0);
  return {
    slots,
    attack: sum('HY') + 0.5 * sum('KK'),
    defense: sum('PU') + 0.5 * sum('KK') + 1.5 * sum('MV'),
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
      round.push((r + i) % 2 === 0 ? { home: a, away: b, hg: null, ag: null } : { home: b, away: a, hg: null, ag: null });
    }
    first.push(round);
    t.splice(1, 0, t.pop()!);
  }
  const second = first.map((round) => round.map((f) => ({ home: f.away, away: f.home, hg: null, ag: null })));
  return [...first, ...second];
}

function makeCupRound(ids: number[]): CupTie[] {
  const ties: CupTie[] = [];
  for (let i = 0; i < ids.length; i += 2) ties.push({ a: ids[i], b: ids[i + 1], ag: null, bg: null, winner: null, pens: false });
  return ties;
}

function expectedGoals(attack: number, defense: number): number {
  const ratio = attack / Math.max(defense, 1);
  return Math.max(0.1, Math.min(5, 1.35 * Math.pow(ratio / 0.6, 1.3)));
}

function playMatch(s: GameState, home: Club, away: Club, neutral: boolean): [number, number] {
  const h = lineup(home);
  const a = lineup(away);
  const hm = neutral ? 1 : 1 + 0.1 * home.morale;
  const am = neutral ? 1 : 1 + 0.1 * away.morale;
  const homeEdge = neutral ? 1 : 1.08;
  return [
    poisson(s, expectedGoals(h.attack * hm * homeEdge, a.defense * am)),
    poisson(s, expectedGoals(a.attack * am, h.defense * hm)),
  ];
}

// ---------- helpers ----------

const club = (s: GameState, id: number) => s.clubs.find((c) => c.id === id)!;
export const currentClubId = (s: GameState) => s.humans[(s.round + s.turn) % s.humans.length];
function log(s: GameState, line: string) {
  s.log.push(line);
  if (s.log.length > 80) s.log.shift();
}

function startSeason(s: GameState) {
  s.round = 0;
  s.turn = 0;
  s.schedule = makeSchedule(s);
  s.cup = [makeCupRound(shuffle(s, s.clubs.map((c) => c.id)))];
  s.phase = 'roll';
  s.die = null;
  s.pending = null;
  s.notice = null;
  s.results = null;
  s.seasonSummary = null;
  log(s, `Kausi ${s.season} alkaa.`);
}

export function createGame(config: GameConfig): GameState {
  const s: GameState = {
    seed: config.seed | 0, nextId: 1, clubs: [], humans: [], season: 1, seasons: config.seasons, round: 0,
    schedule: [], cup: [], phase: 'roll', turn: 0, die: null, pending: null, notice: null, results: null,
    seasonSummary: null, log: [],
  };
  const aiOffsets = [1, 0, 1, 0, -1, 0];
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
  if (c.cash < 0) {
    const interest = Math.ceil(-c.cash * 0.1);
    c.cash -= interest;
    lines.push(`Velasta menee korkoa ${fmt(interest)}.`);
  }
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

function pressEvent(s: GameState, c: Club, lines: string[]) {
  const e = pick(s, PRESS_EVENTS);
  const starters = lineup(c).slots.flatMap((x) => (x.player ? [x.player] : []));
  const target = starters.length ? pick(s, starters) : null;
  const text = e.text.replace('{p}', target?.name ?? 'Pelaaja');
  switch (e.kind) {
    case 'cash':
      c.cash += e.amount;
      lines.push(`${text} ${e.amount > 0 ? 'Saat' : 'Maksat'} ${fmt(Math.abs(e.amount))}.`);
      break;
    case 'skill':
      if (target) target.skill = Math.max(1, Math.min(10, target.skill + e.amount));
      lines.push(text);
      break;
    case 'ban':
      if (target) { target.out = Math.max(target.out, 1); target.outReason = 'ban'; }
      lines.push(text);
      break;
    case 'morale':
      c.morale = e.amount;
      lines.push(text);
      break;
    case 'youth':
      lines.push(text);
      addYouth(s, c, lines);
      break;
  }
}

function roll(s: GameState) {
  const c = club(s, currentClubId(s));
  const die = 1 + randInt(s, 6);
  const lines: string[] = [];
  s.die = die;
  if (c.boardPos + die >= BOARD.length) payday(s, c, lines);
  c.boardPos = (c.boardPos + die) % BOARD.length;
  s.phase = 'manage';

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
      pressEvent(s, c, lines);
      break;
    case 'training':
      s.pending = { kind: 'training' };
      break;
    case 'scout':
      s.pending = { kind: 'scout', options: [0, 1, 2].map(() => newPlayer(s, randomPos(s), 3 + randInt(s, 4))) };
      break;
    case 'auction':
      s.pending = { kind: 'auctionPick', options: [0, 1].map(() => newPlayer(s, randomPos(s), 5 + Math.floor(Math.pow(rand(s), 1.5) * 5))) };
      break;
  }
  s.notice = { square: c.boardPos, lines };
  for (const line of lines) log(s, `${c.name}: ${line}`);
}

function settleAuction(s: GameState) {
  const a = s.pending;
  if (a?.kind !== 'auction') return;
  if (a.active.length === 0) {
    s.notice!.lines.push(`Kukaan ei huutanut. ${a.player.name} jää ilman seuraa.`);
    s.pending = null;
  } else if (a.active.length === 1 && a.leader === a.active[0]) {
    const winner = club(s, a.leader);
    winner.cash -= a.bid;
    winner.squad.push(a.player);
    const line = `${winner.name} voittaa huutokaupan: ${a.player.name} (${POS_NAME[a.player.pos]}, taso ${a.player.skill}) hintaan ${fmt(a.bid)}.`;
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
    [f.hg, f.ag] = playMatch(s, home, away, false);
    home.cash += 15 + 3 * (LEAGUE_SIZE - posOf(home.id)) + 2 * (LEAGUE_SIZE - posOf(away.id));
    log(s, `${home.name} – ${away.name} ${f.hg}–${f.ag}`);
  }
  for (const c of s.clubs) {
    c.morale = 0;
    for (const p of c.squad) {
      if (p.out > 0 && --p.out === 0) delete p.outReason;
    }
  }

  const cupRound = CUP_AFTER.indexOf(s.round);
  if (cupRound >= 0) {
    const ties = s.cup[cupRound];
    for (const t of ties) {
      const a = club(s, t.a);
      const b = club(s, t.b);
      [t.ag, t.bg] = playMatch(s, a, b, true);
      t.pens = t.ag === t.bg;
      t.winner = t.ag > t.bg ? t.a : t.bg > t.ag ? t.b : rand(s) < 0.5 ? t.a : t.b;
      log(s, `Cup, ${CUP_ROUND_NAMES[cupRound].toLowerCase()}: ${a.name} – ${b.name} ${t.ag}–${t.bg}${t.pens ? ` (rp. ${club(s, t.winner).name})` : ''}`);
    }
    if (ties.length > 1) {
      s.cup.push(makeCupRound(ties.map((t) => t.winner!)));
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
  s.results = { round: s.round, cupRound: cupRound >= 0 ? cupRound : null };
  s.phase = 'matchday';
  s.notice = null;
  s.die = null;
}

function endSeason(s: GameState) {
  s.seasonSummary = table(s).map((row, i) => {
    const c = club(s, row.id);
    c.cash += LEAGUE_PRIZE[i];
    c.vp += LEAGUE_VP[i];
    return { id: row.id, pos: i + 1, prize: LEAGUE_PRIZE[i], vp: LEAGUE_VP[i] };
  });
  log(s, `Kausi ${s.season} päättyy. Mestari on ${club(s, s.seasonSummary[0].id).name}.`);
  s.phase = 'seasonEnd';
}

function nextSeason(s: GameState) {
  s.season++;
  for (const c of s.clubs) {
    c.morale = 0;
    for (const p of c.squad) { p.out = 0; delete p.outReason; }
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
      const order = s.humans.map((_, i) => s.humans[(s.humans.indexOf(me.id) + i) % s.humans.length]);
      s.pending = { kind: 'auction', player, minBid: Math.round(playerValue(player.skill) / 10) * 5, bid: 0, leader: null, active: order, idx: 0 };
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
      if (!player || me.cash < playerValue(player.skill) || me.squad.length >= MAX_SQUAD) return state;
      me.cash -= playerValue(player.skill);
      me.squad.push(player);
      const line = `Ostat pelaajan ${player.name} (${POS_NAME[player.pos]}, taso ${player.skill}) hintaan ${fmt(playerValue(player.skill))}.`;
      s.notice!.lines.push(line);
      log(s, `${me.name}: ${line}`);
      s.pending = null;
      return s;
    }

    case 'TRAIN': {
      if (p?.kind !== 'training') return state;
      const player = me.squad.find((x) => x.id === action.playerId);
      if (!player || player.skill >= 10 || me.cash < trainingCost(player)) return state;
      me.cash -= trainingCost(player);
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
      if (!inTurn || p) return state;
      const i = me.squad.findIndex((x) => x.id === action.playerId);
      if (i < 0) return state;
      const [sold] = me.squad.splice(i, 1);
      me.cash += sellPrice(sold);
      log(s, `${me.name} myy pelaajan ${sold.name} hintaan ${fmt(sellPrice(sold))}.`);
      return s;
    }

    case 'END_TURN':
      if (s.phase !== 'manage' || p) return state;
      s.turn++;
      s.die = null;
      s.notice = null;
      if (s.turn >= s.humans.length) playMatchday(s);
      else s.phase = 'roll';
      return s;

    case 'CONTINUE':
      if (s.phase === 'matchday') {
        s.results = null;
        s.round++;
        s.turn = 0;
        if (s.round >= ROUNDS) endSeason(s);
        else s.phase = 'roll';
        return s;
      }
      if (s.phase === 'seasonEnd') {
        if (s.season >= s.seasons) s.phase = 'gameOver';
        else nextSeason(s);
        return s;
      }
      return state;
  }
}
