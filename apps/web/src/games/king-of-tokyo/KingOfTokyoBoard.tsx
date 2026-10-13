import { useEffect, useRef, useState } from 'react';
import { CARD_BY_ID, FACES, type Face, type KingOfTokyoAction, type KingOfTokyoView } from '@tablehub/games/king-of-tokyo/engine';
import { useFreshKeys } from '../../components/table/anim';
import { GameTableLayout } from '../../components/table/GameTableLayout';
import { arrangeSeats } from '../../components/table/seats';
import type { BoardProps } from '../registry';
import { CardBack, FACE_NAMES, FaceIcon, MonsterPortrait, TokyoBoard } from './art';
import './king-of-tokyo.css';

const cardSrc = (id: string) => `/games/king-of-tokyo/cards/${id}.webp`;
const cardAlt = (id: string) => {
  const c = CARD_BY_ID[id];
  return c ? `${c.name} (${c.cost} energia, ${c.kind === 'keep' ? 'Constante' : 'Descarte'}): ${c.text}` : id;
};
type OwnedCard = KingOfTokyoView['monsters'][string]['cards'][number];
const cardExtra = (c: OwnedCard) => (c.copy ? `cópia: ${CARD_BY_ID[c.copy]?.name}` : c.charges ? `${c.charges} carga(s)` : c.energy ? `${c.energy} energia` : undefined);

function PowerCard({ id, onZoom, small, extra }: { id: string; onZoom: (id: string) => void; small?: boolean; extra?: string }) {
  const c = CARD_BY_ID[id];
  return (
    <button type="button" className={`kot-card ${small ? 'small' : ''}`} onClick={() => onZoom(id)} title={cardAlt(id)}>
      <img src={cardSrc(id)} alt={cardAlt(id)} loading="lazy" />
      <span className="kot-card-caption">
        {c?.name ?? id}
        {extra ? ` · ${extra}` : ''}
      </span>
    </button>
  );
}

/** Carta em miniatura (mercado e Constantes no assento); no desktop o mercado amplia ao passar o mouse. */
function MiniCard({ id, onZoom, label }: { id: string; onZoom: (id: string) => void; label?: string }) {
  return (
    <button type="button" className="kot-mini" onClick={() => onZoom(id)} title={cardAlt(id)} aria-label={`${label ? `${label}: ` : ''}${cardAlt(id)}`}>
      <img src={cardSrc(id)} alt="" loading="lazy" />
    </button>
  );
}

/** "−2"/"+1" com coração flutuando sobre o monstro quando a vida muda. */
function HpFloat({ hp }: { hp: number }) {
  const prev = useRef(hp);
  const [floats, setFloats] = useState<{ id: number; delta: number }[]>([]);
  useEffect(() => {
    const delta = hp - prev.current;
    prev.current = hp;
    if (!delta) return;
    const id = Date.now() + Math.random();
    setFloats((f) => [...f, { id, delta }]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 900);
  }, [hp]);
  return (
    <>
      {floats.map((f) => (
        <span key={f.id} className={`kot-float ${f.delta < 0 ? 'dmg' : 'heal'}`} aria-hidden="true">
          {f.delta < 0 ? `−${-f.delta}` : `+${f.delta}`} <FaceIcon face="heart" size={16} />
        </span>
      ))}
    </>
  );
}

