import type { ReactNode } from 'react';
import { CupTies, ClubName, FixtureList, Standings } from './Sidebar';
import { CUP_ROUND_NAMES, fmt } from './game/data';
import { ROUNDS, finalScore, type GameState } from './game/engine';

function Overlay({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overlay">
      <div className="card modal">
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function MatchdayResults({ game, onContinue }: { game: GameState; onContinue: () => void }) {
  const r = game.results!;
  const last = r.round === ROUNDS - 1;
  return (
    <Overlay title={`Kierroksen ${r.round + 1} tulokset`}>
      <FixtureList game={game} fixtures={game.schedule[r.round]} />
      {r.cupRound !== null && (
        <>
          <h3>Cup: {CUP_ROUND_NAMES[r.cupRound].toLowerCase()}</h3>
          <CupTies game={game} ties={game.cup[r.cupRound]} />
        </>
      )}
      <h3>Sarjataulukko</h3>
      <Standings game={game} />
      <button className="primary big" onClick={onContinue}>{last ? 'Kauden päätös' : 'Seuraava kierros'}</button>
    </Overlay>
  );
}

export function SeasonEnd({ game, onContinue }: { game: GameState; onContinue: () => void }) {
  const last = game.season >= game.seasons;
  return (
    <Overlay title={`Kausi ${game.season} on päättynyt`}>
      <table className="table">
        <thead>
          <tr><th>#</th><th className="left">Joukkue</th><th>Palkintoraha</th><th>Pisteet</th></tr>
        </thead>
        <tbody>
          {game.seasonSummary!.map((row) => (
            <tr key={row.id}>
              <td>{row.pos}</td>
              <td className="left"><ClubName game={game} id={row.id} /></td>
              <td>{fmt(row.prize)}</td>
              <td><strong>+{row.vp}</strong></td>
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
    <Overlay title={`🏆 ${ranking[0].name} voittaa`}>
      <p className="muted">
        Pisteitä saa sarjasijoituksista ja cupista. Lisäksi jokainen täysi 100 000 € kassassa on yhden pisteen arvoinen,
        ja velka vähentää pisteitä.
      </p>
      <table className="table">
        <thead>
          <tr><th>#</th><th className="left">Manageri</th><th>Sarja ja cup</th><th>Kassa</th><th>Yhteensä</th></tr>
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
        </tbody>
      </table>
      <button className="primary big" onClick={onNewGame}>Uusi peli</button>
    </Overlay>
  );
}
