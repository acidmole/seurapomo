import { useState } from 'react';
import { CUP_ROUND_NAMES, EURO_COMPS, EURO_ROUND_NAMES, FORMATIONS, POS_NAME, fmt, type FormationId, type Pos } from './game/data';
import {
  CUP_AFTER, ROUNDS, currentClubId, finalScore, gateIncome, lineup, position, sellPrice, table, wages,
  EURO_AFTER, MIN_SQUAD, TIRED_AT, level, type Action, type CupTie, type EuroComp, type EuroEntrant, type Fixture, type GameState,
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

export function FixtureList({ game, fixtures }: { game: GameState; fixtures: Fixture[] }) {
  return (
    <div className="fixtures">
      {fixtures.map((f, i) => (
        <div key={i} className="fixture">
          <span className="right"><ClubName game={game} id={f.home} /></span>
          <span className="score">{f.hg === null ? '–' : `${f.hg}–${f.ag}`}</span>
          <span><ClubName game={game} id={f.away} /></span>
          {f.chances && <span className="chances muted small">Maalipaikat {f.chances[0]}–{f.chances[1]}</span>}
        </div>
      ))}
    </div>
  );
}

export function CupTies({ game, ties }: { game: GameState; ties: CupTie[] }) {
  return (
    <div className="fixtures">
      {ties.map((t, i) => (
        <div key={i} className="fixture">
          <span className={`right ${t.winner === t.a ? 'winner' : ''}`}><ClubName game={game} id={t.a} /></span>
          <span className="score">{t.ag === null ? '–' : `${t.ag}–${t.bg}${t.pens ? ' rp.' : ''}`}</span>
          <span className={t.winner === t.b ? 'winner' : ''}><ClubName game={game} id={t.b} /></span>
        </div>
      ))}
    </div>
  );
}

function Entrant({ game, entrant }: { game: GameState; entrant: EuroEntrant }) {
  return entrant.clubId === null ? <span className="club">{entrant.name}</span> : <ClubName game={game} id={entrant.clubId} />;
}

/** One round of a European cup. Ties between two foreign clubs are left out before the final. */
export function EuroTies({ game, comp, round }: { game: GameState; comp: EuroComp; round: number }) {
  const all = comp.rounds[round];
  const ties = all.length === 1 ? all : all.filter((t) => t.a.clubId !== null || t.b.clubId !== null);
  if (ties.length === 0) return null;
  return (
    <>
      <h3>{EURO_COMPS[comp.tier].name}: {EURO_ROUND_NAMES[round].toLowerCase()}</h3>
      <div className="fixtures">
        {ties.map((t, i) => (
          <div key={i} className="fixture">
            <span className={`right ${t.winner === 'a' ? 'winner' : ''}`}><Entrant game={game} entrant={t.a} /></span>
            <span className="score">{t.ag === null ? '–' : `${t.ag}–${t.bg}${t.pens ? ' rp.' : ''}`}</span>
            <span className={t.winner === 'b' ? 'winner' : ''}><Entrant game={game} entrant={t.b} /></span>
          </div>
        ))}
      </div>
    </>
  );
}

function Squad({ game, dispatch }: { game: GameState; dispatch: Dispatch }) {
  const currentId = currentClubId(game);
  const [viewId, setViewId] = useState(currentId);
  const club = game.clubs[viewId];
  const canEdit = viewId === currentId && (game.phase === 'roll' || game.phase === 'manage') && !game.pending;
  const xi = lineup(club);
  const starters = new Map(xi.slots.flatMap((s) => (s.player ? [[s.player.id, s] as const] : [])));
  const nextHome = game.round < ROUNDS ? game.schedule[game.round].find((f) => f.home === viewId) : undefined;
  const squad = [...club.squad].sort((a, b) => POS_ORDER.indexOf(a.pos) - POS_ORDER.indexOf(b.pos) || b.skill - a.skill);

  return (
    <>
      <div className="chips">
        {game.humans.map((id) => (
          <button key={id} className={id === viewId ? 'chip active' : 'chip'} onClick={() => setViewId(id)}>
            <span className="dot" style={{ background: game.clubs[id].color }} />
            {game.clubs[id].name}
          </button>
        ))}
      </div>

      <div className="stats">
        <div><span className="muted small">Kassa</span><strong className={club.cash < 0 ? 'neg' : ''}>{fmt(club.cash)}</strong></div>
        <div><span className="muted small">Palkat</span><strong>{fmt(wages(club))}</strong></div>
        <div><span className="muted small">Hyökkäys</span><strong>{xi.att}</strong></div>
        <div><span className="muted small">Keskikenttä</span><strong>{xi.mid}</strong></div>
        <div><span className="muted small">Puolustus</span><strong>{xi.def + xi.gk}</strong></div>
        <div><span className="muted small">Sisu</span><strong>{xi.spirit.toLocaleString('fi-FI', { maximumFractionDigits: 1 })}</strong></div>
        <div><span className="muted small">Pisteet</span><strong>{finalScore(club)}</strong></div>
      </div>

      <label className="formation">
        Muodostelma
        <select
          value={club.formation}
          disabled={!canEdit}
          onChange={(e) => dispatch({ type: 'SET_FORMATION', formation: e.target.value as FormationId })}
        >
          {Object.keys(FORMATIONS).map((f) => <option key={f}>{f}</option>)}
        </select>
        {club.morale !== 0 && <span className="muted small">{club.morale > 0 ? '🔥 Joukkue on hyvässä vireessä' : '🌧️ Joukkue on huonossa vireessä'}</span>}
      </label>

      <p className="small">
        {nextHome
          ? <>🏟️ Seuraava ottelu pelataan kotona ({game.clubs[nextHome.away].name}). Lipputuloja kertyy {fmt(gateIncome(position(game, viewId), position(game, nextHome.away)))}.</>
          : <span className="muted">🚌 Seuraava ottelu pelataan vieraissa, joten lipputuloja ei kerry.</span>}
      </p>

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
                  {p.out > 0
                    ? `${p.outReason === 'ban' ? '🟥 Pelikielto' : '🩹 Loukkaantunut'} (${p.out})`
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
                <td>
                  {canEdit && club.squad.length > MIN_SQUAD && (
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
      <p className="muted small">
        Avauskokoonpano valitaan automaattisesti taidon mukaan. Väärällä paikalla pelaava pelaa puolella teholla.
        Ottelu vie avaajalta kolme kuntopistettä, ja jokainen sarjakierros palauttaa kaikille kolme. Viikko, jolla
        pelataan myös cupia tai eurocupia, siis kuluttaa: pelaaja palautuu vasta, kun hän lepää yhden kierroksen. Kun
        kunto on enintään {TIRED_AT}, taito laskee yhdellä. Kortit voivat nostaa tai laskea taitoa muutaman ottelun ajaksi: vihreä taito on koholla, punainen alentunut. Sisu ratkaisee tiukoissa paikoissa: vieraissa,
        altavastaajana, cupotteluissa ja rangaistuspotkukilpailuissa.
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
    <aside className="sidebar card">
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
            <CupTies game={game} ties={nextCup} />
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
