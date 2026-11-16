import type { ReactNode } from 'react';
import { BOARD, SQUARE_INFO, fmt } from './game/data';
import {
  MAX_LEVEL, MAX_SQUAD, MIN_SQUAD, currentClubId, isBroke, mustSell, playerValue, trainingCost,
  type Action, type GameState,
} from './game/engine';
import { Die, Icon, PlayerCard } from './ui';

type Dispatch = (action: Action) => void;

/** Squares run clockwise around a 7 × 7 grid, starting from the top-left corner. */
function cell(i: number): { gridRow: number; gridColumn: number } {
  if (i <= 6) return { gridRow: 1, gridColumn: i + 1 };
  if (i <= 12) return { gridRow: i - 5, gridColumn: 7 };
  if (i <= 18) return { gridRow: 7, gridColumn: 19 - i };
  return { gridRow: 25 - i, gridColumn: 1 };
}

function Center({ game, dispatch }: { game: GameState; dispatch: Dispatch }) {
  const me = game.clubs[currentClubId(game)];
  const p = game.pending;
  const full = me.squad.length >= MAX_SQUAD;
  const square = game.notice ? SQUARE_INFO[BOARD[game.notice.square]] : null;

  const heading = (
    <div className="turn-heading">
      <span className="dot big" style={{ background: me.color }} />
      <div>
        <div className="label">Vuorossa</div>
        <strong className="display">{me.name}</strong>
      </div>
      <div className="spacer" />
      <div className={me.cash < 0 ? 'cash neg' : 'cash'}>{fmt(me.cash)}</div>
    </div>
  );

  if (game.phase === 'roll') {
    return (
      <>
        {heading}
        <div className="center-body centered">
          <p className="muted">Voit vaihtaa muodostelmaa tai myydä pelaajia oikealta ennen heittoa.</p>
          <button className="primary big" onClick={() => dispatch({ type: 'ROLL' })}>Heitä noppaa</button>
        </div>
      </>
    );
  }
  if (game.phase !== 'manage') return <>{heading}</>;

  const notice = (
    <div className="notice">
      <div className="notice-head">
        <Die value={game.die ?? 1} />
        <div>
          <strong className="display">{square?.name}</strong>
          <div className="muted small">{square?.help}</div>
        </div>
      </div>
      {game.notice?.lines.map((line, i) => <p key={i}>{line}</p>)}
    </div>
  );

  let body: ReactNode;
  if (p?.kind === 'auctionPick') {
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
    const bidderFull = bidder.squad.length >= MAX_SQUAD;
    body = (
      <>
        <PlayerCard player={p.player} />
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
        <div className="bidder">
          <span className="dot" style={{ background: bidder.color }} />
          <span>Tarjousvuorossa <strong>{bidder.name}</strong> (kassa {fmt(bidder.cash)})</span>
        </div>
        {bidderFull && <p className="muted small">Joukkue on täynnä ({MAX_SQUAD} pelaajaa). Myy ensin pelaaja oikealta, jos haluat tarjota.</p>}
        {!bidderFull && min > bidder.cash && <p className="muted small">Kassa ei riitä. Voit myydä pelaajia oikealta ja tarjota sitten.</p>}
        <div className="row">
          {[0, 5, 20, 45].map((extra) => (
            <button
              key={extra}
              className="primary"
              disabled={bidderFull || min + extra > bidder.cash}
              onClick={() => dispatch({ type: 'BID', amount: min + extra })}
            >
              {fmt(min + extra)}
            </button>
          ))}
          <button onClick={() => dispatch({ type: 'PASS' })}>Luovun</button>
        </div>
      </>
    );
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
              disabled={full || me.cash < playerValue(o.skill, o.spirit)}
              onClick={() => dispatch({ type: 'SCOUT_BUY', index: i })}
            >
              Osta
            </button>
          </PlayerCard>
        ))}
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
          Olet velkaa {fmt(-me.cash)}, eikä myytävää ole: joukkueessa on enää {MIN_SQUAD} pelaajaa. Seura menee
          konkurssiin, ja putoat pelistä.
        </p>
        <button className="danger big" onClick={() => dispatch({ type: 'BANKRUPT' })}>Konkurssi</button>
      </>
    ) : mustSell(me) ? (
      <>
        <p className="neg">
          Olet velkaa {fmt(-me.cash)}. Myy pelaajia oikealta, kunnes kassa on plussalla. Jos pelaajia jää alle{' '}
          {MIN_SQUAD}, putoat pelistä.
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
