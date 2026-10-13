import { useEffect, useState } from 'react';
import { CARD_BY_ID, FACES, type Face, type KingOfTokyoAction, type KingOfTokyoView } from '@tablehub/games/king-of-tokyo/engine';
import { SeatAvatar } from '../../components/avatars/SeatAvatar';
import type { BoardProps } from '../registry';
import { FACE_NAMES, FaceIcon, MonsterPortrait } from './art';
import './king-of-tokyo.css';

const cardSrc = (id: string) => `/games/king-of-tokyo/cards/${id}.webp`;
const cardAlt = (id: string) => {
  const c = CARD_BY_ID[id];
  return c ? `${c.name} (${c.cost} energia, ${c.kind === 'keep' ? 'Constante' : 'Descarte'}): ${c.text}` : id;
};

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

export default function KingOfTokyoBoard({ game, room, you, act }: BoardProps) {
  const v = game.view as KingOfTokyoView;
  const legal = game.legal as KingOfTokyoAction[];
  const [keep, setKeep] = useState<number[]>([]);
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

  // dados guardados recomeçam a cada rolagem nova
  useEffect(() => setKeep(v.dice.map((d, i) => (d.kept ? i : -1)).filter((i) => i >= 0)), [v.rollsUsed, v.turn]);

  const canRoll = has('roll');
  const rolling = v.phase === 'roll' && myTurn && !v.pending;
  const toggleKeep = (i: number) => setKeep((k) => (k.includes(i) ? k.filter((x) => x !== i) : [...k, i]));

  const city = v.players.find((p) => v.monsters[p.id].alive && v.monsters[p.id].place === 'city');
  const bay = v.players.find((p) => v.monsters[p.id].alive && v.monsters[p.id].place === 'bay');

  const buyable = new Set(legal.filter((a): a is Extract<KingOfTokyoAction, { type: 'buy' }> => a.type === 'buy' && !a.from).map((a) => a.cardId));
  const tentacles = legal.filter((a): a is Extract<KingOfTokyoAction, { type: 'buy' }> => a.type === 'buy' && !!a.from);
  const metamorph = new Set(legal.filter((a): a is Extract<KingOfTokyoAction, { type: 'metamorph' }> => a.type === 'metamorph').map((a) => a.cardId));
  const mimicOptions = legal.filter((a): a is Extract<KingOfTokyoAction, { type: 'mimic' }> => a.type === 'mimic' && a.cardId !== null);
  const rayTargets = legal.filter((a): a is Extract<KingOfTokyoAction, { type: 'healRay' }> => a.type === 'healRay' && a.target !== null);

  return (
    <div className="stack kot">
      <div className="felt kot-tokyo">
        <div className="kot-place">
          <span className="small">Cidade de Tóquio</span>
          {city ? <MonsterPortrait monster={v.monsters[city.id].monster} size={52} /> : <div className="kot-empty">vazia</div>}
          <strong className="small">{city ? nameOf(city.id) : ''}</strong>
        </div>
        {v.bay && (
          <div className="kot-place">
            <span className="small">Baía de Tóquio</span>
            {bay ? <MonsterPortrait monster={v.monsters[bay.id].monster} size={52} /> : <div className="kot-empty">vazia</div>}
            <strong className="small">{bay ? nameOf(bay.id) : ''}</strong>
          </div>
        )}
      </div>

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
              className={`kot-die ${keep.includes(i) ? 'kept' : ''} ${d.green ? 'green' : ''}`}
              disabled={!rolling || v.rollsUsed === 0}
              onClick={() => toggleKeep(i)}
              aria-pressed={keep.includes(i)}
              aria-label={`Dado ${i + 1}: ${FACE_NAMES[d.face]}${keep.includes(i) ? ' (guardado)' : ''}`}
            >
              <FaceIcon face={d.face} size={26} />
            </button>
          ))}
        </div>
        {rolling && (
          <>
            {v.rollsUsed > 0 && canRoll && <span className="muted small">Toque nos dados para guardar.</span>}
            <div className="row">
              {canRoll && (
                <button className="btn btn-primary grow" onClick={() => send(v.rollsUsed === 0 ? { type: 'roll' } : { type: 'roll', keep })}>
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
      </div>

      {v.options.powerCards && (
        <div className="card stack">
          <div className="row kot-dice-head">
            <strong>Cartas de Poder</strong>
            <span className="muted small">
              baralho {v.deckCount} · descarte {v.discard.length}
            </span>
          </div>
          <div className="kot-market">
            {v.market.map((id, i) =>
              id ? (
                <div key={i} className="kot-market-slot">
                  <PowerCard id={id} onZoom={setZoom} />
                  {myTurn && v.phase === 'buy' && !v.pending && (
                    <button className="btn btn-primary btn-sm" disabled={!buyable.has(id)} onClick={() => send({ type: 'buy', cardId: id })}>
                      Comprar ({CARD_BY_ID[id].cost})
                    </button>
                  )}
                </div>
              ) : (
                <div key={i} className="kot-market-slot kot-empty">
                  vazio
                </div>
              ),
            )}
            {v.deckTop && (
              <div className="kot-market-slot">
                <PowerCard id={v.deckTop} onZoom={setZoom} extra="topo" />
                <button className="btn btn-primary btn-sm" disabled={!has('buyTop')} onClick={() => send({ type: 'buyTop' })}>
                  Comprar topo ({CARD_BY_ID[v.deckTop].cost})
                </button>
              </div>
            )}
          </div>
          {myTurn && v.phase === 'buy' && !v.pending && (
            <div className="row">
              <button className="btn" disabled={!has('sweep')} onClick={() => send({ type: 'sweep' })}>
                Limpar vitrine (2)
              </button>
              <button className="btn btn-primary grow" disabled={!has('endTurn')} onClick={() => send({ type: 'endTurn' })}>
                Encerrar turno
              </button>
            </div>
          )}
        </div>
      )}

      <div className="kot-monsters">
        {v.players.map((p) => {
          const m = v.monsters[p.id];
          return (
            <div key={p.id} className={`card kot-monster ${v.turn === p.id ? 'turn' : ''} ${m.alive ? '' : 'dead'}`}>
              <div className="row kot-monster-head">
                <MonsterPortrait monster={m.monster} dead={!m.alive} />
                <div className="grow">
                  <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                    <SeatAvatar game={game} room={room} id={p.id} size={24} />
                    <strong>{nameOf(p.id)}</strong>
                  </span>
                  <div className="muted small">
                    {m.monster}
                    {m.place === 'city' ? ' · Cidade' : m.place === 'bay' ? ' · Baía' : ''}
                    {!m.alive ? ' · eliminado' : ''}
                  </div>
                </div>
              </div>
              <div className="kot-stats">
                <span title="Vida" aria-label={`Vida ${m.hp} de ${m.maxHp}`}>
                  <FaceIcon face="heart" size={16} /> {m.hp}/{m.maxHp}
                </span>
                <span title="Pontos de vitória" aria-label={`${m.vp} PV`}>
                  ★ {m.vp}
                </span>
                <span title="Energia" aria-label={`${m.energy} energia`}>
                  <FaceIcon face="energy" size={16} /> {m.energy}
                </span>
                {m.poison > 0 && <span className="badge badge-warn">Envenenado ×{m.poison}</span>}
                {m.shrink > 0 && <span className="badge badge-warn">Encolhido ×{m.shrink}</span>}
                {m.shielded && <span className="badge badge-ok">Asas</span>}
              </div>
              {m.cards.length > 0 && (
                <div className="kot-owned">
                  {m.cards.map((c, i) => {
                    const extra = c.copy ? `cópia: ${CARD_BY_ID[c.copy]?.name}` : c.charges ? `${c.charges} carga(s)` : c.energy ? `${c.energy} energia` : undefined;
                    const tent = tentacles.find((a) => a.from === p.id && a.cardId === c.id);
                    return (
                      <div key={i} className="kot-owned-card">
                        <PowerCard id={c.id} onZoom={setZoom} small extra={extra} />
                        {tent && (
                          <button className="btn btn-sm" onClick={() => send(tent)}>
                            Tomar ({CARD_BY_ID[c.id].cost})
                          </button>
                        )}
                        {p.id === you && metamorph.has(c.id) && (
                          <button className="btn btn-sm" onClick={() => send({ type: 'metamorph', cardId: c.id })}>
                            Descartar (+{CARD_BY_ID[c.id].cost})
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="card kot-log">
        {v.log.slice(-8).map((l, i) => (
          <div key={i} className="small">
            {l}
          </div>
        ))}
      </div>

      {zoom && (
        <div className="kot-zoom" role="dialog" aria-label={CARD_BY_ID[zoom]?.name} onClick={() => setZoom(null)}>
          <img src={cardSrc(zoom)} alt={cardAlt(zoom)} />
          <p className="small">{cardAlt(zoom)}</p>
          <button className="btn">Fechar</button>
        </div>
      )}
    </div>
  );
}
