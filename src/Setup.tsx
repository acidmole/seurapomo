import { useState } from 'react';
import { HUMAN_COLORS } from './game/data';
import { Wordmark } from './ui';
import { LEAGUE_SIZE, type GameConfig } from './game/engine';

const DEFAULT_NAMES = ['Punaiset', 'Siniset', 'Keltaiset', 'Vihreät', 'Violetit', 'Turkoosit'];

export default function Setup({ onStart }: { onStart: (config: GameConfig) => void }) {
  const [count, setCount] = useState(2);
  const [names, setNames] = useState(DEFAULT_NAMES);
  const [seasons, setSeasons] = useState(2);

  const start = () =>
    onStart({
      clubs: names.slice(0, count).map((name, i) => ({ name: name.trim() || DEFAULT_NAMES[i], color: HUMAN_COLORS[i] })),
      seasons,
      seed: Date.now() % 2147483647,
    });

  return (
    <div className="setup">
      <div className="paper setup-card">
        <h1><Wordmark /></h1>
        <p className="muted">
          Jalkapallomanageripeli samalle ruudulle. Heittäkää noppaa vuorotellen, kiertäkää lautaa, vahvistakaa joukkuetta
          ja pelatkaa kierros kerrallaan sarjaa ja cupia. Liigassa on {LEAGUE_SIZE} joukkuetta, ja tietokone ohjaa loput.
        </p>

        <h2 className="label">Managerit</h2>
        <div className="segmented">
          {[2, 3, 4, 5, 6].map((n) => (
            <button key={n} className={n === count ? 'active' : ''} onClick={() => setCount(n)}>{n}</button>
          ))}
        </div>
        <div className="setup-names">
          {names.slice(0, count).map((name, i) => (
            <label key={i}>
              <span className="dot" style={{ background: HUMAN_COLORS[i] }} />
              <input
                value={name}
                maxLength={22}
                aria-label={`Seuran ${i + 1} nimi`}
                onChange={(e) => setNames(names.map((n, j) => (j === i ? e.target.value : n)))}
              />
            </label>
          ))}
        </div>

        <h2 className="label">Pelin pituus</h2>
        <div className="segmented">
          {[1, 2, 3].map((n) => (
            <button key={n} className={n === seasons ? 'active' : ''} onClick={() => setSeasons(n)}>
              {n === 1 ? '1 kausi' : `${n} kautta`}
            </button>
          ))}
        </div>
        <p className="muted small">
          Yksi kausi kestää noin 45–60 minuuttia. Ensimmäisellä kaudella eurocupeissa pelaavat vain tietokoneen
          seurat; managerit pääsevät mukaan sijoittumalla sarjassa neljän parhaan joukkoon.
        </p>

        <button className="primary big" onClick={start}>Aloita peli</button>
      </div>
    </div>
  );
}
