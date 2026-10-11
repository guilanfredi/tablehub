import { useState } from 'react';
import { BET_NAMES, type Card, type TrucoAction, type TrucoView } from '@tablehub/games/truco-paulista/engine';
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

export default function TrucoBoard({ game, you, act }: BoardProps) {
  const v = game.view as TrucoView;
  const legal = game.legal as TrucoAction[];
  const [faceDown, setFaceDown] = useState(false);
  const has = (t: TrucoAction['type']) => legal.some((a) => a.type === t);
  const canFaceDown = legal.some((a) => a.type === 'play' && a.faceDown);
  const nameOf = (id: string) => (id === you ? 'Você' : (v.players.find((p) => p.id === id)?.name ?? id));
  const myTeam = v.myTeam ?? 0;
  const teamLabel = (t: number) => (v.players.length === 4 ? (t === myTeam ? 'Nós' : 'Eles') : t === myTeam ? 'Você' : (v.players.find((p) => p.team === t)?.name ?? ''));

  // ordem na mesa a partir de mim
  const myIdx = Math.max(0, v.players.findIndex((p) => p.id === you));
  const seats = v.players.map((_, i) => v.players[(myIdx + i) % v.players.length]);

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

      <div className="felt truco-felt">
        <div className="vira">
          <span className="small">Vira</span>
          <PlayingCard card={v.vira} small />
          <span className="small">
            Manilha: <strong>{v.manilha}</strong>
          </span>
        </div>

        <div className={`truco-seats n${v.players.length}`}>
          {seats.map((p, i) => {
            const play = v.current.find((c) => c.playerId === p.id);
            return (
              <div key={p.id} className={`truco-seat pos${i} ${v.turn === p.id ? 'turn' : ''}`}>
                <div className="seat-name">
                  {nameOf(p.id)}
                  {p.id === v.dealer && <span title="Deu as cartas"> · deu</span>}
                  {p.id !== you && <span className="small"> · {p.cards} {p.cards === 1 ? 'carta' : 'cartas'}</span>}
                </div>
                <div className="seat-card">{play ? <PlayingCard card={play.card} back={play.faceDown} manilha={v.manilha} /> : <div className="pcard placeholder" />}</div>
              </div>
            );
          })}
        </div>

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
        {v.lastHand && v.lastHand.number === v.handNumber - 1 && v.tricks.length === 0 && v.current.length === 0 && <div className="small truco-last">{v.lastHand.text}</div>}
      </div>

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

      <details className="card">
        <summary>Histórico</summary>
        <div className="log">
          {[...v.log].reverse().map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      </details>
    </div>
  );
}
