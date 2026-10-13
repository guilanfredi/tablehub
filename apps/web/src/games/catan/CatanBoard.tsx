import { useMemo, useState } from 'react';
import { catanGraph, RESOURCE_LABEL, RESOURCES, type Resource } from '@tablehub/games/catan/board';
import { COSTS, DEV_LABEL, type CatanAction, type CatanView, type DevType, type Resources } from '@tablehub/games/catan/engine';
import { SeatAvatar } from '../../components/avatars/SeatAvatar';
import { PanZoom } from '../../components/board/PanZoom';
import { useFreshKeys } from '../../components/table/anim';
import type { BoardProps } from '../registry';
import { BOARD_ART, CityShape, ResourceGlyph, RESOURCE_COLOR, RobberShape, SettlementShape, TERRAIN_FILL, TerrainGlyph } from './art';
import './catan.css';

const S = 60; // tamanho do hexágono em unidades do SVG
const PIPS: Record<number, number> = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };
type Mode = 'road' | 'settlement' | 'city' | null;
type Partial5 = Partial<Resources>;

function emptyRes(): Resources {
  return { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 };
}
const sum = (r: Partial5) => RESOURCES.reduce((a, k) => a + (r[k] ?? 0), 0);

function ResIcon({ r, size = 22 }: { r: Resource; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-11 -11 22 22" aria-hidden>
      <circle r={11} fill={RESOURCE_COLOR[r]} opacity={0.25} />
      <ResourceGlyph r={r} />
    </svg>
  );
}

function Cost({ cost }: { cost: Partial5 }) {
  return (
    <span className="cost">
      {RESOURCES.filter((r) => cost[r]).map((r) => (
        <span key={r} className="cost-item">
          {cost[r]! > 1 && cost[r]}
          <ResIcon r={r} size={16} />
        </span>
      ))}
    </span>
  );
}

function Stepper({ value, onChange, max }: { value: number; onChange(n: number): void; max?: number }) {
  return (
    <span className="stepper">
      <button className="btn btn-sm" disabled={value <= 0} onClick={() => onChange(value - 1)} aria-label="Menos">
        −
      </button>
      <span className="stepper-val">{value}</span>
      <button className="btn btn-sm" disabled={max !== undefined && value >= max} onClick={() => onChange(value + 1)} aria-label="Mais">
        +
      </button>
    </span>
  );
}

