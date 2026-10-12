import { useEffect, useRef, useState } from 'react';
import { checkPlayerCount, defaultOptions, type GameDefinition } from '@tablehub/game-sdk';
import { GAME_LIST, GAMES } from '@tablehub/games';
import type { RoomView } from '@tablehub/shared';
import { setAvatar } from '../lib/session';
import { useRoom } from '../store/room';
import { Avatar, AvatarPicker } from './avatars/Avatar';
import { OptionsForm } from './OptionsForm';

/** "2–4 jogadores" ou "2 ou 4 jogadores", conforme as quantidades que o jogo aceita. */
function playerCountLabel(def: GameDefinition): string {
  const ok: number[] = [];
  for (let n = def.minPlayers; n <= def.maxPlayers; n++) if (!def.validateConfig(defaultOptions(def.optionsSchema), n)) ok.push(n);
  const contiguous = ok.every((n, i) => i === 0 || n === ok[i - 1] + 1);
  if (ok.length === 1) return `${ok[0]} jogadores`;
  if (contiguous) return `${ok[0]}–${ok[ok.length - 1]} jogadores`;
  return `${ok.slice(0, -1).join(', ')} ou ${ok[ok.length - 1]} jogadores`;
}

function startBlocker(room: RoomView, def: GameDefinition | null): string | null {
  if (!def) return 'Escolha um jogo.';
  const countErr = checkPlayerCount(def, room.players.length);
  if (countErr) return countErr;
  const cfg = def.validateConfig(room.options, room.players.length);
  if (cfg) return cfg;
  const notReady = room.players.filter((p) => p.id !== room.ownerId && !p.ready && !p.bot);
  if (notReady.length) return `Aguardando: ${notReady.map((p) => p.name).join(', ')}`;
  return null;
}

/** Chaves alteradas recentemente (para destacar), conhecidas desde que o componente montou. */
function useRecentChanges(room: RoomView): { keys: Set<string>; version: number } {
  const first = useRef(room.optionsVersion);
  const lc = room.lastChange;
  if (!lc || lc.version <= first.current) return { keys: new Set(), version: 0 };
  return { keys: new Set(lc.keys), version: lc.version };
}

