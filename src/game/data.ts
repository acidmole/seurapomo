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
  'injury', 'press', 'academy', 'sponsor', 'press', 'training',
  'rest', 'scout', 'press', 'auction', 'tax', 'sponsor',
  'academy', 'training', 'press', 'injury', 'scout', 'press',
];

export const SQUARE_INFO: Record<SquareType, { name: string; icon: string; help: string }> = {
  start: { name: 'Palkkapäivä', icon: '💶', help: 'Maksat palkat aina, kun ohitat tämän ruudun.' },
  auction: { name: 'Huutokauppa', icon: '🔨', help: 'Valitset kahdesta pelaajasta toisen, ja kaikki managerit huutavat hänestä.' },
  scout: { name: 'Kykyjenetsijä', icon: '🔭', help: 'Saat ostaa yhden kolmesta pelaajasta listahintaan.' },
  academy: { name: 'Akatemia', icon: '🌱', help: 'Saat nuoren pelaajan ilmaiseksi.' },
  training: { name: 'Harjoitusleiri', icon: '🏋️', help: 'Voit nostaa yhden pelaajan tasoa maksua vastaan.' },
  sponsor: { name: 'Sponsori', icon: '🤝', help: 'Saat rahaa. Summa kasvaa sarjasijoituksen mukana.' },
  press: { name: 'Lehdistö', icon: '📰', help: 'Nostat kortin. Se voi tuoda tai viedä rahaa, muuttaa pelaajan tasoa, käynnistää huutokaupan tai siirtää sinut toiseen ruutuun.' },
  injury: { name: 'Lääkäri', icon: '🩹', help: 'Yksi avauskokoonpanon pelaaja loukkaantuu.' },
  tax: { name: 'Verottaja', icon: '🧾', help: 'Maksat kymmenen prosenttia kassastasi.' },
  rest: { name: 'Vapaapäivä', icon: '☕', help: 'Mitään ei tapahdu.' },
};

export type Card =
  | { kind: 'cash'; amount: number; text: string }
  /** Temporary form: `amount` on the player's skill for `matches` league rounds, or to the end of the season when null. */
  | { kind: 'form'; amount: number; matches: number | null; text: string }
  | { kind: 'ban'; text: string }
  /** A starter walks out; the club is paid his full value. */
  | { kind: 'leave'; text: string }
  | { kind: 'heal'; text: string }
  | { kind: 'morale'; amount: number; text: string }
  | { kind: 'spirit'; amount: number; text: string }
  /** The whole squad back to full fitness. */
  | { kind: 'fitness'; text: string }
  | { kind: 'youth'; text: string }
  /** Every other manager pays `amount` to the one who drew the card. */
  | { kind: 'collect'; amount: number; text: string }
  /** A player of level `min`–`max` goes under the hammer. `subsidy` is paid towards the price if the drawer wins. */
  | { kind: 'auction'; min: number; max: number; subsidy: number; text: string }
  /** Move forward to the nearest square of this type and resolve it. */
  | { kind: 'goto'; square: 'training' | 'scout'; text: string }
  | { kind: 'freeTraining'; text: string };

