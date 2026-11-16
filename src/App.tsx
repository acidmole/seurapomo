import { useEffect, useState } from 'react';
import Board from './Board';
import { GameOver, MatchdayResults, SeasonEnd } from './Overlays';
import Setup from './Setup';
import Sidebar from './Sidebar';
import { ROUNDS, STATE_VERSION, createGame, currentClubId, reduce, type Action, type GameState } from './game/engine';

const SAVE_KEY = 'seurapomo-save';

function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    const saved = raw ? (JSON.parse(raw) as GameState) : null;
    return saved?.version === STATE_VERSION ? saved : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [stored, setGame] = useState<GameState | null>(loadGame);
  // A game from before a rules change (kept alive by hot reload during development) is dropped, not played.
  const game = stored?.version === STATE_VERSION ? stored : null;
  const [confirmQuit, setConfirmQuit] = useState(false);

  useEffect(() => {
    try {
      if (game) localStorage.setItem(SAVE_KEY, JSON.stringify(game));
      else localStorage.removeItem(SAVE_KEY);
    } catch {
      // Saving is a convenience; the game works without it.
    }
  }, [game]);

  if (!game) return <Setup onStart={(config) => setGame(createGame(config))} />;

  const dispatch = (action: Action) => setGame((g) => g && reduce(g, action));
  const quit = () => {
    setConfirmQuit(false);
    setGame(null);
  };
  const current = game.clubs[currentClubId(game)];

  return (
    <div className="app">
      <header className="topbar">
        <h1>⚽ Seurapomo</h1>
        <div className="topbar-info">
          Kausi {game.season}/{game.seasons} · Kierros {Math.min(game.round + 1, ROUNDS)}/{ROUNDS}
        </div>
        <div className="spacer" />
        {confirmQuit ? (
          <>
            <span className="muted">Lopetetaanko tämä peli?</span>
            <button className="danger" onClick={quit}>Lopeta peli</button>
            <button onClick={() => setConfirmQuit(false)}>Peruuta</button>
          </>
        ) : (
          <button onClick={() => setConfirmQuit(true)}>Uusi peli</button>
        )}
      </header>
      <main className="layout">
        <Board game={game} dispatch={dispatch} />
        <Sidebar key={current.id} game={game} dispatch={dispatch} />
      </main>
      {game.phase === 'matchday' && <MatchdayResults game={game} onContinue={() => dispatch({ type: 'CONTINUE' })} />}
      {game.phase === 'seasonEnd' && <SeasonEnd game={game} onContinue={() => dispatch({ type: 'CONTINUE' })} />}
      {game.phase === 'gameOver' && <GameOver game={game} onNewGame={quit} />}
    </div>
  );
}
