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

const STRIPES = 'repeating-linear-gradient(90deg, #35c9dc 0 12px, #1d3f72 12px 24px)';
const HOOPS = 'repeating-linear-gradient(0deg, #8be04e 0 10px, #1f7a3a 10px 20px)';
const SASH = 'repeating-linear-gradient(135deg, #ff5a4d 0 12px, #8f1d16 12px 24px)';
const QUARTERS = 'conic-gradient(#ff8fc7 0 25%, #ffffff 0 50%, #ff8fc7 0 75%, #ffffff 0)';
const HALVES = 'linear-gradient(90deg, #ffd23f 0 50%, #f08c00 50% 100%)';
const PINSTRIPES = 'repeating-linear-gradient(90deg, #0b1a12 0 10px, #ffd23f 10px 13px)';

/** `icon` is an SVG path on a 24 × 24 grid; `pattern` is the shirt pattern behind it, one per group of squares. */
export const SQUARE_INFO: Record<SquareType, { name: string; icon: string; pattern: string; help: string }> = {
  start: { name: 'Palkkapäivä', pattern: PINSTRIPES, icon: 'M21 12a9 9 0 1 1-18 0a9 9 0 0 1 18 0M15 8.5a4.5 4.5 0 1 0 0 7M7 11h6M7 13.5h5', help: 'Maksat palkat aina, kun ohitat tämän ruudun.' },
  auction: { name: 'Huuto\u00adkauppa', pattern: STRIPES, icon: 'm14 4 6 6M11 7l6 6M12.5 5.5l-5 5 3 3 5-5M9 13l-6 6M13 21h8', help: 'Valitset kahdesta pelaajasta toisen, ja kaikki managerit huutavat hänestä.' },
  scout: { name: 'Kykyjen\u00adetsijä', pattern: STRIPES, icon: 'M17 11a6 6 0 1 1-12 0a6 6 0 0 1 12 0M20 20l-4.5-4.5', help: 'Saat ostaa yhden kolmesta pelaajasta listahintaan.' },
  academy: { name: 'Akatemia', pattern: HOOPS, icon: 'm12 3 2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8z', help: 'Saat nuoren pelaajan ilmaiseksi.' },
  training: { name: 'Harjoitus\u00adleiri', pattern: HOOPS, icon: 'M12 3 5 20h14zM8.5 12h7M4 20h16', help: 'Voit nostaa yhden pelaajan taitoa maksua vastaan.' },
  sponsor: { name: 'Sponsori', pattern: HALVES, icon: 'M8 3 3 6l2 4 2-1v11h10V9l2 1 2-4-5-3a4 4 0 0 1-8 0z', help: 'Saat rahaa. Summa kasvaa sarjasijoituksen mukana.' },
  press: { name: 'Lehdistö', pattern: QUARTERS, icon: 'M3 5h18v14H3zM7 9h5v4H7zM15 9h2M15 13h2M7 16h10', help: 'Nostat kortin. Se voi tuoda tai viedä rahaa, muuttaa pelaajan virettä, käynnistää huutokaupan tai siirtää sinut toiseen ruutuun.' },
  injury: { name: 'Lääkäri', pattern: SASH, icon: 'M4 4h16v16H4zM12 8v8M8 12h8', help: 'Yksi avauskokoonpanon pelaaja loukkaantuu.' },
  tax: { name: 'Verottaja', pattern: SASH, icon: 'M10 7.5a2.5 2.5 0 1 1-5 0a2.5 2.5 0 0 1 5 0M19 16.5a2.5 2.5 0 1 1-5 0a2.5 2.5 0 0 1 5 0M19 5 5 19', help: 'Maksat kymmenen prosenttia kassastasi.' },
  rest: { name: 'Vapaa\u00adpäivä', pattern: QUARTERS, icon: 'M5 9h11v5a5 5 0 0 1-10 0zM16 10h2a2 2 0 0 1 0 4h-2M5 20h12', help: 'Mitään ei tapahdu.' },
};

/** Shirt pattern shown behind a player of each position. */
export const POS_PATTERN: Record<Pos, string> = { MV: HALVES, PU: STRIPES, KK: HOOPS, HY: SASH };

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
  'Aapo', 'Akseli', 'Aleksi', 'Anssi', 'Antero', 'Arttu', 'Benjamin', 'Eemeli', 'Eero', 'Eetu', 'Elias', 'Erkki',
  'Hannes', 'Heikki', 'Henri', 'Iiro', 'Ilmari', 'Jaakko', 'Jalmari', 'Jere', 'Joonas', 'Juho', 'Kaapo', 'Kalle',
  'Kasper', 'Konsta', 'Lauri', 'Leevi', 'Luukas', 'Markus', 'Matias', 'Miro', 'Niilo', 'Niklas', 'Oiva', 'Olli',
  'Onni', 'Oskari', 'Otto', 'Paavo', 'Pekka', 'Perttu', 'Petteri', 'Rasmus', 'Reino', 'Riku', 'Roope', 'Saku',
  'Santeri', 'Sakari', 'Teemu', 'Timo', 'Toivo', 'Topias', 'Tuomas', 'Urho', 'Valtteri', 'Veeti', 'Ville', 'Väinö',
];

