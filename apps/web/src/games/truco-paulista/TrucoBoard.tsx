import { useState } from 'react';
import { BET_NAMES, type Card, type TrucoAction, type TrucoView } from '@tablehub/games/truco-paulista/engine';
import { useFreshKeys } from '../../components/table/anim';
import { GameTableLayout, fromSeat } from '../../components/table/GameTableLayout';
import { arrangeSeats } from '../../components/table/seats';
import type { BoardProps } from '../registry';
import './truco.css';

const SUIT_SYMBOL: Record<Card['suit'], string> = { ouros: '♦', espadas: '♠', copas: '♥', paus: '♣' };

export function PlayingCard({ card, manilha, small, back }: { card?: Card | null; manilha?: string; small?: boolean; back?: boolean }) {
  if (back || !card) return <div className={`pcard back ${small ? 'small' : ''}`} aria-label="Carta virada" />;
  const red = card.suit === 'copas' || card.suit === 'ouros';
  return (
    <div className={`pcard ${red ? 'red' : ''} ${small ? 'small' : ''} ${card.rank === manilha ? 'manilha' : ''}`} aria-label={`${card.rank} de ${card.suit}`}>
      <span className="corner">
        {card.rank}
        <br />
        {SUIT_SYMBOL[card.suit]}
      </span>
      <span className="center">{SUIT_SYMBOL[card.suit]}</span>
    </div>
  );
}

