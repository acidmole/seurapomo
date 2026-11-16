export type Pos = 'MV' | 'PU' | 'KK' | 'HY';
export type FormationId = '4-4-2' | '4-3-3' | '3-5-2' | '5-3-2' | '4-5-1' | '3-4-3';

export const FORMATIONS: Record<FormationId, { PU: number; KK: number; HY: number }> = {
  '4-4-2': { PU: 4, KK: 4, HY: 2 },
  '4-3-3': { PU: 4, KK: 3, HY: 3 },
  '3-5-2': { PU: 3, KK: 5, HY: 2 },
  '5-3-2': { PU: 5, KK: 3, HY: 2 },
  '4-5-1': { PU: 4, KK: 5, HY: 1 },
  '3-4-3': { PU: 3, KK: 4, HY: 3 },
};

export const POS_NAME: Record<Pos, string> = {
  MV: 'maalivahti',
  PU: 'puolustaja',
  KK: 'keskikenttä',
  HY: 'hyökkääjä',
};

export type SquareType =
  | 'start'
  | 'auction'
  | 'scout'
  | 'academy'
  | 'training'
  | 'sponsor'
  | 'press'
  | 'injury'
  | 'tax'
  | 'rest';

export const BOARD: SquareType[] = [
  'start', 'sponsor', 'press', 'scout', 'training', 'auction',
  'injury', 'press', 'academy', 'sponsor', 'auction', 'training',
  'rest', 'scout', 'press', 'auction', 'tax', 'sponsor',
  'academy', 'training', 'press', 'injury', 'scout', 'auction',
];

export const SQUARE_INFO: Record<SquareType, { name: string; icon: string; help: string }> = {
  start: { name: 'Palkkapäivä', icon: '💶', help: 'Maksat palkat aina, kun ohitat tämän ruudun.' },
  auction: { name: 'Huutokauppa', icon: '🔨', help: 'Valitset kahdesta pelaajasta toisen, ja kaikki managerit huutavat hänestä.' },
  scout: { name: 'Kykyjenetsijä', icon: '🔭', help: 'Saat ostaa yhden kolmesta pelaajasta listahintaan.' },
  academy: { name: 'Akatemia', icon: '🌱', help: 'Saat nuoren pelaajan ilmaiseksi.' },
  training: { name: 'Harjoitusleiri', icon: '🏋️', help: 'Voit nostaa yhden pelaajan tasoa maksua vastaan.' },
  sponsor: { name: 'Sponsori', icon: '🤝', help: 'Saat rahaa. Summa kasvaa sarjasijoituksen mukana.' },
  press: { name: 'Lehdistö', icon: '📰', help: 'Sattumanvarainen uutinen, hyvä tai huono.' },
  injury: { name: 'Lääkäri', icon: '🩹', help: 'Yksi avauskokoonpanon pelaaja loukkaantuu.' },
  tax: { name: 'Verottaja', icon: '🧾', help: 'Maksat kymmenen prosenttia kassastasi.' },
  rest: { name: 'Vapaapäivä', icon: '☕', help: 'Mitään ei tapahdu.' },
};

export type PressEvent =
  | { kind: 'cash'; amount: number; text: string }
  | { kind: 'skill'; amount: number; text: string }
  | { kind: 'ban'; text: string }
  | { kind: 'morale'; amount: number; text: string }
  | { kind: 'youth'; text: string };

/** `{p}` is replaced with the affected player's name. */
export const PRESS_EVENTS: PressEvent[] = [
  { kind: 'cash', amount: 30, text: 'Paikallislehti kehuu seuraa, ja fanikaupan myynti kasvaa.' },
  { kind: 'cash', amount: 45, text: 'Uusi paitasponsori allekirjoittaa sopimuksen.' },
  { kind: 'cash', amount: 20, text: 'Kannattajat järjestävät arpajaiset seuran hyväksi.' },
  { kind: 'cash', amount: -25, text: 'Pukuhuoneen putki hajoaa, ja remontti maksaa.' },
  { kind: 'cash', amount: -20, text: 'Liitto sakottaa myöhästyneistä papereista.' },
  { kind: 'cash', amount: -35, text: 'Nurmi on uusittava ennen seuraavaa kotiottelua.' },
  { kind: 'skill', amount: 1, text: '{p} on harjoitellut ylimääräistä koko viikon. Taso nousee.' },
  { kind: 'skill', amount: -1, text: '{p} palaa lomalta huonossa kunnossa. Taso laskee.' },
  { kind: 'ban', text: '{p} arvostelee tuomaria haastattelussa ja saa yhden ottelun pelikiellon.' },
  { kind: 'morale', amount: 1, text: 'Kapteenin puhe sytyttää joukkueen. Seuraavassa ottelussa joukkue pelaa tavallista paremmin.' },
  { kind: 'morale', amount: -1, text: 'Pukukopissa riidellään peliajasta. Seuraavassa ottelussa joukkue pelaa tavallista heikommin.' },
  { kind: 'youth', text: 'Junioripäällikkö tuo harjoituksiin lupaavan nuoren. Hän liittyy joukkueeseen ilmaiseksi.' },
];

export const FIRST_NAMES = [
  'Aleksi', 'Eero', 'Joonas', 'Mikael', 'Onni', 'Väinö', 'Elias', 'Leo', 'Niilo', 'Otto', 'Rasmus', 'Santeri',
  'Tuomas', 'Ville', 'Antti', 'Juho', 'Lauri', 'Matias', 'Oskari', 'Perttu', 'Samu', 'Topi', 'Aaro', 'Kasper',
];

export const LAST_NAMES = [
  'Koskela', 'Lahtinen', 'Mäkelä', 'Niemi', 'Rantala', 'Salonen', 'Heikkilä', 'Karjalainen', 'Laine', 'Manninen',
  'Ojala', 'Peltola', 'Räsänen', 'Saarinen', 'Turunen', 'Vainio', 'Aaltonen', 'Hakala', 'Jokinen', 'Kallio',
  'Lehto', 'Nurmi', 'Pesonen', 'Suominen', 'Tanskanen', 'Uotila', 'Ylönen', 'Harju',
];

export const AI_CLUB_NAMES = [
  'Koskenrannan Pallo',
  'Satamakadun United',
  'Tunturikylän Veikot',
  'FC Kuusimäki',
  'Hiekkaharjun Isku',
  'Majakkasaaren Kiri',
];

export const HUMAN_COLORS = ['#e5484d', '#3e8ef7', '#f5a524', '#30a46c', '#a25ddc', '#12b5b0'];

export const CUP_ROUND_NAMES = ['Puolivälierät', 'Välierät', 'Loppuottelu'];

/** Money is stored in thousands of euros. */
export function fmt(n: number): string {
  return `${(n * 1000).toLocaleString('fi-FI')} €`;
}