export function Lobby() {
  const room = useRoom((s) => s.room)!;
  const you = useRoom((s) => s.you);
  const send = useRoom((s) => s.send);
  const isOwner = room.ownerId === you;
  const me = room.players.find((p) => p.id === you);
  const def = room.gameId ? (GAMES[room.gameId] ?? null) : null;
  const blocker = startBlocker(room, def);
  const changes = useRecentChanges(room);
  const staleReady = !isOwner && me?.ready && me.readyAtVersion < room.optionsVersion;
  const [picking, setPicking] = useState(false);

  return (
    <div className="lobby">
      <div className="stack">
        <RoomCodeCard code={room.code} />
        <div className="card stack">
          <div className="row">
            <h3 className="grow" style={{ margin: 0 }}>
              Jogadores ({room.players.length}
              {def ? `/${def.maxPlayers}` : ''})
            </h3>
          </div>
          <ul className="player-list">
            {room.players.map((p, i) => {
              const seatLabel = def?.seatLabel?.(i, room.options, room.players.length);
              const isRoomOwner = p.id === room.ownerId;
              const stale = p.ready && !isRoomOwner && p.readyAtVersion < room.optionsVersion;
              return (
                <li key={p.id} className={`player-item ${p.bot ? 'is-bot' : ''}`}>
                  <span className="seat" title="Ordem na mesa">
                    {i + 1}
                  </span>
                  <span className={`dot ${p.connected ? 'dot-on' : ''}`} title={p.connected ? 'Conectado' : 'Desconectado'} />
                  {p.id === you ? (
                    <button type="button" className="avatar-button" aria-label="Trocar avatar" aria-expanded={picking} onClick={() => setPicking((v) => !v)}>
                      <Avatar id={p.avatar} size={36} />
                    </button>
                  ) : (
                    <Avatar id={p.avatar} size={36} bot={p.bot} dim={!p.connected} />
                  )}
                  <span className="name">
                    {p.name}
                    {p.id === you && <span className="muted small"> (você)</span>}
                  </span>
                  {seatLabel && <span className="badge">{seatLabel}</span>}
                  {p.bot ? (
                    <span className="badge">Bot</span>
                  ) : isRoomOwner ? (
                    <span className="badge">Dono</span>
                  ) : p.ready ? (
                    <span className={`badge ${stale ? 'badge-warn' : 'badge-ok'}`} title={stale ? 'Marcou pronto antes da última alteração das regras' : ''}>
                      Pronto{stale ? ' *' : ''}
                    </span>
                  ) : (
                    <span className="badge">Aguardando</span>
                  )}
                  {isOwner && room.players.length > 1 && (
                    <span className="row" style={{ gap: 2, flexWrap: 'nowrap' }}>
                      <button className="btn btn-ghost btn-sm" aria-label="Subir" disabled={i === 0} onClick={() => send({ t: 'movePlayer', playerId: p.id, toIndex: i - 1 })}>
                        ↑
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        aria-label="Descer"
                        disabled={i === room.players.length - 1}
                        onClick={() => send({ t: 'movePlayer', playerId: p.id, toIndex: i + 1 })}
                      >
                        ↓
                      </button>
                      {p.id !== you && (
                        <button className="btn btn-ghost btn-sm" aria-label={`Remover ${p.name}`} onClick={() => confirm(`Remover ${p.name} da sala?`) && send({ t: 'kick', playerId: p.id })}>
                          ✕
                        </button>
                      )}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {picking && me && (
            <AvatarPicker
              value={me.avatar}
              onPick={(avatar) => {
                setAvatar(avatar);
                setPicking(false);
                send({ t: 'rename', name: me.name, avatar });
              }}
            />
          )}
          {isOwner && room.botsAvailable && def && room.players.length < def.maxPlayers && (
            <button className="btn btn-sm" onClick={() => send({ t: 'addBot' })}>
              Adicionar bot
            </button>
          )}
          {isOwner && room.players.length > 1 && <p className="muted small" style={{ margin: 0 }}>Use as setas para definir a ordem na mesa (e as duplas, quando houver).</p>}
        </div>
        {room.lastResult && <LastResult />}
      </div>

      <div className="stack">
        <div className="card stack">
          <h3 style={{ margin: 0 }}>Jogo</h3>
          {isOwner ? (
            <div className="game-picker" role="group" aria-label="Escolha o jogo">
              {GAME_LIST.map((g) => (
                <button key={g.id} className="game-option" aria-pressed={room.gameId === g.id} onClick={() => send({ t: 'setGame', gameId: g.id })}>
                  <strong>{g.name}</strong>
                  <span className="muted small">{playerCountLabel(g)}</span>
                </button>
              ))}
            </div>
          ) : def ? (
            <div key={`game-${changes.keys.has('__game__') ? changes.version : 0}`} className={changes.keys.has('__game__') ? 'changed' : ''}>
              <strong>{def.name}</strong>
            </div>
          ) : (
            <p className="muted" style={{ margin: 0 }}>O dono da sala ainda não escolheu o jogo.</p>
          )}
          {def && <p className="muted small" style={{ margin: 0 }}>{def.description}</p>}
        </div>

        {def && (
          <div className="card stack">
            <h3 style={{ margin: 0 }}>Regras desta partida</h3>
            <OptionsForm def={def} room={room} editable={isOwner} changes={changes} onChange={(options) => send({ t: 'setOptions', options })} />
            <ul className="rules">
              {def.rulesSummary(room.options as never, Math.max(room.players.length, def.minPlayers)).map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="sticky-actions stack">
          {staleReady && (
            <div className="banner row">
              <span className="grow">O dono alterou as regras depois que você marcou pronto.</span>
              <button className="btn btn-sm" onClick={() => send({ t: 'ready', ready: true })}>
                Continuo pronto
              </button>
              <button className="btn btn-sm btn-ghost" onClick={() => send({ t: 'ready', ready: false })}>
                Desmarcar
              </button>
            </div>
          )}
          {isOwner ? (
            <>
              <button className="btn btn-primary btn-block" disabled={Boolean(blocker)} onClick={() => send({ t: 'start' })}>
                Iniciar partida
              </button>
              {blocker && <p className="muted small" style={{ margin: 0, textAlign: 'center' }}>{blocker}</p>}
            </>
          ) : (
            <button className={`btn btn-block ${me?.ready ? '' : 'btn-primary'}`} disabled={!def} onClick={() => send({ t: 'ready', ready: !me?.ready })}>
              {me?.ready ? 'Não estou pronto' : 'Estou pronto'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function RoomCodeCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${location.origin}/sala/${code}`;
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: 'TableHub', text: `Entre na minha sala: ${code}`, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      }
    } catch {
      /* usuário cancelou */
    }
  }

  return (
    <div className="card row">
      <div className="grow">
        <div className="muted small">Código da sala</div>
        <div className="room-code">{code}</div>
      </div>
      <button className="btn" onClick={share}>
        {copied ? 'Link copiado!' : 'Convidar'}
      </button>
    </div>
  );
}

function LastResult() {
  const room = useRoom((s) => s.room)!;
  const r = room.lastResult!;
  const def = GAMES[r.gameId];
  const names = room.players.filter((p) => r.winners.includes(p.id)).map((p) => p.name);
  return (
    <div className="card stack">
      <h3 style={{ margin: 0 }}>Última partida{def ? ` — ${def.name}` : ''}</h3>
      <p style={{ margin: 0 }}>{r.message ?? (names.length ? `Vencedor: ${names.join(', ')}` : 'Sem vencedor.')}</p>
    </div>
  );
}
