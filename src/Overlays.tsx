import type { ReactNode } from 'react';
import { ClubName, EuroTies, FixtureList, Standings, Ties } from './Sidebar';
import { CUP_ROUND_NAMES, EURO_COMPS, EURO_ROUND_NAMES, fmt } from './game/data';
import { finalScore, type GameState } from './game/engine';

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

export function MatchdayResults({ game, onContinue }: { game: GameState; onContinue: () => void }) {
  const r = game.results!;
  const last = game.week === game.calendar.length - 1;
  const fixtures = r.kind === 'league' ? game.schedule[r.index] : [];
  const gates = fixtures.filter((f) => game.clubs[f.home].human && f.gate != null);
  const title =
    r.kind === 'league' ? `Kierroksen ${r.index + 1} tulokset`
    : r.kind === 'cup' ? `Cup: ${CUP_ROUND_NAMES[r.index].toLowerCase()}`
    : `Eurocupit: ${EURO_ROUND_NAMES[r.index].toLowerCase()}`;
  return (
    <Overlay title={title}>
      {r.kind === 'league' && <FixtureList game={game} fixtures={fixtures} />}
      {r.kind === 'cup' && <Ties game={game} ties={game.cup[r.index]} />}
      {r.kind === 'euro' && game.euro.map((comp) => <EuroTies key={comp.tier} game={game} comp={comp} round={r.index} />)}
      {r.kind !== 'league' && (
        <p className="muted small">Joukkueet, joilla ei ollut ottelua tällä viikolla, lepäsivät: niiden pelaajien kunto palautui.</p>
      )}
      {gates.length > 0 && (
        <>
          <h3>Kotiotteluiden lipputulot</h3>
          <div className="gates">
            {gates.map((f) => (
              <span key={f.home}><ClubName game={game} id={f.home} /> +{fmt(f.gate!)}</span>
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
    </Overlay>
  );
}

export function SeasonEnd({ game, onContinue }: { game: GameState; onContinue: () => void }) {
  const last = game.season >= game.seasons;
  return (
    <Overlay title={`Kausi ${game.season} on päättynyt`}>
      <table className="table">
        <thead>
          <tr><th>#</th><th className="left">Joukkue</th><th>Palkintoraha</th><th>Pisteet</th>{!last && <th className="left">Ensi kaudella</th>}</tr>
        </thead>
        <tbody>
          {game.seasonSummary!.map((row) => (
            <tr key={row.id}>
              <td>{row.pos}</td>
              <td className="left"><ClubName game={game} id={row.id} /></td>
              <td>{fmt(row.prize)}</td>
              <td><strong>+{row.vp}</strong></td>
              {!last && <td className="left small">{row.pos <= 4 ? EURO_COMPS[Math.min(row.pos - 1, 2)].name : ''}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      <button className="primary big" onClick={onContinue}>{last ? 'Lopputulokset' : `Aloita kausi ${game.season + 1}`}</button>
    </Overlay>
  );
}

export function GameOver({ game, onNewGame }: { game: GameState; onNewGame: () => void }) {
  const ranking = game.humans.map((id) => game.clubs[id]).sort((a, b) => finalScore(b) - finalScore(a) || b.cash - a.cash);
  return (
    <Overlay title={ranking.length ? `${ranking[0].name} voittaa` : 'Kaikki managerit menivät konkurssiin'}>
      <p className="muted">
        Pisteitä saa sarjasijoituksista, cupista ja eurocupeista. Lisäksi jokainen täysi 100 000 € kassassa on yhden pisteen arvoinen,
        ja velkaantunut manageri joutuu myymään pelaajiaan.
      </p>
      <table className="table">
        <thead>
          <tr><th>#</th><th className="left">Manageri</th><th>Kilpailut</th><th>Kassa</th><th>Yhteensä</th></tr>
        </thead>
        <tbody>
          {ranking.map((c, i) => (
            <tr key={c.id}>
              <td>{i + 1}</td>
              <td className="left"><ClubName game={game} id={c.id} /></td>
              <td>{c.vp}</td>
              <td>{fmt(c.cash)}</td>
              <td><strong>{finalScore(c)}</strong></td>
            </tr>
          ))}
          {[...game.bankrupt].reverse().map((id, i) => (
            <tr key={id} className="bench">
              <td>{ranking.length + i + 1}</td>
              <td className="left">{game.clubs[id].name}</td>
              <td colSpan={3}>Konkurssi</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="primary big" onClick={onNewGame}>Uusi peli</button>
    </Overlay>
  );
}