export default function TrucoBoard({ game, room, you, act }: BoardProps) {
  const v = game.view as TrucoView;
  const legal = game.legal as TrucoAction[];
  const [faceDown, setFaceDown] = useState(false);
  const has = (t: TrucoAction['type']) => legal.some((a) => a.type === t);
  const canFaceDown = legal.some((a) => a.type === 'play' && a.faceDown);
  const nameOf = (id: string) => (id === you ? 'Você' : (v.players.find((p) => p.id === id)?.name ?? id));
  const myTeam = v.myTeam ?? 0;
  const teamLabel = (t: number) => (v.players.length === 4 ? (t === myTeam ? 'Nós' : 'Eles') : t === myTeam ? 'Você' : (v.players.find((p) => p.team === t)?.name ?? ''));

  const places = arrangeSeats(
    v.players.map((p) => p.id),
    you,
  );
  const fresh = useFreshKeys(v.current.map((c) => `${v.handNumber}:${v.tricks.length}:${c.playerId}`));
  const lastTrick = v.tricks.at(-1);
  const collecting = useFreshKeys(lastTrick ? [`${v.handNumber}:${v.tricks.length}`] : [], 900).size > 0;
  const counters = (id: string) => {
    const p = v.players.find((x) => x.id === id)!;
    return (
      <>
        {v.players.length === 4 && <span className="badge">{p.team === myTeam ? 'Nós' : 'Eles'}</span>}
        {id !== you && (
          <span>
            {p.cards} {p.cards === 1 ? 'carta' : 'cartas'}
          </span>
        )}
        {id === v.dealer && <span title="Deu as cartas">deu</span>}
      </>
    );
  };

  const playCard = (index: number) => {
    act({ type: 'play', index, faceDown: faceDown && canFaceDown });
    setFaceDown(false);
  };

  return (
    <div className="stack">
      <div className="truco-score card">
        <div className="team">
          <span className="muted small">{teamLabel(myTeam)}</span>
          <strong>{v.scores[myTeam]}</strong>
        </div>
        <div className="mid">
          <div className="badge">
            Mão {v.handNumber} · vale <strong style={{ marginLeft: 4 }}>{v.value}</strong>
          </div>
          <div className="muted small">até {v.pointsToWin}</div>
          {v.special !== 'normal' && <div className="badge badge-warn">{v.special === 'maoDeOnze' ? 'Mão de onze' : 'Mão de ferro'}</div>}
        </div>
        <div className="team">
          <span className="muted small">{teamLabel(1 - myTeam)}</span>
          <strong>{v.scores[1 - myTeam]}</strong>
        </div>
      </div>

      <GameTableLayout
        game={game}
        room={room}
        you={you}
        places={places}
        counters={counters}
        className="truco-table"
        cornerLeft={
          <div className="vira">
            <PlayingCard card={v.vira} small />
            <span className="small">
              Vira · manilha <strong>{v.manilha}</strong>
            </span>
          </div>
        }
        cornerRight={
          <div className="tricks">
            {[0, 1, 2].map((i) => {
              const t = v.tricks[i];
              const label = !t ? '·' : t.winnerTeam === null ? '=' : t.winnerTeam === myTeam ? '✓' : '✗';
              return (
                <span key={i} className={`trick ${t ? (t.winnerTeam === null ? 'tie' : t.winnerTeam === myTeam ? 'won' : 'lost') : ''}`} title={`Vaza ${i + 1}`}>
                  {label}
                </span>
              );
            })}
          </div>
        }
      >
        <div className="truco-trick">
          {places.map((pl) => {
            const play = v.current.find((c) => c.playerId === pl.id);
            const k = `${v.handNumber}:${v.tricks.length}:${pl.id}`;
            return (
              <div key={pl.id} className={`truco-slot truco-slot-${pl.region}`}>
                {play ? (
                  <div className={`truco-play ${fresh.has(k) ? 'enter' : ''}`} style={fromSeat(pl)}>
                    <PlayingCard card={play.card} back={play.faceDown} manilha={v.manilha} />
                  </div>
                ) : (
                  <div className="pcard placeholder" />
                )}
              </div>
            );
          })}
          {collecting && lastTrick && (
            // o vencedor recolhe a vaza: as cartas ficam um instante e deslizam para o assento dele
            <div className="truco-trick truco-collect" style={fromSeat(places.find((p) => p.id === lastTrick.winnerPlayer))} aria-hidden="true">
              {places.map((pl) => {
                const play = lastTrick.plays.find((c) => c.playerId === pl.id);
                return (
                  <div key={pl.id} className={`truco-slot truco-slot-${pl.region}`}>
                    {play && <PlayingCard card={play.card} back={play.faceDown} manilha={v.manilha} />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {v.lastHand && v.lastHand.number === v.handNumber - 1 && v.tricks.length === 0 && v.current.length === 0 && <div className="small truco-last">{v.lastHand.text}</div>}
      </GameTableLayout>

      {v.pending && (
        <div className="card stack truco-call">
          <strong>
            {nameOf(v.pending.by)} pediu {BET_NAMES[v.pending.to]}!
          </strong>
          {has('accept') ? (
            <div className="row">
              <button className="btn btn-primary grow" onClick={() => act({ type: 'accept' })}>
                Aceitar ({v.pending.to})
              </button>
              <button className="btn btn-danger grow" onClick={() => act({ type: 'run' })}>
                Correr
              </button>
              {has('raise') && (
                <button className="btn btn-warn grow" onClick={() => act({ type: 'raise' })}>
                  {BET_NAMES[v.pending.to === 3 ? 6 : v.pending.to === 6 ? 9 : 12]}!
                </button>
              )}
            </div>
          ) : (
            <span className="muted">Aguardando resposta…</span>
          )}
        </div>
      )}

      {!v.onzeDecided && v.onzeTeam !== null && (
        <div className="card stack truco-call">
          <strong>Mão de onze</strong>
          {v.partnerHand && (
            <div>
              <div className="muted small">Cartas de {nameOf(v.partnerHand.playerId)}:</div>
              <div className="row">
                {v.partnerHand.cards.map((c, i) => (
                  <PlayingCard key={i} card={c} manilha={v.manilha} small />
                ))}
              </div>
            </div>
          )}
          {has('onze') ? (
            <div className="row">
              <button className="btn btn-primary grow" onClick={() => act({ type: 'onze', play: true })}>
                Jogar (vale 3)
              </button>
              <button className="btn btn-danger grow" onClick={() => act({ type: 'onze', play: false })}>
                Correr (+1 para eles)
              </button>
            </div>
          ) : (
            <span className="muted">Os adversários estão decidindo se jogam…</span>
          )}
        </div>
      )}

      <div className="card stack">
        <div className="row">
          <strong className="grow">Suas cartas</strong>
          {canFaceDown && (
            <label className="switch small">
              <input type="checkbox" checked={faceDown} onChange={(e) => setFaceDown(e.target.checked)} />
              Jogar encoberta
            </label>
          )}
          {has('truco') && (
            <button className="btn btn-warn" onClick={() => act({ type: 'truco' })}>
              {BET_NAMES[v.nextBet ?? 3] ?? 'Truco'}!
            </button>
          )}
        </div>
        <div className="truco-hand">
          {v.myHand === null
            ? Array.from({ length: v.players.find((p) => p.id === you)?.cards ?? 0 }, (_, i) => (
                <button key={i} className="pcard-btn" disabled={!has('play')} onClick={() => playCard(i)}>
                  <PlayingCard back />
                </button>
              ))
            : v.myHand.map((c, i) => (
                <button key={`${c.rank}${c.suit}`} className="pcard-btn" disabled={!has('play')} onClick={() => playCard(i)}>
                  <PlayingCard card={c} manilha={v.manilha} />
                </button>
              ))}
        </div>
        {v.special === 'maoDeFerro' && <p className="muted small" style={{ margin: 0 }}>Mão de ferro: ninguém vê as próprias cartas.</p>}
      </div>
    </div>
  );
}
