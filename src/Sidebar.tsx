import { useState } from 'react';
import { CUP_ROUND_NAMES, EURO_COMPS, EURO_ROUND_NAMES, FORMATIONS, POS_NAME, fmt, type FormationId, type Pos } from './game/data';
import {
  CUP_AFTER, ROUNDS, currentClubId, gateIncome, lineup, position, sellPrice, table, wages,
  EURO_AFTER, FULL_TIME, MIN_SQUAD, TIRED_AT, actingClubId, entrantName, level, thisWeek, wealth, type Action, type Club, type Entrant, type EuroComp, type Fixture, type GameState, type MatchEvent, type Tie,
} from './game/engine';

type Dispatch = (action: Action) => void;
type Tab = 'squad' | 'table' | 'fixtures' | 'log';

const TABS: [Tab, string][] = [['squad', 'Joukkue'], ['table', 'Sarja'], ['fixtures', 'Ottelut'], ['log', 'Loki']];
const POS_ORDER: Pos[] = ['MV', 'PU', 'KK', 'HY'];

export function ClubName({ game, id }: { game: GameState; id: number }) {
  const c = game.clubs[id];
  return (
    <span className={c.human ? 'club human' : 'club'}>
      {c.human && <span className="dot" style={{ background: c.color }} />}
      {c.name}
    </span>
  );
}

