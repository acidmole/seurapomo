import { useEffect, useState } from 'react';
import Board from './Board';
import { GameOver, MatchdayResults, SeasonEnd } from './Overlays';
import Setup from './Setup';
import Sidebar from './Sidebar';
import { Wordmark } from './ui';
import { CUP_ROUND_NAMES, EURO_ROUND_NAMES, fmt } from './game/data';
import { ROUNDS, STATE_VERSION, actingClubId, thisWeek, createGame, currentClubId, reduce, type Action, type GameState } from './game/engine';

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
  const week = thisWeek(game);

  return (
    <div className="app">
      <header className="topbar">
        <h1><Wordmark /></h1>
        <div className="topbar-info">
          <span>Kausi {game.season}</span>
          <span>
            {week?.kind === 'cup' ? `Cup: ${CUP_ROUND_NAMES[week.index]}`
              : week?.kind === 'euro' ? `Eurocupit: ${EURO_ROUND_NAMES[week.index]}`
              : `Kierros ${Math.min(game.round + 1, ROUNDS)}/${ROUNDS}`}
          </span>
        </div>
        <div className="spacer" />
        <div className="managers">
          {game.humans.map((id) => (
            <div key={id} className={id === current.id && current.human ? 'manager manager-current' : 'manager'}>
              <span className="dot" style={{ background: game.clubs[id].color }} />
              <strong>{game.clubs[id].name}</strong>
              <span className={game.clubs[id].cash < 0 ? 'neg' : ''}>{fmt(game.clubs[id].cash)}</span>
            </div>
          ))}
        </div>
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
        <Sidebar key={actingClubId(game)} game={game} dispatch={dispatch} />
      </main>
      {game.phase === 'matchday' && <MatchdayResults game={game} onContinue={() => dispatch({ type: 'CONTINUE' })} />}
      {game.phase === 'seasonEnd' && (
        <SeasonEnd game={game} onContinue={() => dispatch({ type: 'CONTINUE' })} onFinish={() => dispatch({ type: 'FINISH' })} />
      )}
      {game.phase === 'gameOver' && <GameOver game={game} onNewGame={quit} />}
    </div>
  );
}