export default function KingOfTokyoBoard({ game, room, you, act }: BoardProps) {
  const v = game.view as KingOfTokyoView;
  const legal = game.legal as KingOfTokyoAction[];
  const [reroll, setReroll] = useState<number[]>([]);
  const [zoom, setZoom] = useState<string | null>(null);
  const [modDie, setModDie] = useState(0);
  const [modFace, setModFace] = useState<Face>('claw');
  const [battery, setBattery] = useState(0);
  const [rayAmount, setRayAmount] = useState(1);

  const has = (t: KingOfTokyoAction['type']) => legal.some((a) => a.type === t);
  const send = (a: KingOfTokyoAction) => act(a as KingOfTokyoAction & Record<string, unknown>);
  const me = v.monsters[you];
  const myTurn = v.turn === you;
  const pendingMine = v.pending?.players.includes(you) ?? false;
  const nameOf = (id: string) => (id === you ? 'Você' : (v.monsters[id]?.name ?? id));

  // a seleção de dados a rerrolar recomeça a cada rolagem nova
  useEffect(() => setReroll([]), [v.rollsUsed, v.turn]);

  // dados que acabaram de rolar chacoalham
  const justRolled = useFreshKeys(v.rollsUsed > 0 ? [`${v.turn}:${v.rollsUsed}`] : []).size > 0;

  const canRoll = has('roll');
  const rolling = v.phase === 'roll' && myTurn && !v.pending;
  const toggleReroll = (i: number) => setReroll((r) => (r.includes(i) ? r.filter((x) => x !== i) : [...r, i]));
  const keep = v.dice.map((_, i) => i).filter((i) => !reroll.includes(i));

  const city = v.players.find((p) => v.monsters[p.id].alive && v.monsters[p.id].place === 'city');
  const bay = v.players.find((p) => v.monsters[p.id].alive && v.monsters[p.id].place === 'bay');

  const buyable = new Set(legal.filter((a): a is Extract<KingOfTokyoAction, { type: 'buy' }> => a.type === 'buy' && !a.from).map((a) => a.cardId));
  const tentacles = legal.filter((a): a is Extract<KingOfTokyoAction, { type: 'buy' }> => a.type === 'buy' && !!a.from);
  const metamorph = new Set(legal.filter((a): a is Extract<KingOfTokyoAction, { type: 'metamorph' }> => a.type === 'metamorph').map((a) => a.cardId));
  const mimicOptions = legal.filter((a): a is Extract<KingOfTokyoAction, { type: 'mimic' }> => a.type === 'mimic' && a.cardId !== null);
  const rayTargets = legal.filter((a): a is Extract<KingOfTokyoAction, { type: 'healRay' }> => a.type === 'healRay' && a.target !== null);

  const buyPhase = myTurn && v.phase === 'buy' && !v.pending;
  const places = arrangeSeats(
    v.players.map((p) => p.id),
    you,
  );
  const occupant = (id?: string) => (id ? { monster: v.monsters[id].monster, name: nameOf(id) } : undefined);

  const counters = (id: string) => {
    const m = v.monsters[id];
    return (
      <>
        <HpFloat hp={m.hp} />
        <span className={`kot-seat-stats ${m.alive ? '' : 'dead'}`}>
          <MonsterPortrait monster={m.monster} dead={!m.alive} size={24} />
          <span title="Vida" aria-label={`Vida ${m.hp} de ${m.maxHp}`}>
            <FaceIcon face="heart" size={14} /> <strong>{m.hp}</strong>
          </span>
          <span title="Pontos de vitória" aria-label={`${m.vp} PV`}>
            ★ <strong>{m.vp}</strong>
          </span>
          <span title="Energia" aria-label={`${m.energy} energia`}>
            <FaceIcon face="energy" size={14} /> <strong>{m.energy}</strong>
          </span>
        </span>
        {!m.alive && <span>eliminado</span>}
        {m.poison > 0 && <span className="badge badge-warn">Veneno ×{m.poison}</span>}
        {m.shrink > 0 && <span className="badge badge-warn">Encolhido ×{m.shrink}</span>}
        {m.shielded && <span className="badge badge-ok">Asas</span>}
        {m.cards.length > 0 && (
          <span className="kot-keeps">
            {m.cards.map((c, i) => (
              <MiniCard key={i} id={c.id} onZoom={setZoom} label={cardExtra(c)} />
            ))}
          </span>
        )}
      </>
    );
  };

  const market = v.options.powerCards && (
    <div className="kot-market" aria-label="Mercado de cartas">
      {v.market.map((id, i) =>
        id ? (
          <MiniCard key={i} id={id} onZoom={setZoom} />
        ) : (
          <div key={i} className="kot-mini kot-empty">
            vazio
          </div>
        ),
      )}
      {v.deckTop && <MiniCard id={v.deckTop} onZoom={setZoom} label="Topo do baralho" />}
      <button type="button" className="kot-deck" disabled={!has('sweep')} onClick={() => send({ type: 'sweep' })} title={`Baralho: ${v.deckCount} · descarte: ${v.discard.length}`}>
        <CardBack />
        <span className="kot-deck-label">
          Descartar e repor (2<FaceIcon face="energy" size={12} />)
        </span>
      </button>
    </div>
  );

  // ações da carta ampliada: comprar do mercado/topo, tomar com Tentáculos, descartar com Metamorfose
  const zoomActions = zoom
    ? [
        buyPhase && v.market.includes(zoom) && (
          <button key="buy" className="btn btn-primary" disabled={!buyable.has(zoom)} onClick={() => send({ type: 'buy', cardId: zoom })}>
            Comprar ({CARD_BY_ID[zoom].cost} energia)
          </button>
        ),
        zoom === v.deckTop && (
          <button key="top" className="btn btn-primary" disabled={!has('buyTop')} onClick={() => send({ type: 'buyTop' })}>
            Comprar topo ({CARD_BY_ID[zoom].cost} energia)
          </button>
        ),
        ...tentacles
          .filter((a) => a.cardId === zoom)
          .map((a) => (
            <button key={`t-${a.from}`} className="btn" onClick={() => send(a)}>
              Tomar de {nameOf(a.from!)} ({CARD_BY_ID[zoom].cost} energia)
            </button>
          )),
        metamorph.has(zoom) && me?.cards.some((c) => c.id === zoom) && (
          <button key="meta" className="btn" onClick={() => send({ type: 'metamorph', cardId: zoom })}>
            Descartar (+{CARD_BY_ID[zoom].cost} energia)
          </button>
        ),
      ].filter(Boolean)
    : [];
  const zoomOwner = zoom ? v.players.find((p) => v.monsters[p.id].cards.some((c) => c.id === zoom)) : undefined;
  const zoomExtra = zoomOwner ? cardExtra(v.monsters[zoomOwner.id].cards.find((c) => c.id === zoom)!) : undefined;

  return (
    <div className="stack kot">
      <GameTableLayout game={game} room={room} you={you} places={places} counters={counters} className="kot-table" cornerRight={market}>
        <TokyoBoard city={occupant(city?.id)} bay={occupant(bay?.id)} showBay={v.bay} />
      </GameTableLayout>

      {v.pending && pendingMine && (
        <div className="card stack kot-window" role="dialog" aria-label="Decisão">
          {v.pending.type === 'yield' && (
            <>
              <strong>Você foi atacado em Tóquio. Ceder o lugar?</strong>
              <div className="row">
                <button className="btn btn-warn grow" onClick={() => send({ type: 'yield', leave: true })}>
                  Ceder Tóquio
                </button>
                <button className="btn btn-primary grow" onClick={() => send({ type: 'yield', leave: false })}>
                  Ficar
                </button>
              </div>
            </>
          )}
          {v.pending.type === 'wings' && (
            <>
              <strong>Você vai sofrer dano. Usar as Asas (2 energia) e não sofrer dano até o fim do turno?</strong>
              <div className="row">
                <button className="btn btn-primary grow" onClick={() => send({ type: 'wings', use: true })}>
                  Usar Asas
                </button>
                <button className="btn grow" onClick={() => send({ type: 'wings', use: false })}>
                  Não usar
                </button>
              </div>
            </>
          )}
          {v.pending.type === 'opportunist' && v.pending.slot !== undefined && v.market[v.pending.slot] && (
            <>
              <strong>Oportunista: comprar a carta revelada?</strong>
              <PowerCard id={v.market[v.pending.slot]!} onZoom={setZoom} />
              <div className="row">
                <button className="btn btn-primary grow" onClick={() => send({ type: 'opportunist', buy: true })}>
                  Comprar
                </button>
                <button className="btn grow" onClick={() => send({ type: 'opportunist', buy: false })}>
                  Deixar
                </button>
              </div>
            </>
          )}
          {v.pending.type === 'probe' && (
            <>
              <strong>Sonda Psíquica: rerrolar um dado de {nameOf(v.turn)}?</strong>
              <div className="kot-dice">
                {v.dice.map((d, i) => (
                  <button key={i} className="kot-die" onClick={() => send({ type: 'probe', die: i })} aria-label={`Rerrolar dado ${i + 1} (${FACE_NAMES[d.face]})`}>
                    <FaceIcon face={d.face} />
                  </button>
                ))}
              </div>
              <button className="btn" onClick={() => send({ type: 'probe', die: null })}>
                Não usar
              </button>
            </>
          )}
          {v.pending.type === 'healRay' && (
            <>
              <strong>Raio de Cura: {v.heartsLeft} coração(ões) para curar outros monstros (pagam 2 energia por Vida).</strong>
              <label className="row small">
                Corações
                <input type="number" min={1} max={v.heartsLeft} value={rayAmount} onChange={(e) => setRayAmount(Number(e.target.value))} style={{ width: 64 }} />
              </label>
              <div className="row">
                {rayTargets.map((a) => (
                  <button key={a.target} className="btn btn-sm" onClick={() => send({ type: 'healRay', target: a.target, amount: Math.min(rayAmount, v.heartsLeft) })}>
                    Curar {nameOf(a.target!)}
                  </button>
                ))}
              </div>
              <button className="btn" onClick={() => send({ type: 'healRay', target: null })}>
                Usar o resto em mim
              </button>
            </>
          )}
          {v.pending.type === 'battery' && (
            <>
              <strong>Bateria de Monstros: quanta energia colocar? O banco põe o mesmo valor.</strong>
              <label className="row small">
                Energia
                <input type="number" min={0} max={me.energy} value={battery} onChange={(e) => setBattery(Number(e.target.value))} style={{ width: 64 }} />
              </label>
              <button className="btn btn-primary" onClick={() => send({ type: 'battery', amount: Math.max(0, Math.min(battery, me.energy)) })}>
                Confirmar
              </button>
            </>
          )}
          {v.pending.type === 'mimic' && (
            <>
              <strong>Imitador: escolha a carta a copiar.</strong>
              <div className="row">
                {mimicOptions.map((a) => (
                  <button key={a.cardId} className="btn btn-sm" onClick={() => send(a)}>
                    {CARD_BY_ID[a.cardId!]?.name}
                  </button>
                ))}
              </div>
              <button className="btn" onClick={() => send({ type: 'mimic', cardId: null })}>
                Nenhuma por enquanto
              </button>
            </>
          )}
          {has('quickHeal') && (
            <button className="btn btn-sm" onClick={() => send({ type: 'quickHeal' })}>
              Cura Rápida (2 energia: +1 Vida)
            </button>
          )}
        </div>
      )}

      <div className="card stack">
        <div className="row kot-dice-head">
          <strong>{myTurn ? 'Seus dados' : `Dados de ${nameOf(v.turn)}`}</strong>
          <span className="muted small">
            rolagem {v.rollsUsed}/{v.rollsMax}
          </span>
        </div>
        <div className="kot-dice">
          {v.dice.length === 0 && <span className="muted small">{rolling ? 'Role os dados para começar.' : 'Aguardando rolagem.'}</span>}
          {v.dice.map((d, i) => (
            <button
              key={i}
              type="button"
              className={`kot-die ${reroll.includes(i) ? 'reroll' : ''} ${d.green ? 'green' : ''} ${justRolled && !d.kept ? 'shake' : ''}`}
              disabled={!rolling || v.rollsUsed === 0}
              onClick={() => toggleReroll(i)}
              aria-pressed={reroll.includes(i)}
              aria-label={`Dado ${i + 1}: ${FACE_NAMES[d.face]}${reroll.includes(i) ? ' (para rerrolar)' : ''}`}
            >
              <FaceIcon face={d.face} size={26} />
            </button>
          ))}
        </div>
        {rolling && (
          <>
            {v.rollsUsed > 0 && canRoll && <span className="muted small">Toque nos dados que quer rerrolar.</span>}
            <div className="row">
              {canRoll && (
                <button className="btn btn-primary grow" disabled={v.rollsUsed > 0 && reroll.length === 0} onClick={() => send(v.rollsUsed === 0 ? { type: 'roll' } : { type: 'roll', keep })}>
                  {v.rollsUsed === 0 ? 'Rolar dados' : 'Rolar de novo'}
                </button>
              )}
              {has('resolve') && (
                <button className="btn grow" onClick={() => send({ type: 'resolve' })}>
                  Parar e resolver
                </button>
              )}
            </div>
            <div className="row">
              {has('stalk') && (
                <button className="btn btn-sm" onClick={() => send({ type: 'stalk' })}>
                  Rerrolar os 3 (Espreitador)
                </button>
              )}
              {has('smoke') && (
                <button className="btn btn-sm" onClick={() => send({ type: 'smoke' })}>
                  +1 rolagem (Nuvem de Fumaça)
                </button>
              )}
              {has('telepath') && (
                <button className="btn btn-sm" onClick={() => send({ type: 'telepath' })}>
                  +1 rolagem (Telepata, 1 energia)
                </button>
              )}
            </div>
            {(has('herd') || has('stretch') || has('twist')) && (
              <div className="row small">
                <label>
                  Dado{' '}
                  <select value={modDie} onChange={(e) => setModDie(Number(e.target.value))}>
                    {v.dice.map((d, i) => (
                      <option key={i} value={i}>
                        {i + 1} ({FACE_NAMES[d.face]})
                      </option>
                    ))}
                  </select>
                </label>
                {(has('stretch') || has('twist')) && (
                  <label>
                    para{' '}
                    <select value={modFace} onChange={(e) => setModFace(e.target.value as Face)}>
                      {FACES.map((f) => (
                        <option key={f} value={f}>
                          {FACE_NAMES[f]}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {has('herd') && (
                  <button className="btn btn-sm" onClick={() => send({ type: 'herd', die: modDie })}>
                    Virar 1 (Chefe do Rebanho)
                  </button>
                )}
                {has('stretch') && (
                  <button className="btn btn-sm" onClick={() => send({ type: 'stretch', die: modDie, face: modFace })}>
                    Alongado (2 energia)
                  </button>
                )}
                {has('twist') && (
                  <button className="btn btn-sm" onClick={() => send({ type: 'twist', die: modDie, face: modFace })}>
                    Reviravolta
                  </button>
                )}
              </div>
            )}
            {mimicOptions.length > 0 && v.rollsUsed === 0 && (
              <div className="row small">
                Mudar o Imitador (1 energia):
                {mimicOptions.map((a) => (
                  <button key={a.cardId} className="btn btn-sm" onClick={() => send(a)}>
                    {CARD_BY_ID[a.cardId!]?.name}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        {myTurn && !v.pending && has('quickHeal') && (
          <button className="btn btn-sm" onClick={() => send({ type: 'quickHeal' })}>
            Cura Rápida (2 energia: +1 Vida)
          </button>
        )}
        {buyPhase && (
          <div className="row">
            {v.options.powerCards && <span className="muted small grow">Toque numa carta do mercado para comprar.</span>}
            <button className="btn btn-primary grow" disabled={!has('endTurn')} onClick={() => send({ type: 'endTurn' })}>
              Encerrar turno
            </button>
          </div>
        )}
      </div>

      {zoom && (
        <div className="kot-zoom" role="dialog" aria-label={CARD_BY_ID[zoom]?.name} onClick={() => setZoom(null)}>
          <img src={cardSrc(zoom)} alt={cardAlt(zoom)} />
          <p className="small">
            {cardAlt(zoom)}
            {zoomExtra ? ` (${zoomExtra})` : ''}
          </p>
          <div className="row kot-zoom-actions">
            {zoomActions}
            <button className="btn">Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}