export function Standings({ game }: { game: GameState }) {
  return (
    <table className="table">
      <thead>
        <tr><th>#</th><th className="left">Joukkue</th><th>O</th><th>V</th><th>T</th><th>H</th><th>Maalit</th><th>P</th></tr>
      </thead>
      <tbody>
        {table(game).map((r, i) => (
          <tr key={r.id}>
            <td>{i + 1}</td>
            <td className="left"><ClubName game={game} id={r.id} /></td>
            <td>{r.p}</td><td>{r.w}</td><td>{r.d}</td><td>{r.l}</td>
            <td>{r.gf}–{r.ga}</td>
            <td><strong>{r.pts}</strong></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The side that scored in stoppage time, if any: 0, 1, or both. */
const lateGoals = (events: MatchEvent[] | undefined) => (events ?? []).filter((e) => e.goal && e.minute > FULL_TIME).map((e) => e.side);

/** Goals each side has scored by `minute`, and the chances so far. */
function scoreAt(events: MatchEvent[] | undefined, minute: number) {
  const sofar = (events ?? []).filter((e) => e.minute <= minute);
  const count = (side: 0 | 1, goalsOnly: boolean) => sofar.filter((e) => e.side === side && (e.goal || !goalsOnly)).length;
  return { goals: [count(0, true), count(1, true)], chances: [count(0, false), count(1, false)] };
}

/**
 * A league round. With `minute` set the matches are shown as they stand at that minute, and a manager's match
 * flashes each time a goal goes in.
 */
export function FixtureList({ game, fixtures, minute }: { game: GameState; fixtures: Fixture[]; minute?: number }) {
  return (
    <div className="fixtures">
      {fixtures.map((f, i) => {
        const live = minute !== undefined ? scoreAt(f.events, minute) : null;
        const ours = game.clubs[f.home].human || game.clubs[f.away].human;
        const goals = live ? live.goals[0] + live.goals[1] : 0;
        const chances = live ? live.chances : f.chances;
        return (
          <div key={`${i}:${goals}`} className={live && ours && goals > 0 ? 'fixture goal-flash' : 'fixture'}>
            <span className="right"><ClubName game={game} id={f.home} /></span>
            <span className="score">{live ? `${live.goals[0]}–${live.goals[1]}` : f.hg === null ? '–' : `${f.hg}–${f.ag}`}</span>
            <span><ClubName game={game} id={f.away} /></span>
            {chances && (
              <span className="chances muted small">
                Maalipaikat {chances[0]}–{chances[1]}
                {!live && lateGoals(f.events).map((side, n) => (
                  <strong key={n}> · Lisäajan maali: {game.clubs[side === 0 ? f.home : f.away].name}</strong>
                ))}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EntrantName({ game, entrant }: { game: GameState; entrant: Entrant }) {
  if (entrant.clubId !== null) return <ClubName game={game} id={entrant.clubId} />;
  return (
    <span className="club">
      {entrant.name}
      {entrant.division && <span className="muted small" title={`${entrant.division}. divisioona`}>{entrant.division}. div.</span>}
    </span>
  );
}

const hasLeagueClub = (t: Tie) => t.a.clubId !== null || t.b.clubId !== null;

/** One knockout round. Ties between two clubs from outside the league are left out while any league club is still in. */
export function Ties({ game, ties, minute }: { game: GameState; ties: Tie[]; minute?: number }) {
  const shown = ties.some(hasLeagueClub) ? ties.filter(hasLeagueClub) : ties;
  const human = (e: Entrant) => e.clubId !== null && game.clubs[e.clubId].human;
  return (
    <div className="fixtures">
      {shown.map((t, i) => {
        const live = minute !== undefined ? scoreAt(t.events, minute) : null;
        const goals = live ? live.goals[0] + live.goals[1] : 0;
        return (
          <div key={`${i}:${goals}`} className={live && goals > 0 && (human(t.a) || human(t.b)) ? 'fixture goal-flash' : 'fixture'}>
            <span className={`right ${!live && t.winner === 'a' ? 'winner' : ''}`}><EntrantName game={game} entrant={t.a} /></span>
            <span className="score">{live ? `${live.goals[0]}–${live.goals[1]}` : t.ag === null ? '–' : `${t.ag}–${t.bg}`}</span>
            <span className={!live && t.winner === 'b' ? 'winner' : ''}><EntrantName game={game} entrant={t.b} /></span>
            {!live && t.pens && <span className="chances muted small">Ratkesi rangaistuspotkuilla</span>}
            {!live && lateGoals(t.events).map((side, n) => (
              <span key={n} className="chances muted small"><strong>Lisäajan maali: {entrantName(game, side === 0 ? t.a : t.b)}</strong></span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/** One round of a European cup; skipped once no league club is left in it, except for the final. */
export function EuroTies({ game, comp, round, minute }: { game: GameState; comp: EuroComp; round: number; minute?: number }) {
  const ties = comp.rounds[round];
  if (ties.length > 1 && !ties.some(hasLeagueClub)) return null;
  return (
    <>
      <h3>{EURO_COMPS[comp.tier].name}: {EURO_ROUND_NAMES[round].toLowerCase()}</h3>
      <Ties game={game} ties={ties} minute={minute} />
    </>
  );
}

/** The starting eleven laid out on a small pitch, keeper on the left. */
function MiniPitch({ club }: { club: Club }) {
  const { slots } = lineup(club);
  const rows: [Pos, number][] = [['MV', 8], ['PU', 28], ['KK', 55], ['HY', 80]];
  return (
    <div className="mini-pitch" role="img" aria-label={`Avauskokoonpano muodostelmassa ${club.formation}`}>
      <div className="pitch-line pitch-edge" />
      <div className="pitch-line pitch-halfway" />
      <div className="pitch-line pitch-box pitch-box-left" />
      <div className="pitch-line pitch-box pitch-box-right" />
      {rows.flatMap(([pos, x]) => {
        const line = slots.filter((s) => s.pos === pos);
        return line.map((s, i) => (
          <span
            key={`${pos}${i}`}
            className={`spot ${pos === 'MV' ? 'spot-keeper' : ''} ${!s.player ? 'spot-empty' : s.player.pos !== pos ? 'spot-makeshift' : ''}`}
            style={{ left: `${x}%`, top: `${((i + 1) / (line.length + 1)) * 100}%` }}
            title={s.player ? s.player.name : 'Tyhjä paikka'}
          >
            {s.player ? s.eff : '–'}
          </span>
        ));
      })}
    </div>
  );
}

function Squad({ game, dispatch }: { game: GameState; dispatch: Dispatch }) {
  const currentId = currentClubId(game);
  const actingId = actingClubId(game);
  const [viewId, setViewId] = useState(actingId);
  const club = game.clubs[viewId];
  const canEdit = viewId === currentId && (game.phase === 'roll' || game.phase === 'manage') && !game.pending;
  const canSell = viewId === actingId && (game.phase === 'roll' || game.phase === 'manage');
  const xi = lineup(club);
  const starters = new Map(xi.slots.flatMap((s) => (s.player ? [[s.player.id, s] as const] : [])));
  const week = thisWeek(game);
  const nextHome = week?.kind === 'league' ? game.schedule[week.index].find((f) => f.home === viewId) : undefined;
  const knockout = week?.kind === 'cup' ? game.cup[week.index] : week?.kind === 'euro' ? game.euro.flatMap((c) => c.rounds[week.index]) : [];
  const tie = knockout.find((t) => t.a.clubId === viewId || t.b.clubId === viewId);
  const opponent = tie && entrantName(game, tie.a.clubId === viewId ? tie.b : tie.a);
  const squad = [...club.squad].sort((a, b) => POS_ORDER.indexOf(a.pos) - POS_ORDER.indexOf(b.pos) || b.skill - a.skill);

  return (
    <>
      <div className="sheet-head">
        <h2 className="display">{club.name}</h2>
        <span className="muted">Sarjassa {position(game, viewId)}. · varallisuus {fmt(wealth(club))}</span>
      </div>
      {game.humans.length > 1 && (
        <div className="chips">
          {game.humans.map((id) => (
            <button key={id} className={id === viewId ? 'chip active' : 'chip'} onClick={() => setViewId(id)}>
              <span className="dot" style={{ background: game.clubs[id].color }} />
              {game.clubs[id].name}
            </button>
          ))}
        </div>
      )}

      <div className="stats">
        <div><span className="label">Kassa</span><strong className={club.cash < 0 ? 'neg' : ''}>{fmt(club.cash)}</strong></div>
        <div><span className="label">Palkat</span><strong>{fmt(wages(club))}</strong></div>
        <div><span className="label">Hyökkäys</span><strong>{xi.att}</strong></div>
        <div><span className="label">Keskikenttä</span><strong>{xi.mid}</strong></div>
        <div><span className="label">Puolustus</span><strong>{xi.def + xi.gk}</strong></div>
        <div><span className="label">Sisu</span><strong>{xi.spirit.toLocaleString('fi-FI', { maximumFractionDigits: 1 })}</strong></div>
      </div>

      <label className="formation">
        <span className="label">Muodostelma</span>
        <select
          value={club.formation}
          disabled={!canEdit}
          onChange={(e) => dispatch({ type: 'SET_FORMATION', formation: e.target.value as FormationId })}
        >
          {Object.keys(FORMATIONS).map((f) => <option key={f}>{f}</option>)}
        </select>
        {club.morale !== 0 && <span className="muted small">{club.morale > 0 ? 'Joukkue on hyvässä vireessä' : 'Joukkue on huonossa vireessä'}</span>}
        {club.surge && <span className="pos small">Seuraavassa sarjaottelussa varma maalipaikka lisäajalla</span>}
      </label>

      <p className="small">
        {week?.kind === 'cup' || week?.kind === 'euro' ? (
          opponent
            ? <>Tällä viikolla pelataan {week.kind === 'cup' ? 'cupia' : 'eurocupia'}: vastassa on {opponent}.</>
            : <span className="muted">Tällä viikolla pelataan {week.kind === 'cup' ? 'cupia' : 'eurocupeja'}. Joukkueesi ei ole mukana, joten pelaajat lepäävät.</span>
        ) : nextHome
          ? <>Seuraava ottelu pelataan kotona ({game.clubs[nextHome.away].name}). Lipputuloja kertyy {fmt(gateIncome(position(game, viewId), position(game, nextHome.away)))}.</>
          : <span className="muted">Seuraava ottelu pelataan vieraissa, joten lipputuloja ei kerry.</span>}
      </p>

      <MiniPitch club={club} />

      <div className="table-scroll">
      <table className="table squad">
        <thead>
          <tr>
            <th /><th className="left">Pelaaja</th>
            <th title="Vihreä: vire nostaa taitoa. Punainen: väsymys tai alavire laskee sitä.">Taito</th>
            <th title="Ottelu vie kolme, jokainen sarjakierros palauttaa kolme">Kunto</th>
            <th title="Vaikuttaa tiukoissa paikoissa: vieraissa, altavastaajana ja cupotteluissa">Sisu</th>
            <th className="left">Tila</th><th />
          </tr>
        </thead>
        <tbody>
          {squad.map((p) => {
            const slot = starters.get(p.id);
            return (
              <tr key={p.id} className={slot ? '' : 'bench'}>
                <td><span className={`pos pos-${p.pos}`} title={POS_NAME[p.pos]}>{p.pos}</span></td>
                <td className="left">{p.name}</td>
                <td>
                  <strong
                    className={level(p) < p.skill ? 'neg' : level(p) > p.skill ? 'pos' : ''}
                    title={level(p) === p.skill ? undefined : `Perustaito ${p.skill}`}
                  >
                    {level(p)}{level(p) < p.skill ? ' ▼' : level(p) > p.skill ? ' ▲' : ''}
                  </strong>
                </td>
                <td className={p.fitness <= TIRED_AT ? 'neg' : ''}>{p.fitness}</td>
                <td>{p.spirit}</td>
                <td className="left small">
                  {p.resting
                    ? 'Lepää tämän viikon'
                    : p.out > 0
                    ? <span className="neg">{p.outReason === 'ban' ? 'Pelikielto' : 'Loukkaantunut'}, {p.out} ott.</span>
                    : slot
                      ? slot.pos === p.pos ? 'Avaus' : `Avaus: ${slot.pos}, teho ${slot.eff}`
                      : 'Vaihdossa'}
                  {p.form && (
                    <span className={p.form.amount > 0 ? 'pos' : 'neg'}>
                      {' · '}{p.form.amount > 0 ? 'Vireessä +' : 'Alamaissa −'}{Math.abs(p.form.amount)}
                      {p.form.matches === null ? ', koko kausi' : `, ${p.form.matches} ott.`}
                    </span>
                  )}
                </td>
                <td className="actions">
                  {canEdit && p.out === 0 && (
                    <button
                      className="tiny"
                      aria-pressed={!!p.resting}
                      title="Lepäävä pelaaja jää pois tämän viikon ottelusta ja saa kolme kuntopistettä"
                      onClick={() => dispatch({ type: 'REST', playerId: p.id })}
                    >
                      {p.resting ? 'Peru lepo' : 'Lepuuta'}
                    </button>
                  )}
                  {canSell && club.squad.length > MIN_SQUAD && (
                    <button className="tiny" title="Myy pelaaja pankille" onClick={() => dispatch({ type: 'SELL', playerId: p.id })}>
                      Myy {fmt(sellPrice(p))}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
      <p className="muted small">
        Avauskokoonpano valitaan automaattisesti taidon mukaan; omalla vuorollasi voit lepuuttaa pelaajan tämän viikon ottelusta. Väärällä paikalla pelaava pelaa puolella teholla.
        Ottelu vie avaajalta kolme kuntopistettä, ja jokainen sarjakierros palauttaa kaikille kolme. Cup- ja
        eurocupviikot siis kuluttavat: pelaaja palautuu vasta, kun hän lepää yhden ottelun. Kun
        kunto on enintään {TIRED_AT}, taito laskee yhdellä. Kortit voivat nostaa tai laskea taitoa muutaman ottelun ajaksi: vihreä taito on koholla, punainen alentunut. Sisu ratkaisee tiukoissa paikoissa: vieraissa,
        altavastaajana, cupotteluissa ja rangaistuspotkukilpailuissa. Sisukas joukkue saa myös useammin vielä yhden
        maalipaikan lisäajalla.
      </p>
    </>
  );
}

export default function Sidebar({ game, dispatch }: { game: GameState; dispatch: Dispatch }) {
  const [tab, setTab] = useState<Tab>('squad');
  const round = Math.min(game.round, ROUNDS - 1);
  const nextCup = game.cup[game.cup.length - 1];
  const cupPlayed = nextCup.every((t) => t.winner !== null);

  return (
    <aside className="sidebar paper" aria-label="Joukkue">
      <nav className="tabs">
        {TABS.map(([id, label]) => (
          <button key={id} className={id === tab ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>
      <div className="tab-body">
        {tab === 'squad' && <Squad game={game} dispatch={dispatch} />}
        {tab === 'table' && <Standings game={game} />}
        {tab === 'fixtures' && (
          <>
            <h3>Kierros {round + 1}</h3>
            <FixtureList game={game} fixtures={game.schedule[round]} />
            {round + 1 < ROUNDS && (
              <>
                <h3>Kierros {round + 2}</h3>
                <FixtureList game={game} fixtures={game.schedule[round + 1]} />
              </>
            )}
            <h3>Cup: {CUP_ROUND_NAMES[game.cup.length - 1].toLowerCase()}</h3>
            {!cupPlayed && <p className="muted small">Pelataan kierroksen {CUP_AFTER[game.cup.length - 1] + 1} jälkeen.</p>}
            <Ties game={game} ties={nextCup} />
            {game.euro.length === 0 ? (
              <p className="muted small">
                Eurocupit alkavat toisella kaudella. Mestari pääsee kilpailuun {EURO_COMPS[0].name}, kakkonen
                kilpailuun {EURO_COMPS[1].name} sekä kolmas ja neljäs kilpailuun {EURO_COMPS[2].name}.
              </p>
            ) : (
              <>
                {game.euro[0].rounds[game.euro[0].rounds.length - 1][0].winner === null && (
                  <p className="muted small">Seuraava eurokierros pelataan kierroksen {EURO_AFTER[game.euro[0].rounds.length - 1] + 1} jälkeen.</p>
                )}
                {game.euro.map((comp) => <EuroTies key={comp.tier} game={game} comp={comp} round={comp.rounds.length - 1} />)}
              </>
            )}
          </>
        )}
        {tab === 'log' && (
          <ul className="log">
            {[...game.log].reverse().map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        )}
      </div>
    </aside>
  );
}