export const LAST_NAMES = [
  'Aaltonen', 'Ahonen', 'Alanko', 'Backman', 'Eskola', 'Forsman', 'Haapala', 'Hakala', 'Halme', 'Harju',
  'Heikkilä', 'Hietala', 'Hiltunen', 'Honkanen', 'Huttunen', 'Hällström', 'Ikonen', 'Jokela', 'Kallio', 'Kangas',
  'Karjalainen', 'Kettunen', 'Kivelä', 'Koivisto', 'Kokkonen', 'Korpela', 'Koskela', 'Kuoppala', 'Kuusela',
  'Kärkkäinen', 'Laaksonen', 'Lahtinen', 'Laine', 'Lampinen', 'Lehto', 'Leinonen', 'Lindroos', 'Luoma',
  'Manninen', 'Mattila', 'Mustonen', 'Myllymäki', 'Mäkelä', 'Määttä', 'Niemi', 'Nurmi', 'Nyberg', 'Ojala',
  'Ollila', 'Paananen', 'Pakarinen', 'Palo', 'Peltola', 'Pesonen', 'Pitkänen', 'Pulkkinen', 'Rantala',
  'Rautakorpi', 'Rautio', 'Räsänen', 'Saarinen', 'Salminen', 'Salo', 'Savolainen', 'Seppälä', 'Sillanpää',
  'Sirola', 'Soini', 'Sundqvist', 'Suominen', 'Tanskanen', 'Tervo', 'Tiihonen', 'Toivonen', 'Tuominen',
  'Turunen', 'Uotila', 'Vainio', 'Valkama', 'Vesala', 'Viitala', 'Virtanen', 'Vuorinen', 'Väisänen',
  'Wikström', 'Ylönen', 'Åkerlund', 'Öhman',
];

/** Invented players from abroad; roughly one signing in seven is one of these. */
export const FOREIGN_NAMES = [
  'Mateo Ferrández', 'Lars Øverby', 'Kwame Asante', 'Dragan Petrović', 'Hugo Lindqvist', 'Tiago Nogueira',
  'Emeka Okafor', 'Kenji Morita', 'Luca Benedetti', 'Jonas Hoffmann', 'Ibrahim Diallo', 'Andrei Popescu',
  'Sven Halvorsen', 'Rafael Quintero', 'Mikkel Dahl', 'Olivier Marchand', 'Piotr Zielonka', 'Babajide Adeyemi',
  'Carlos Mendieta', 'Erik Sandström', 'Nikola Vuković', 'Jamal Whitfield', 'Sergei Antonov', 'Tomás Herrero',
  'Declan Byrne', 'Abdi Warsame', 'Goran Ilić', 'Kwabena Ofori', 'Henrik Aaberg', 'Marco Bellini', 'Samir Haddad',
  'Viktor Lindahl', 'Arjen Dekker', 'Florian Krause', 'Oleksandr Bondar', 'Ricardo Faria', 'Callum Reid',
  'Mamadou Sissoko', 'Javier Olmedo', 'Tarik Begović',
];
export const FOREIGN_SHARE = 0.15;

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
  /** Prize money for the winner and the losing finalist. */
  title: { winner: number; finalist: number };
  /** Average player level of the foreign clubs: [min, max]. */
  level: [number, number];
}

/** Index 0 is for the league champion, 1 for the runner-up, 2 for the third and fourth. */
export const EURO_COMPS: EuroCompInfo[] = [
  { name: 'Mestarien cup', entry: 60, win: 50, title: { winner: 150, finalist: 50 }, level: [6, 7.5] },
  { name: 'Eurooppa-cup', entry: 40, win: 35, title: { winner: 100, finalist: 35 }, level: [5.5, 6.5] },
  { name: 'Haastajacup', entry: 25, win: 25, title: { winner: 70, finalist: 25 }, level: [5, 6] },
];
export const EURO_ROUND_NAMES = ['Puolivälierät', 'Välierät', 'Loppuottelu'];

export const HUMAN_COLORS = ['#e5484d', '#3e8ef7', '#f5a524', '#30a46c', '#a25ddc', '#12b5b0'];

export const CUP_ROUND_NAMES = ['1. kierros', 'Neljännesvälierät', 'Puolivälierät', 'Välierät', 'Loppuottelu'];

/** Invented lower-division clubs. They only appear in the cup, and are weaker than the league clubs. */
export const LOWER_CLUBS = [
  'Kaislarannan Kisa', 'Pihlajamäen Pyry', 'Suokylän Sisu', 'FC Kivikko', 'Ahvenlahden Vesa', 'Hirvikorven Tarmo',
  'Käpylammen Ponsi', 'Mustikkamäen Into', 'Rantakylän Riento', 'Lumikorven Jyry', 'Tervasaaren Teräs',
  'Niittylän Nasta', 'Louhikon Lukko', 'Tammiston Tuisku', 'Vaahterapuron Veto', 'Kuusiston Kunto',
  'Hietaniemen Haka', 'Sorsalammen Sirkat', 'Kalliokylän Karhut', 'Peltosaaren Pallo', 'Ruosteojan Rauta',
  'Honkarannan Henki', 'Ukkosvuoren Ukot', 'Lokkikallion Leisku',
];
export const CUP_SIZE = 32;
/**
 * Average player level of the clubs below the league, [min, max], by division: half of them play in the
 * second division and half in the third. League starters average about 5.
 */
export const LOWER_LEVELS: Record<2 | 3, [number, number]> = { 2: [2.5, 4.5], 3: [1.5, 3.5] };

/** Money is stored in thousands of euros. */
export function fmt(n: number): string {
  return `${(n * 1000).toLocaleString('fi-FI')} €`;
}