/** The deck drawn from on a press square. `{p}` is replaced with the affected player's name. */
export const CARDS: Card[] = [
  { kind: 'cash', amount: 30, text: 'Paikallislehti kehuu seuraa, ja fanikaupan myynti kasvaa.' },
  { kind: 'cash', amount: 45, text: 'Uusi paitasponsori allekirjoittaa sopimuksen.' },
  { kind: 'cash', amount: 20, text: 'Kannattajat järjestävät arpajaiset seuran hyväksi.' },
  { kind: 'cash', amount: 60, text: 'Televisio näyttää seuraavan kotiottelunne suorana.' },
  { kind: 'cash', amount: -25, text: 'Pukuhuoneen putki hajoaa, ja remontti maksaa.' },
  { kind: 'cash', amount: -20, text: 'Liitto sakottaa myöhästyneistä papereista.' },
  { kind: 'cash', amount: -35, text: 'Nurmi on uusittava ennen seuraavaa kotiottelua.' },
  { kind: 'cash', amount: -40, text: 'Joukkueen bussi hajoaa kesken vierasmatkan.' },
  { kind: 'form', amount: 2, matches: 5, text: '{p} on täynnä itseluottamusta, ja kaikki onnistuu. Taito +2 viiden ottelun ajan.' },
  { kind: 'form', amount: 3, matches: 2, text: '{p} on elämänsä vireessä. Taito +3 kahden ottelun ajan.' },
  { kind: 'form', amount: 1, matches: null, text: '{p} on harjoitellut ylimääräistä koko viikon. Taito +1 kauden loppuun asti.' },
  { kind: 'form', amount: -2, matches: 5, text: '{p} on alamaissa eikä saa pelistä otetta. Taito −2 viiden ottelun ajan.' },
  { kind: 'form', amount: -3, matches: 2, text: '{p} valvoo yöt vastasyntyneen kanssa ja nukkuu harjoituksissa. Taito −3 kahden ottelun ajan.' },
  { kind: 'form', amount: -1, matches: null, text: '{p} palaa lomalta huonossa kunnossa eikä saa sitä kiinni. Taito −1 kauden loppuun asti.' },
  { kind: 'ban', text: '{p} arvostelee tuomaria haastattelussa ja saa yhden ottelun pelikiellon.' },
  { kind: 'heal', text: 'Seuran lääkäri tekee ihmeitä. Kaikki loukkaantuneet pelaajasi palaavat pelikuntoon.' },
  { kind: 'morale', amount: 1, text: 'Kapteenin puhe sytyttää joukkueen. Seuraavassa ottelussa saatte tavallista enemmän maalipaikkoja.' },
  { kind: 'morale', amount: -1, text: 'Pukukopissa riidellään peliajasta. Seuraavassa ottelussa saatte tavallista vähemmän maalipaikkoja.' },
  { kind: 'spirit', amount: 2, text: '{p} pelaa koko ottelun murtuneella varpaalla eikä valita. Sisu nousee kahdella.' },
  { kind: 'spirit', amount: -1, text: '{p} riitelee valmentajan kanssa ja murjottaa. Sisu laskee.' },
  { kind: 'fitness', text: 'Seura palkkaa kuntovalmentajan viikoksi. Koko joukkueen kunto palautuu täyteen.' },
  { kind: 'leave', text: '{p} on saanut tarpeekseen valmentajasta ja lähtee seurasta.' },
  { kind: 'leave', text: '{p} saa ulkomailta tarjouksen, josta ei voi kieltäytyä, ja lähtee.' },
  { kind: 'youth', text: 'Junioripäällikkö tuo harjoituksiin lupaavan nuoren. Hän liittyy joukkueeseen ilmaiseksi.' },
  { kind: 'collect', amount: 10, text: 'Seurasi täyttää pyöreitä vuosia, ja jokainen muu manageri tuo lahjan.' },
  { kind: 'auction', min: 5, max: 8, subsidy: 0, text: 'Pelaaja-agentti soittaa: vapaa pelaaja etsii seuraa. Hänestä järjestetään huutokauppa.' },
  { kind: 'auction', min: 5, max: 8, subsidy: 30, text: 'Sponsori haluaa seuraan uuden kasvon. Pelaajasta järjestetään huutokauppa, ja sponsori maksaa osan hinnasta, jos sinä voitat.' },
  { kind: 'auction', min: 8, max: 9, subsidy: 0, text: 'Ulkomainen tähtipelaaja haluaa muuttaa Suomeen. Hänestä järjestetään huutokauppa.' },
  { kind: 'goto', square: 'training', text: 'Valmentaja vaatii leiriä. Siirryt lähimmälle harjoitusleirille.' },
  { kind: 'goto', square: 'scout', text: 'Kykyjenetsijällä on kiireellistä asiaa. Siirryt hänen luokseen.' },
  { kind: 'freeTraining', text: 'Kunta antaa harjoituskeskuksensa käyttöönne. Saat yhden harjoitusleirin ilmaiseksi.' },
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
  'Myllypuron Toverit',
  'Lokkiluodon Pallo',
];

/** Invented opponents for the European cups. */
export const FOREIGN_CLUBS = [
  'Atlético Marisol', 'SC Nordhaven', 'Real Montaverde', 'FK Dunavgrad', 'AS Portovento', 'Olympique Clairmont',
  'Sporting Ribeira', 'Ashby Rovers', 'BK Fjordvik', 'Dynamo Zelengrad', 'AC Castelrosso', 'FC Rheinbrück',
  'Racing Valdoro', 'IF Stenholm', 'Union Sankt Veit', 'Slavia Kamenec', 'PAE Thalassa', 'CS Brumaire',
  'Wexley Town', 'Lokomotiv Sredna', 'KV Zeedijk', 'Deportivo Altamar', 'US Montefiore', 'Vikingur Hafnarvik',
];

export interface EuroCompInfo {
  name: string;
  /** Paid to every league club that qualifies. */
  entry: number;
  /** Paid for each tie won. */
  win: number;
  vp: { winner: number; finalist: number };
  /** Average player level of the foreign clubs: [min, max]. */
  level: [number, number];
}

/** Index 0 is for the league champion, 1 for the runner-up, 2 for the third and fourth. */
export const EURO_COMPS: EuroCompInfo[] = [
  { name: 'Mestarien cup', entry: 60, win: 50, vp: { winner: 8, finalist: 4 }, level: [6, 7.5] },
  { name: 'Eurooppa-cup', entry: 40, win: 35, vp: { winner: 6, finalist: 3 }, level: [5.5, 6.5] },
  { name: 'Haastajacup', entry: 25, win: 25, vp: { winner: 4, finalist: 2 }, level: [5, 6] },
];
export const EURO_ROUND_NAMES = ['Puolivälierät', 'Välierät', 'Loppuottelu'];

export const HUMAN_COLORS = ['#e5484d', '#3e8ef7', '#f5a524', '#30a46c', '#a25ddc', '#12b5b0'];

export const CUP_ROUND_NAMES = ['Alkukierros', 'Puolivälierät', 'Välierät', 'Loppuottelu'];

/** Money is stored in thousands of euros. */
export function fmt(n: number): string {
  return `${(n * 1000).toLocaleString('fi-FI')} €`;
}
