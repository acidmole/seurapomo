import { useEffect, useState, type ReactNode } from 'react';
import { ClubName, EuroTies, FixtureList, Standings, Ties } from './Sidebar';
import { CUP_ROUND_NAMES, EURO_COMPS, EURO_ROUND_NAMES, fmt } from './game/data';
import { FULL_TIME, GOLDEN_BOOT_PRIZE, STOPPAGE, squadValue, wealth, type GameState } from './game/engine';

function Overlay({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overlay">
      <div className="paper modal">
        <h2 className="display">{title}</h2>
        {children}
      </div>
    </div>
  );
}

const LAST_MINUTE = FULL_TIME + STOPPAGE;
/** Milliseconds per match minute while the week is shown live: ninety minutes take about fifteen seconds. */
const MINUTE_MS = 165;

export function MatchdayResults({ game, onContinue }: { game: GameState; onContinue: () => void }) {
  const r = game.results!;
  const last = game.week === game.calendar.length - 1;
  const fixtures = r.kind === 'league' ? game.schedule[r.index] : [];
  const ties = r.kind === 'cup' ? game.cup[r.index] : r.kind === 'euro' ? game.euro.flatMap((comp) => comp.rounds[r.index]) : [];
  const gates = [
    ...fixtures.filter((f) => game.clubs[f.home].human && f.gate != null).map((f) => ({ id: f.home, amount: f.gate! })),
    ...ties.flatMap((t) => [t.a.clubId, t.b.clubId].flatMap((id) => (id !== null && game.clubs[id].human && t.gate ? [{ id, amount: t.gate }] : []))),
  ];

  // The week is played out live only when a manager has a match in it, and not for people who ask for less motion.
  const human = (id: number | null) => id !== null && game.clubs[id].human;
  const involved = fixtures.some((f) => human(f.home) || human(f.away)) || ties.some((t) => human(t.a.clubId) || human(t.b.clubId));
  const [minute, setMinute] = useState(() =>
    involved && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : LAST_MINUTE + 1,
  );
  const live = minute <= LAST_MINUTE;
  const stoppage = minute > FULL_TIME;
  useEffect(() => {
    if (!live) return;
    const timer = setTimeout(() => setMinute((m) => m + 1), stoppage ? MINUTE_MS * 3 : MINUTE_MS);
    return () => clearTimeout(timer);
  }, [minute, live, stoppage]);
  const shown = live ? minute : undefined;

  const title =
    r.kind === 'league' ? `Kierros ${r.index + 1}`
    : r.kind === 'cup' ? `Cup: ${CUP_ROUND_NAMES[r.index].toLowerCase()}`
    : `Eurocupit: ${EURO_ROUND_NAMES[r.index].toLowerCase()}`;
  return (
    <Overlay title={live ? title : r.kind === 'league' ? `Kierroksen ${r.index + 1} tulokset` : title}>
      {live && (
        <div className="clock" role="timer" aria-label={`Ottelut käynnissä, ${minute}. minuutti`}>
          <span className="clock-minute">{stoppage ? `90+${minute - FULL_TIME}'` : `${minute}'`}</span>
          <span className="clock-bar"><span style={{ width: `${Math.min(1, minute / FULL_TIME) * 100}%` }} /></span>
          {stoppage && <strong className="clock-stoppage">Lisäaika</strong>}
        </div>
      )}
      {r.kind === 'league' && <FixtureList game={game} fixtures={fixtures} minute={shown} />}
      {r.kind === 'cup' && <Ties game={game} ties={game.cup[r.index]} minute={shown} />}
      {r.kind === 'euro' && game.euro.map((comp) => <EuroTies key={comp.tier} game={game} comp={comp} round={r.index} minute={shown} />)}
      {live ? (
        <button className="big" onClick={() => setMinute(LAST_MINUTE + 1)}>Näytä lopputulokset</button>
      ) : (
        <>
          {gates.length > 0 && (
            <>
              <h3>{r.kind === 'league' ? 'Kotiotteluiden lipputulot' : 'Lipputulot'}</h3>
              <div className="gates">
                {gates.map((g) => (
                  <span key={g.id}><ClubName game={game} id={g.id} /> +{fmt(g.amount)}</span>
                ))}
              </div>
            </>
          )}
          {r.kind === 'league' && (
            <>
              <h3>Sarjataulukko</h3>
              <Standings game={game} />
            </>
          )}
          <button className="primary big" onClick={onContinue}>{last ? 'Kauden päätös' : 'Seuraava viikko'}</button>
        </>
      )}
    </Overlay>
  );
}

