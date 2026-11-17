import { useEffect, useState, type ReactNode } from 'react';
import { POS_NAME, POS_PATTERN, fmt } from './game/data';
import { level, valueOf, type Player } from './game/engine';

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

/** How long the die tumbles before it lands. */
export const ROLL_MS = 900;

/**
 * The sound of a die rattling across a table: a run of short noise clicks that slow down and fade.
 * Made on the spot with Web Audio, so there is no sound file; silently does nothing where audio is unavailable.
 */
export function rattle() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const click = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.03), ctx.sampleRate);
    const data = click.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
    let at = ctx.currentTime;
    for (let n = 0; n < 9; n++) {
      const source = ctx.createBufferSource();
      source.buffer = click;
      source.playbackRate.value = 0.8 + Math.random() * 0.7;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1400 + Math.random() * 1800;
      const gain = ctx.createGain();
      gain.gain.value = 0.5 * (1 - n / 12);
      source.connect(filter).connect(gain).connect(ctx.destination);
      source.start(at);
      at += 0.05 + n * 0.012 + Math.random() * 0.02;
    }
    setTimeout(() => void ctx.close(), ROLL_MS + 400);
  } catch {
    // No sound is fine.
  }
}

/** A die in mid-roll: it shakes and shows a different face every few moments. */
export function TumblingDie() {
  const [value, setValue] = useState(() => 1 + Math.floor(Math.random() * 6));
  useEffect(() => {
    const timer = setInterval(() => setValue((v) => 1 + ((v + Math.floor(Math.random() * 5)) % 6)), 80);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="die die-tumbling" aria-hidden="true">
      {Array.from({ length: 9 }, (_, i) => <span key={i} className={PIPS[value]?.includes(i) ? 'pip' : ''} />)}
    </div>
  );
}

export function Die({ value }: { value: number }) {
  return (
    <div className="die die-landed" role="img" aria-label={`Noppa: ${value}`}>
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
        <strong>{player.name}{player.legend && <span className="robot legend">Legenda</span>}</strong>
        <span className="muted small">
          {POS_NAME[player.pos]} · taito {player.skill} · sisu {player.spirit} · arvo {fmt(valueOf(player))}
        </span>
      </div>
      {children}
    </div>
  );
}
