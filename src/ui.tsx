import type { ReactNode } from 'react';
import { POS_NAME, POS_PATTERN, fmt } from './game/data';
import { level, playerValue, type Player } from './game/engine';

/** A line icon drawn from one SVG path on a 24 × 24 grid. */
export function Icon({ path }: { path: string }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9.5" />
        <path d="m12 7.5 4 3-1.5 4.7h-5L8 10.5zM12 2.5v5M21 10l-5 .5M17.5 19.5l-3-4.3M6.5 19.5l3-4.3M3 10l5 .5" />
      </svg>
      Seurapomo
    </span>
  );
}

/** Which of the nine cells of a die face carry a pip, for each value. */
const PIPS: Record<number, number[]> = {
  1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};

export function Die({ value }: { value: number }) {
  return (
    <div className="die" role="img" aria-label={`Noppa: ${value}`}>
      {Array.from({ length: 9 }, (_, i) => <span key={i} className={PIPS[value]?.includes(i) ? 'pip' : ''} />)}
    </div>
  );
}

/** A player shown as an album sticker: shirt pattern for his position, current level in the roundel. */
export function PlayerCard({ player, children }: { player: Player; children?: ReactNode }) {
  return (
    <div className="player-card">
      <div className="player-card-shirt" style={{ background: POS_PATTERN[player.pos] }} aria-hidden="true">
        <span className="roundel">{level(player)}</span>
      </div>
      <div className="player-card-main">
        <strong>{player.name}</strong>
        <span className="muted small">
          {POS_NAME[player.pos]} · taito {player.skill} · sisu {player.spirit} · arvo {fmt(playerValue(player.skill, player.spirit))}
        </span>
      </div>
      {children}
    </div>
  );
}