function WealthTable({ game }: { game: GameState }) {
  const ranking = game.humans.map((id) => game.clubs[id]).sort((a, b) => wealth(b) - wealth(a) || b.cash - a.cash);
  return (
    <table className="table">
      <thead>
        <tr><th>#</th><th className="left">Manageri</th><th>Kassa</th><th>Pelaajien arvo</th><th>Laina</th><th>Yhteensä</th></tr>
      </thead>
      <tbody>
        {ranking.map((c, i) => (
          <tr key={c.id}>
            <td>{i + 1}</td>
            <td className="left"><ClubName game={game} id={c.id} /></td>
            <td>{fmt(c.cash)}</td>
            <td>{fmt(squadValue(c))}</td>
            <td className={c.loan > 0 ? 'neg' : ''}>{c.loan > 0 ? `−${fmt(c.loan)}` : '–'}</td>
            <td><strong>{fmt(wealth(c))}</strong></td>
          </tr>
        ))}
        {[...game.bankrupt].reverse().map((id, i) => (
          <tr key={id} className="bench">
            <td>{ranking.length + i + 1}</td>
            <td className="left">{game.clubs[id].name}</td>
            <td colSpan={4}>Konkurssi</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function SeasonEnd({ game, onContinue, onFinish }: { game: GameState; onContinue: () => void; onFinish: () => void }) {
  return (
    <Overlay title={`Kausi ${game.season} on päättynyt`}>
      <table className="table">
        <thead>
          <tr><th>#</th><th className="left">Joukkue</th><th>Palkintoraha</th><th className="left">Ensi kaudella</th></tr>
        </thead>
        <tbody>
          {game.seasonSummary!.map((row) => (
            <tr key={row.id}>
              <td>{row.pos}</td>
              <td className="left"><ClubName game={game} id={row.id} /></td>
              <td>{fmt(row.prize)}</td>
              <td className="left small">{row.pos <= 4 ? EURO_COMPS[Math.min(row.pos - 1, 2)].name : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {game.goldenBoot && (
        <p>
          <strong>Kultainen kenkä:</strong> {game.goldenBoot.name} (<ClubName game={game} id={game.goldenBoot.clubId} />),{' '}
          {game.goldenBoot.goals} maalia sarjassa. Seura saa {fmt(GOLDEN_BOOT_PRIZE)}.
        </p>
      )}
      <h3>Tilanne, jos pisteet lasketaan nyt</h3>
      <WealthTable game={game} />
      <p className="muted small">Voittaja on se, jolla on eniten rahaa, kun kassaan lisätään pelaajien arvo.</p>
      <div className="row modal-actions">
        <button className="big" onClick={onFinish}>Laske pisteet</button>
        <button className="primary big" onClick={onContinue}>Vielä yksi kausi!</button>
      </div>
    </Overlay>
  );
}

export function GameOver({ game, onNewGame }: { game: GameState; onNewGame: () => void }) {
  const winner = game.humans.map((id) => game.clubs[id]).sort((a, b) => wealth(b) - wealth(a) || b.cash - a.cash)[0];
  return (
    <Overlay title={winner ? `${winner.name} voittaa` : 'Kaikki managerit menivät konkurssiin'}>
      <p className="muted">
        Peli päättyi {game.season} kauden jälkeen. Voittaja on se, jolla on eniten rahaa, kun kassaan lisätään
        pelaajien arvo.
      </p>
      <WealthTable game={game} />
      <button className="primary big" onClick={onNewGame}>Uusi peli</button>
    </Overlay>
  );
}
