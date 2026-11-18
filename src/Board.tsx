import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BOARD, SQUARE_INFO, fmt } from './game/data';
import {
  MAX_LEVEL, MAX_SQUAD, MIN_SQUAD, actingClubId, currentClubId, isBroke, mustSell, reduce, valueOf, trainingCost, MAX_SPIRIT, MENTAL_COST,
  type Action, type GameState,
} from './game/engine';
import { botToMove } from './game/bot';
import { Die, Fuse, Icon, LAND_MS, PlayerCard, ROLL_MS, TumblingDie, botPause, rattle } from './ui';

type Dispatch = (action: Action) => void;

/** Squares run clockwise around a 7 × 7 grid, starting from the top-left corner. */
function cell(i: number): { gridRow: number; gridColumn: number } {
  if (i <= 6) return { gridRow: 1, gridColumn: i + 1 };
  if (i <= 12) return { gridRow: i - 5, gridColumn: 7 };
  if (i <= 18) return { gridRow: 7, gridColumn: 19 - i };
  return { gridRow: 25 - i, gridColumn: 1 };
}

/**
 * The die rattles and tumbles for a moment, lands on what was rolled and stays there long enough to be read,
 * and only then is the roll made. `peek` tells what the roll will be.
 */
function RollButton({ onRoll, peek }: { onRoll: () => void; peek: () => number }) {
  const [stage, setStage] = useState<'idle' | 'rolling' | 'landed'>('idle');
  const [outcome, setOutcome] = useState(1);
  useEffect(() => {
    if (stage === 'idle') return;
    const timer = stage === 'rolling' ? setTimeout(() => setStage('landed'), ROLL_MS) : setTimeout(onRoll, LAND_MS);
    return () => clearTimeout(timer);
    // Only the change of stage matters; `onRoll` is a fresh function on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  if (stage === 'rolling') return <TumblingDie />;
  if (stage === 'landed') {
    return (
      <div className="roll-outcome" role="status">
        <Die value={outcome} big />
        <strong className="display">Heitit {outcome}</strong>
      </div>
    );
  }
  const start = () => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return onRoll();
    setOutcome(peek());
    rattle();
    setStage('rolling');
  };
  return <button className="primary big" onClick={start}>Heitä noppaa</button>;
}

/** Choosing a player to take from another club: pick the club, then the player. */
function StealPanel({ game, dispatch }: { game: GameState; dispatch: Dispatch }) {
  const me = currentClubId(game);
  const others = game.clubs.filter((c) => c.id !== me);
  const [clubId, setClubId] = useState(others[0].id);
  const club = game.clubs[clubId];
  const locked = club.squad.length <= MIN_SQUAD;
  return (
    <>
      <p>Valitse seura ja pelaaja. Pelaaja siirtyy sinulle ilmaiseksi.</p>
      <label className="formation">
        <span className="label">Seura</span>
        <select value={clubId} onChange={(e) => setClubId(Number(e.target.value))}>
          {others.map((c) => <option key={c.id} value={c.id}>{c.name}{c.human ? ' (manageri)' : ''}</option>)}
        </select>
      </label>
      {locked && <p className="muted small">Tässä seurassa on enää {MIN_SQUAD} pelaajaa, joten siltä ei voi viedä ketään.</p>}
      <div className="scroll-list">
        {[...club.squad].sort((a, b) => b.skill - a.skill).map((o) => (
          <PlayerCard key={o.id} player={o}>
            <button className="primary" disabled={locked} onClick={() => dispatch({ type: 'STEAL', clubId, playerId: o.id })}>Vie</button>
          </PlayerCard>
        ))}
      </div>
      <button onClick={() => dispatch({ type: 'SKIP' })}>Ei kiitos</button>
    </>
  );
}

function Center({ game, dispatch }: { game: GameState; dispatch: Dispatch }) {
  const me = game.clubs[currentClubId(game)];
  const p = game.pending;
  const full = me.squad.length >= MAX_SQUAD;
  const square = game.notice ? SQUARE_INFO[BOARD[game.notice.square]] : null;

  // Every move the computer makes gives a new game state, which starts the fuse afresh.
  const moves = useRef({ game, n: 0 });
  if (moves.current.game !== game) moves.current = { game, n: moves.current.n + 1 };

  const heading = (
    <>
    <div className="turn-heading">
      <span className="dot big" style={{ background: me.color }} />
      <div>
        <div className="label">Vuorossa</div>
        <strong className="display">{me.name}</strong>
      </div>
      <div className="spacer" />
      <div className={me.cash < 0 ? 'cash neg' : 'cash'}>{fmt(me.cash)}</div>
    </div>
    {botToMove(game) && <Fuse key={moves.current.n} ms={botPause(game)} />}
    </>
  );

  const thinking = <p className="muted thinking">{game.clubs[actingClubId(game)].name} on tietokoneen ohjaama. Se miettii siirtoaan…</p>;

  if (game.phase === 'roll') {
    if (me.auto) return <>{heading}<div className="center-body centered">{thinking}</div></>;
    return (
      <>
        {heading}
        <div className="center-body centered">
          <p className="muted">Voit vaihtaa muodostelmaa tai myydä pelaajia oikealta ennen heittoa.</p>
          <RollButton onRoll={() => dispatch({ type: 'ROLL' })} peek={() => reduce(game, { type: 'ROLL' }).die ?? 1} />
        </div>
      </>
    );
  }
  if (game.phase !== 'manage') return <>{heading}</>;

  const notice = (
    <div className="notice">
      {!!game.notice?.upkeep.length && (
        <div className="upkeep">
          <span className="label">Vuoron alussa</span>
          {game.notice.upkeep.map((line, i) => <span key={i} className="small">{line}</span>)}
        </div>
      )}
      <div className="notice-head">
        <Die value={game.die ?? 1} />
        <div>
          <strong className="display">{square?.name}</strong>
          {game.notice?.mark === 'crisis' && <span className="mark crisis">Kriisi</span>}
          {game.notice?.mark === 'lucky' && <span className="mark lucky">Onnenpotku</span>}
          <div className="muted small">{square?.help}</div>
        </div>
      </div>
      {!!game.notice?.lines.length && (
        <div className={`outcome ${game.notice.mark ?? ''}`}>
          {game.notice.lines.map((line, i) => <p key={i}>{line}</p>)}
          {game.notice.buyer !== undefined && (
            <p className="buyer">
              <span className="label">Ostaja</span>
              <span className="dot big" style={{ background: game.clubs[game.notice.buyer].color }} />
              <strong className="display">{game.clubs[game.notice.buyer].name}</strong>
              {game.clubs[game.notice.buyer].auto && <span className="robot">Tietokone</span>}
            </p>
          )}
        </div>
      )}
    </div>
  );

  let body: ReactNode;
  if (p?.kind === 'release') {
    const loser = game.clubs[p.club];
    body = loser.auto ? thinking : (
      <p>
        <strong>{loser.name}</strong>: joukkueessa on nyt {loser.squad.length} pelaajaa, ja enintään {MAX_SQUAD} mahtuu.
        Myy yksi pelaaja oikealta, niin peli jatkuu.
      </p>
    );
  } else if (me.auto && p?.kind !== 'auction') {
    body = (
      <>
        {p?.kind === 'auctionPick' || p?.kind === 'scout' ? p.options.map((o) => <PlayerCard key={o.id} player={o} />) : null}
        {thinking}
      </>
    );
  } else if (p?.kind === 'auctionPick') {
    body = (
      <>
        <p>Valitse pelaaja, josta huudetaan.</p>
        {p.options.map((o, i) => (
          <PlayerCard key={o.id} player={o}>
            <button className="primary" onClick={() => dispatch({ type: 'AUCTION_PICK', index: i })}>Huutokauppaan</button>
          </PlayerCard>
        ))}
      </>
    );
  } else if (p?.kind === 'auction') {
    const bidder = game.clubs[p.active[p.idx]];
    const min = p.leader === null ? p.minBid : p.bid + 5;
    const bidderFull = bidder.squad.length >= MAX_SQUAD && bidder.id !== p.owner;
    const short = min > bidder.cash;
    body = (
      <>
        <PlayerCard player={p.player} />
        {p.owner !== null && (
          <p className="muted small">
            Pelaaja kuuluu seuralle {game.clubs[p.owner].name}. Jos se voittaa, se maksaa uuden sopimuksen hinnan; jos
            joku muu voittaa, kauppahinta menee sille.
          </p>
        )}
        <div className="auction-status">
          {p.leader === null ? (
            <span>Lähtöhinta <strong>{fmt(p.minBid)}</strong></span>
          ) : (
            <span>Korkein tarjous <strong>{fmt(p.bid)}</strong> · {game.clubs[p.leader].name}</span>
          )}
        </div>
        {p.subsidy && (
          <p className="muted small">
            Sponsori maksaa hinnasta {fmt(p.subsidy.amount)}, jos {game.clubs[p.subsidy.club].name} voittaa.
          </p>
        )}
        <ul className="bidders" aria-label="Huutajat ja kassat">
          {game.humans.map((id) => {
            const c = game.clubs[id];
            const status = id === bidder.id ? 'Tarjousvuorossa' : id === p.leader ? 'Korkein tarjous' : p.active.includes(id) ? 'Mukana' : 'Ei mukana';
            return (
              <li key={id} className={id === bidder.id ? 'bidder bidder-turn' : p.active.includes(id) ? 'bidder' : 'bidder bidder-out'}>
                <span className="dot" style={{ background: c.color }} />
                <strong>{c.name}</strong>
                <span className="bidder-cash">{fmt(c.cash)}</span>
                <span className="bidder-status">{status}</span>
              </li>
            );
          })}
        </ul>
        {bidderFull && <p className="muted small">Joukkue on täynnä ({MAX_SQUAD} pelaajaa). Voit silti tarjota: jos voitat, sinun on myytävä yksi pelaaja.</p>}
        {short && <p className="muted small">Kassa ei riitä. Voit myydä pelaajia tai ottaa lainaa oikealta ja tarjota sitten.</p>}
        {bidder.auto ? thinking : (
        <div className="row">
          {[0, 5, 20, 45].map((extra) => (
            <button
              key={extra}
              className="primary"
              disabled={min + extra > bidder.cash}
              onClick={() => dispatch({ type: 'BID', amount: min + extra })}
            >
              {fmt(min + extra)}
            </button>
          ))}
          <button onClick={() => dispatch({ type: 'PASS' })}>Luovun</button>
        </div>
        )}
      </>
    );
  } else if (p?.kind === 'crisis') {
    body = (
      <div className="row">
        <button className="primary" disabled={me.cash < p.cost} onClick={() => dispatch({ type: 'CRISIS', pay: true })}>
          Maksa {fmt(p.cost)}
        </button>
        <button onClick={() => dispatch({ type: 'CRISIS', pay: false })}>Älä maksa</button>
      </div>
    );
  } else if (p?.kind === 'windfall') {
    body = (
      <div className="row">
        <button className="primary" onClick={() => dispatch({ type: 'WINDFALL', keep: true })}>Ota {fmt(p.amount)} kassaan</button>
        <button onClick={() => dispatch({ type: 'WINDFALL', keep: false })}>Lupaa rahat pelaajille</button>
      </div>
    );
  } else if (p?.kind === 'steal') {
    body = <StealPanel game={game} dispatch={dispatch} />;
  } else if (p?.kind === 'scout') {
    body = (
      <>
        <p>Kykyjenetsijä ehdottaa kolmea pelaajaa. Voit ostaa yhden.</p>
        {full && <p className="muted small">Joukkue on täynnä ({MAX_SQUAD} pelaajaa). Myy ensin pelaaja oikealta, jos haluat ostaa.</p>}
        {!full && <p className="muted small">Jos kassa ei riitä, voit myydä pelaajia oikealta ja ostaa sitten.</p>}
        {p.options.map((o, i) => (
          <PlayerCard key={o.id} player={o}>
            <button
              className="primary"
              disabled={full || me.cash < valueOf(o)}
              onClick={() => dispatch({ type: 'SCOUT_BUY', index: i })}
            >
              Osta
            </button>
          </PlayerCard>
        ))}
        <button onClick={() => dispatch({ type: 'SKIP' })}>Ei kiitos</button>
      </>
    );
  } else if (p?.kind === 'mental') {
    body = (
      <>
        <p>Valitse pelaaja henkisen valmentajan puheille. Sisu nousee yhdellä.</p>
        <div className="scroll-list">
          {[...me.squad].sort((a, b) => b.skill - a.skill).map((o) => (
            <PlayerCard key={o.id} player={o}>
              <button
                className="primary"
                disabled={o.spirit >= MAX_SPIRIT || me.cash < MENTAL_COST}
                onClick={() => dispatch({ type: 'COACH', playerId: o.id })}
              >
                {fmt(MENTAL_COST)}
              </button>
            </PlayerCard>
          ))}
        </div>
        <button onClick={() => dispatch({ type: 'SKIP' })}>Ei kiitos</button>
      </>
    );
  } else if (p?.kind === 'training') {
    body = (
      <>
        <p>Valitse pelaaja leirille. Taito nousee yhdellä.</p>
        <div className="scroll-list">
          {[...me.squad].sort((a, b) => b.skill - a.skill).map((o) => (
            <PlayerCard key={o.id} player={o}>
              <button
                className="primary"
                disabled={o.skill >= MAX_LEVEL || (!p.free && me.cash < trainingCost(o))}
                onClick={() => dispatch({ type: 'TRAIN', playerId: o.id })}
              >
                {p.free ? 'Ilmainen' : fmt(trainingCost(o))}
              </button>
            </PlayerCard>
          ))}
        </div>
        <button onClick={() => dispatch({ type: 'SKIP' })}>Ei kiitos</button>
      </>
    );
  } else {
    const last = game.order.length === 1;
    body = isBroke(me) ? (
      <>
        <p className="neg">
          Olet velkaa {fmt(-me.cash)}, eikä myytävää ole: joukkueessa on enää {MIN_SQUAD} pelaajaa, eikä pankki
          lainaa enää tarpeeksi. Seura menee konkurssiin, ja putoat pelistä.
        </p>
        <button className="danger big" onClick={() => dispatch({ type: 'BANKRUPT' })}>Konkurssi</button>
      </>
    ) : mustSell(me) ? (
      <>
        <p className="neg">
          Olet velkaa {fmt(-me.cash)}. Myy pelaajia tai ota pankkilainaa oikealta, kunnes kassa on plussalla.
          Joukkueessa on oltava vähintään {MIN_SQUAD} pelaajaa.
        </p>
        <button className="primary big" disabled>Lopeta vuoro</button>
      </>
    ) : (
      <button className="primary big" onClick={() => dispatch({ type: 'END_TURN' })}>
        {last ? 'Lopeta vuoro ja pelaa kierros' : 'Lopeta vuoro'}
      </button>
    );
  }

  return (
    <>
      {heading}
      <div className="center-body">
        {notice}
        {body}
      </div>
    </>
  );
}

export default function Board({ game, dispatch }: { game: GameState; dispatch: Dispatch }) {
  const humans = game.humans.map((id) => game.clubs[id]);
  const currentId = currentClubId(game);
  const currentPos = game.clubs[currentId]?.human ? game.clubs[currentId].boardPos : -1;
  return (
    <section className="board" aria-label="Pelilauta">
      {BOARD.map((type, i) => {
        const info = SQUARE_INFO[type];
        return (
          <div key={i} className={i === currentPos ? 'sticker sticker-current' : 'sticker'} style={cell(i)} title={info.help}>
            <div className="sticker-field" style={{ background: info.pattern }}>
              <span className="sticker-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              <span className="emblem"><Icon path={info.icon} /></span>
              <div className="tokens">
                {humans.filter((c) => c.boardPos === i).map((c) => (
                  <span
                    key={c.id}
                    role="img"
                    aria-label={c.name}
                    className={c.id === currentId ? 'token token-current' : 'token'}
                    style={{ background: c.color }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>
            <div className="sticker-name">{info.name}</div>
          </div>
        );
      })}
      <div className="pitch">
        <div className="pitch-line pitch-edge" aria-hidden="true" />
        <div className="pitch-line pitch-halfway" aria-hidden="true" />
        <div className="pitch-line pitch-circle" aria-hidden="true" />
        <div className="pitch-line pitch-box pitch-box-left" aria-hidden="true" />
        <div className="pitch-line pitch-box pitch-box-right" aria-hidden="true" />
        <div className="scoreboard">
          <Center game={game} dispatch={dispatch} />
        </div>
      </div>
    </section>
  );
}