export default function CatanBoard({ game, room, you, act }: BoardProps) {
  const v = game.view as CatanView;
  const legal = game.legal as CatanAction[];
  const g = catanGraph();
  const [mode, setMode] = useState<Mode>(null);
  const [panel, setPanel] = useState<'bank' | 'players' | null>(null);
  const colorOf = (pid: string) => v.players.find((p) => p.id === pid)?.color ?? BOARD_ART.unknownPlayer;
  const nameOf = (pid: string) => (pid === you ? 'Você' : (v.players.find((p) => p.id === pid)?.name ?? pid));
  const myTurn = v.current === you;
  // peças recém-construídas "caem" no lugar
  const fresh = useFreshKeys([...Object.keys(v.roads), ...Object.entries(v.buildings).map(([vid, b]) => `${vid}:${b.kind}`)]);

  const legalOf = <T extends CatanAction['type']>(t: T) => legal.filter((a): a is Extract<CatanAction, { type: T }> => a.type === t);

  // alvos clicáveis no tabuleiro conforme a fase/modo
  const targets = useMemo(() => {
    const vertices = new Map<string, CatanAction>();
    const edges = new Map<string, CatanAction>();
    const hexes = new Map<string, CatanAction>();
    for (const a of legal) {
      if (a.type === 'placeSettlement') vertices.set(a.vertex, a);
      if (a.type === 'placeRoad') edges.set(a.edge, a);
      if (a.type === 'moveRobber') hexes.set(a.hex, a);
      if (a.type === 'buildRoad' && (mode === 'road' || v.phase === 'roadBuilding')) edges.set(a.edge, a);
      if (a.type === 'buildSettlement' && mode === 'settlement') vertices.set(a.vertex, a);
      if (a.type === 'buildCity' && mode === 'city') vertices.set(a.vertex, a);
    }
    return { vertices, edges, hexes };
  }, [legal, mode, v.phase]);

  function doAct(a: CatanAction) {
    act(a);
    setMode(null);
  }

  const vb = { x: g.bounds.minX * S - 50, y: g.bounds.minY * S - 50, w: (g.bounds.maxX - g.bounds.minX) * S + 100, h: (g.bounds.maxY - g.bounds.minY) * S + 100 };
  const hexById = new Map(v.board.hexes.map((h) => [h.id, h]));
  const me = v.players.find((p) => p.id === you);

  const phaseHint = (() => {
    if (!myTurn) return null;
    if (v.phase === 'setup') return v.setupStep === 'settlement' ? 'Toque em um cruzamento para colocar sua aldeia.' : 'Toque em um lado ligado à aldeia para colocar a estrada.';
    if (v.phase === 'robber') return 'Toque em um terreno para mover o ladrão.';
    if (v.phase === 'roadBuilding') return `Coloque ${v.freeRoads} estrada(s) grátis.`;
    if (mode === 'road') return 'Toque em um lado destacado para construir a estrada.';
    if (mode === 'settlement') return 'Toque em um cruzamento destacado para construir a aldeia.';
    if (mode === 'city') return 'Toque em uma aldeia sua para transformá-la em cidade.';
    return null;
  })();

  return (
    <div className="catan">
      <div className="catan-players">
        {v.players.map((p) => (
          <div key={p.id} className={`catan-player ${p.id === v.current ? 'active' : ''}`} style={{ borderColor: p.color }}>
            <span className="swatch" style={{ background: p.color }} />
            <SeatAvatar game={game} room={room} id={p.id} size={26} />
            <strong className="pname">{nameOf(p.id)}</strong>
            <span className="vp" title="Pontos de vitória">
              ★ {p.id === you && v.myVp !== null ? v.myVp : p.publicVp}
            </span>
            <span className="small muted pstats">
              {p.resourceCount} recursos · {p.devCount} cartas · {p.knights} cav. · estrada {p.roadLength}
            </span>
            {v.longestRoad?.player === p.id && <span className="badge badge-ok">Maior estrada</span>}
            {v.largestArmy?.player === p.id && <span className="badge badge-ok">Maior exército</span>}
          </div>
        ))}
      </div>

      <div className="catan-main">
        <div className="catan-board felt">
          <div className="catan-board-top">
            {v.dice && (
              <span className="dice" aria-label={`Dados: ${v.dice[0]} e ${v.dice[1]}`}>
                🎲 {v.dice[0]} + {v.dice[1]} = <strong>{v.dice[0] + v.dice[1]}</strong>
              </span>
            )}
            <span className="small">Meta: {v.vpToWin} ★</span>
          </div>
          {phaseHint && <div className="catan-hint">{phaseHint}</div>}
          <PanZoom viewBox={vb} ariaLabel="Tabuleiro do Catan">
            {/* terrenos */}
            {g.hexOrder.map((id) => {
              const cell = g.hexes[id];
              const h = hexById.get(id)!;
              const pts = cell.vertices.map((vid) => `${g.vertices[vid].x * S},${g.vertices[vid].y * S}`).join(' ');
              const target = targets.hexes.get(id);
              return (
                <g key={id} className={target ? 'hit hit-hex' : ''} onClick={target ? () => doAct(target) : undefined}>
                  <polygon points={pts} fill={TERRAIN_FILL[h.terrain]} stroke={BOARD_ART.hexStroke} strokeWidth={3} />
                  <g transform={`translate(${cell.x * S} ${cell.y * S - 22}) scale(1.3)`} opacity={0.9}>
                    <TerrainGlyph t={h.terrain} />
                  </g>
                  {h.number !== null && (
                    <g transform={`translate(${cell.x * S} ${cell.y * S + 14})`}>
                      <circle r={15} fill={BOARD_ART.token} stroke={BOARD_ART.tokenStroke} strokeWidth={1.2} />
                      <text textAnchor="middle" dy={4} className={`num ${h.number === 6 || h.number === 8 ? 'red' : ''}`}>
                        {h.number}
                      </text>
                      <g transform="translate(0 9)">
                        {Array.from({ length: PIPS[h.number] }, (_, i) => (
                          <circle key={i} cx={(i - (PIPS[h.number!] - 1) / 2) * 3.4} r={1.2} fill={h.number === 6 || h.number === 8 ? BOARD_ART.hotPip : BOARD_ART.pip} />
                        ))}
                      </g>
                    </g>
                  )}
                  {target && <polygon points={pts} className="hex-target" />}
                </g>
              );
            })}

            {/* portos */}
            {v.board.ports.map((port) => {
              const e = g.edges[port.edge];
              const [a, b] = e.vertices.map((vid) => g.vertices[vid]);
              const hex = g.hexes[e.hexes[0]];
              const mx = ((a.x + b.x) / 2) * S;
              const my = ((a.y + b.y) / 2) * S;
              const dx = mx - hex.x * S;
              const dy = my - hex.y * S;
              const len = Math.hypot(dx, dy);
              const px = mx + (dx / len) * 26;
              const py = my + (dy / len) * 26;
              return (
                <g key={port.edge}>
                  <line x1={a.x * S} y1={a.y * S} x2={px} y2={py} stroke={BOARD_ART.portLine} strokeWidth={3} />
                  <line x1={b.x * S} y1={b.y * S} x2={px} y2={py} stroke={BOARD_ART.portLine} strokeWidth={3} />
                  <circle cx={px} cy={py} r={14} fill={BOARD_ART.token} stroke={BOARD_ART.tokenStroke} strokeWidth={1.2} />
                  {port.type === 'any' ? (
                    <text x={px} y={py + 4} textAnchor="middle" className="port-label">
                      3:1
                    </text>
                  ) : (
                    <g transform={`translate(${px} ${py - 2}) scale(0.7)`}>
                      <ResourceGlyph r={port.type} />
                      <text y={17} textAnchor="middle" className="port-label small-label">
                        2:1
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* estradas */}
            {Object.entries(v.roads).map(([eid, owner]) => {
              const [a, b] = g.edges[eid].vertices.map((vid) => g.vertices[vid]);
              return (
                <g key={eid} className={fresh.has(eid) ? 'catan-drop' : undefined}>
                  <line x1={a.x * S} y1={a.y * S} x2={b.x * S} y2={b.y * S} stroke={BOARD_ART.roadOutline} strokeWidth={10} strokeLinecap="round" />
                  <line x1={a.x * S} y1={a.y * S} x2={b.x * S} y2={b.y * S} stroke={colorOf(owner)} strokeWidth={6.5} strokeLinecap="round" />
                </g>
              );
            })}

            {/* lados clicáveis */}
            {[...targets.edges.entries()].map(([eid, a]) => {
              const [p, q] = g.edges[eid].vertices.map((vid) => g.vertices[vid]);
              return (
                <g key={eid} className="hit" onClick={() => doAct(a)}>
                  <line x1={p.x * S} y1={p.y * S} x2={q.x * S} y2={q.y * S} className="edge-target" />
                  <line x1={p.x * S} y1={p.y * S} x2={q.x * S} y2={q.y * S} stroke="transparent" strokeWidth={22} />
                </g>
              );
            })}

            {/* construções */}
            {Object.entries(v.buildings).map(([vid, b]) => {
              const p = g.vertices[vid];
              return (
                <g key={vid} transform={`translate(${p.x * S} ${p.y * S})`}>
                  <g className={fresh.has(`${vid}:${b.kind}`) ? 'catan-drop' : undefined}>
                    {b.kind === 'city' ? <CityShape color={colorOf(b.owner)} /> : <SettlementShape color={colorOf(b.owner)} />}
                  </g>
                </g>
              );
            })}

            {/* cruzamentos clicáveis */}
            {[...targets.vertices.entries()].map(([vid, a]) => {
              const p = g.vertices[vid];
              return (
                <g key={vid} className="hit" onClick={() => doAct(a)}>
                  <circle cx={p.x * S} cy={p.y * S} r={9} className="vertex-target" />
                  <circle cx={p.x * S} cy={p.y * S} r={18} fill="transparent" />
                </g>
              );
            })}

            {/* ladrão */}
            <g transform={`translate(${g.hexes[v.robber].x * S + 22} ${g.hexes[v.robber].y * S - 4})`} pointerEvents="none">
              <RobberShape />
            </g>
          </PanZoom>
        </div>

        <div className="catan-side stack">
          {v.myHand && (
            <div className="card">
              <div className="row" style={{ marginBottom: 6 }}>
                <strong className="grow">Seus recursos</strong>
                <span className="small muted">{sum(v.myHand)} cartas</span>
              </div>
              <div className="hand">
                {RESOURCES.map((r) => (
                  <div key={r} className={`res ${v.myHand![r] ? '' : 'zero'}`} title={RESOURCE_LABEL[r]}>
                    <ResIcon r={r} size={28} />
                    <span className="res-n">{v.myHand![r]}</span>
                    <span className="res-name">{RESOURCE_LABEL[r]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <TurnControls v={v} legalOf={legalOf} mode={mode} setMode={setMode} act={doAct} myTurn={myTurn} panel={panel} setPanel={setPanel} you={you} nameOf={nameOf} />

          {v.myDev.length > 0 && <DevCards v={v} legalOf={legalOf} act={doAct} />}

          {me && (
            <div className="card small muted">
              Peças restantes: {me.pieces.road} estradas · {me.pieces.settlement} aldeias · {me.pieces.city} cidades · {v.devDeckCount} cartas no baralho
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ControlsProps {
  v: CatanView;
  legalOf: <T extends CatanAction['type']>(t: T) => Extract<CatanAction, { type: T }>[];
  mode: Mode;
  setMode(m: Mode): void;
  act(a: CatanAction): void;
  myTurn: boolean;
  panel: 'bank' | 'players' | null;
  setPanel(p: 'bank' | 'players' | null): void;
  you: string;
  nameOf(pid: string): string;
}

function TurnControls({ v, legalOf, mode, setMode, act, myTurn, panel, setPanel, you, nameOf }: ControlsProps) {
  // descarte (pode ser fora da vez)
  if (v.phase === 'discard' && v.pendingDiscards[you]) return <DiscardPanel need={v.pendingDiscards[you]} hand={v.myHand!} act={act} />;
  if (v.phase === 'discard') return <div className="card muted">Aguardando descartes: {Object.keys(v.pendingDiscards).map(nameOf).join(', ')}</div>;

  // oferta de troca aberta
  if (v.trade) return <TradeOpen v={v} you={you} legalOf={legalOf} act={act} nameOf={nameOf} />;

  if (!myTurn) return <div className="card muted">Vez de {nameOf(v.current)}.</div>;

  if (v.phase === 'setup') return <div className="card">Preparação: coloque {v.setupStep === 'settlement' ? 'uma aldeia' : 'uma estrada'} no tabuleiro.</div>;

  if (v.phase === 'roll') {
    return (
      <div className="card stack">
        <button className="btn btn-primary btn-block" onClick={() => act({ type: 'roll' })}>
          🎲 Rolar dados
        </button>
        {legalOf('playKnight').length > 0 && (
          <button className="btn btn-block" onClick={() => act({ type: 'playKnight' })}>
            Jogar Cavaleiro antes de rolar
          </button>
        )}
      </div>
    );
  }

  if (v.phase === 'robber') return <div className="card">Mova o ladrão para outro terreno.</div>;
  if (v.phase === 'steal') {
    return (
      <div className="card stack">
        <strong>De quem você quer roubar?</strong>
        <div className="row">
          {legalOf('steal').map((a) => (
            <button key={a.from} className="btn grow" onClick={() => act(a)}>
              {nameOf(a.from)}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (v.phase === 'roadBuilding') return <div className="card">Construção de estradas: coloque {v.freeRoads} estrada(s) grátis.</div>;

  const can = { road: legalOf('buildRoad').length > 0, settlement: legalOf('buildSettlement').length > 0, city: legalOf('buildCity').length > 0, dev: legalOf('buyDev').length > 0 };
  const toggle = (m: Mode) => setMode(mode === m ? null : m);

  return (
    <div className="card stack">
      <div className="build-grid">
        <button className={`btn ${mode === 'road' ? 'btn-primary' : ''}`} disabled={!can.road} onClick={() => toggle('road')}>
          Estrada <Cost cost={COSTS.road} />
        </button>
        <button className={`btn ${mode === 'settlement' ? 'btn-primary' : ''}`} disabled={!can.settlement} onClick={() => toggle('settlement')}>
          Aldeia <Cost cost={COSTS.settlement} />
        </button>
        <button className={`btn ${mode === 'city' ? 'btn-primary' : ''}`} disabled={!can.city} onClick={() => toggle('city')}>
          Cidade <Cost cost={COSTS.city} />
        </button>
        <button className="btn" disabled={!can.dev} onClick={() => act({ type: 'buyDev' })}>
          Carta <Cost cost={COSTS.dev} />
        </button>
      </div>
      <div className="row">
        <button className={`btn grow ${panel === 'bank' ? 'btn-primary' : ''}`} onClick={() => setPanel(panel === 'bank' ? null : 'bank')}>
          Trocar com banco
        </button>
        <button className={`btn grow ${panel === 'players' ? 'btn-primary' : ''}`} onClick={() => setPanel(panel === 'players' ? null : 'players')}>
          Trocar com jogadores
        </button>
      </div>
      {panel === 'bank' && <BankTrade v={v} act={act} />}
      {panel === 'players' && <PlayerTrade v={v} act={act} />}
      <button className="btn btn-warn btn-block" onClick={() => act({ type: 'endTurn' })}>
        Encerrar turno
      </button>
    </div>
  );
}

function BankTrade({ v, act }: { v: CatanView; act(a: CatanAction): void }) {
  const rates = v.myRates!;
  const [give, setGive] = useState<Resource | null>(null);
  const [get, setGet] = useState<Resource | null>(null);
  const ok = give && get && give !== get && v.myHand![give] >= rates[give] && v.bank[get] > 0;
  return (
    <div className="trade-box stack">
      <div className="small muted">Dar (taxa):</div>
      <div className="row">
        {RESOURCES.map((r) => (
          <button key={r} className={`chip ${give === r ? 'on' : ''}`} disabled={v.myHand![r] < rates[r]} onClick={() => setGive(r)}>
            <ResIcon r={r} size={18} /> {rates[r]}:1
          </button>
        ))}
      </div>
      <div className="small muted">Receber:</div>
      <div className="row">
        {RESOURCES.map((r) => (
          <button key={r} className={`chip ${get === r ? 'on' : ''}`} disabled={r === give || v.bank[r] === 0} onClick={() => setGet(r)}>
            <ResIcon r={r} size={18} /> {RESOURCE_LABEL[r]}
          </button>
        ))}
      </div>
      <button className="btn btn-primary" disabled={!ok} onClick={() => ok && act({ type: 'bankTrade', give: give!, get: get! })}>
        Trocar {give ? `${rates[give]} ${RESOURCE_LABEL[give]}` : ''} {get ? `por 1 ${RESOURCE_LABEL[get]}` : ''}
      </button>
    </div>
  );
}

function PlayerTrade({ v, act }: { v: CatanView; act(a: CatanAction): void }) {
  const [give, setGive] = useState<Resources>(emptyRes());
  const [get, setGet] = useState<Resources>(emptyRes());
  const valid = sum(give) > 0 && sum(get) > 0 && RESOURCES.every((r) => !(give[r] > 0 && get[r] > 0));
  const compact = (r: Resources): Partial5 => Object.fromEntries(RESOURCES.filter((k) => r[k] > 0).map((k) => [k, r[k]]));
  return (
    <div className="trade-box stack">
      <table className="trade-table">
        <thead>
          <tr>
            <th />
            <th>Ofereço</th>
            <th>Peço</th>
          </tr>
        </thead>
        <tbody>
          {RESOURCES.map((r) => (
            <tr key={r}>
              <td>
                <ResIcon r={r} size={20} /> <span className="small">{RESOURCE_LABEL[r]}</span>
              </td>
              <td>
                <Stepper value={give[r]} max={v.myHand![r]} onChange={(n) => setGive({ ...give, [r]: n })} />
              </td>
              <td>
                <Stepper value={get[r]} max={9} onChange={(n) => setGet({ ...get, [r]: n })} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn btn-primary" disabled={!valid} onClick={() => act({ type: 'proposeTrade', give: compact(give), get: compact(get) })}>
        Propor troca a todos
      </button>
    </div>
  );
}

function resText(r: Partial5) {
  return RESOURCES.filter((k) => r[k])
    .map((k) => `${r[k]} ${RESOURCE_LABEL[k]}`)
    .join(', ');
}

function TradeOpen({ v, you, legalOf, act, nameOf }: { v: CatanView; you: string; legalOf: ControlsProps['legalOf']; act(a: CatanAction): void; nameOf(p: string): string }) {
  const t = v.trade!;
  const mine = t.from === you;
  return (
    <div className="card stack trade-open">
      <strong>
        {nameOf(t.from)} oferece {resText(t.give)} por {resText(t.get)}
      </strong>
      {mine ? (
        <>
          {Object.entries(t.responses).map(([pid, r]) => (
            <div key={pid} className="row">
              <span className="grow">{nameOf(pid)}</span>
              {r === null && <span className="badge">pensando…</span>}
              {r === 'reject' && <span className="badge">recusou</span>}
              {r === 'accept' && (
                <button className="btn btn-primary btn-sm" onClick={() => act({ type: 'confirmTrade', with: pid })}>
                  Trocar com {nameOf(pid)}
                </button>
              )}
            </div>
          ))}
          <button className="btn btn-ghost" onClick={() => act({ type: 'cancelTrade' })}>
            Cancelar oferta
          </button>
        </>
      ) : t.responses[you] === null ? (
        <div className="row">
          <button className="btn btn-primary grow" disabled={!legalOf('respondTrade').some((a) => a.accept)} onClick={() => act({ type: 'respondTrade', accept: true })}>
            Aceitar
          </button>
          <button className="btn grow" onClick={() => act({ type: 'respondTrade', accept: false })}>
            Recusar
          </button>
        </div>
      ) : (
        <span className="muted">Você {t.responses[you] === 'accept' ? 'aceitou' : 'recusou'}. Aguardando {nameOf(t.from)}.</span>
      )}
    </div>
  );
}

function DiscardPanel({ need, hand, act }: { need: number; hand: Resources; act(a: CatanAction): void }) {
  const [sel, setSel] = useState<Resources>(emptyRes());
  const n = sum(sel);
  return (
    <div className="card stack trade-open">
      <strong>Saiu 7! Descarte {need} cartas</strong>
      {RESOURCES.map((r) => (
        <div key={r} className="row">
          <ResIcon r={r} size={22} />
          <span className="grow">
            {RESOURCE_LABEL[r]} <span className="muted small">(tem {hand[r]})</span>
          </span>
          <Stepper value={sel[r]} max={hand[r]} onChange={(x) => setSel({ ...sel, [r]: x })} />
        </div>
      ))}
      <button className="btn btn-primary" disabled={n !== need} onClick={() => act({ type: 'discard', resources: Object.fromEntries(RESOURCES.filter((r) => sel[r]).map((r) => [r, sel[r]])) })}>
        Descartar ({n}/{need})
      </button>
    </div>
  );
}

function DevCards({ v, legalOf, act }: { v: CatanView; legalOf: ControlsProps['legalOf']; act(a: CatanAction): void }) {
  const [choosing, setChoosing] = useState<DevType | null>(null);
  const [yop, setYop] = useState<Resource[]>([]);
  const counts = new Map<DevType, { total: number; playable: number }>();
  for (const d of v.myDev) {
    const c = counts.get(d.type) ?? { total: 0, playable: 0 };
    c.total++;
    if (d.playable) c.playable++;
    counts.set(d.type, c);
  }
  const canPlay: Record<DevType, boolean> = {
    knight: legalOf('playKnight').length > 0,
    roadBuilding: legalOf('playRoadBuilding').length > 0,
    yearOfPlenty: legalOf('playYearOfPlenty').length > 0,
    monopoly: legalOf('playMonopoly').length > 0,
    victoryPoint: false,
  };

  function play(t: DevType) {
    if (t === 'knight') act({ type: 'playKnight' });
    else if (t === 'roadBuilding') act({ type: 'playRoadBuilding' });
    else setChoosing(t);
  }

  return (
    <div className="card stack">
      <strong>Cartas de desenvolvimento</strong>
      {[...counts.entries()].map(([t, c]) => (
        <div key={t} className="row">
          <span className="grow">
            {DEV_LABEL[t]} {c.total > 1 && `×${c.total}`}
          </span>
          {t === 'victoryPoint' ? (
            <span className="badge badge-ok">+1 ★ (secreto)</span>
          ) : (
            <button className="btn btn-sm" disabled={!canPlay[t]} onClick={() => play(t)}>
              Jogar
            </button>
          )}
        </div>
      ))}
      {choosing === 'monopoly' && (
        <div className="trade-box stack">
          <span className="small">Monopólio: escolha o recurso que todos devem te entregar.</span>
          <div className="row">
            {RESOURCES.map((r) => (
              <button
                key={r}
                className="chip"
                onClick={() => {
                  act({ type: 'playMonopoly', resource: r });
                  setChoosing(null);
                }}
              >
                <ResIcon r={r} size={18} /> {RESOURCE_LABEL[r]}
              </button>
            ))}
          </div>
        </div>
      )}
      {choosing === 'yearOfPlenty' && (
        <div className="trade-box stack">
          <span className="small">Ano de fartura: escolha 2 recursos do banco ({yop.map((r) => RESOURCE_LABEL[r]).join(' + ') || 'nenhum'}).</span>
          <div className="row">
            {RESOURCES.map((r) => (
              <button key={r} className="chip" disabled={yop.length >= 2 || v.bank[r] - yop.filter((x) => x === r).length <= 0} onClick={() => setYop([...yop, r])}>
                <ResIcon r={r} size={18} /> {RESOURCE_LABEL[r]}
              </button>
            ))}
          </div>
          <div className="row">
            <button className="btn btn-ghost" onClick={() => setYop([])}>
              Limpar
            </button>
            <button
              className="btn btn-primary grow"
              disabled={yop.length !== 2}
              onClick={() => {
                act({ type: 'playYearOfPlenty', resources: [yop[0], yop[1]] });
                setYop([]);
                setChoosing(null);
              }}
            >
              Pegar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
