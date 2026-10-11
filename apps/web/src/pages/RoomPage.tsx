import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { NAME_MAX, normalizeRoomCode } from '@tablehub/shared';
import { GameTable } from '../components/GameTable';
import { Lobby } from '../components/Lobby';
import { getName, setName } from '../lib/session';
import { useRoom } from '../store/room';

export function RoomPage() {
  const code = normalizeRoomCode(useParams().code ?? '');
  const [hasName, setHasName] = useState(Boolean(getName()));
  const { connect, disconnect, room, conn, fatal } = useRoom();

  useEffect(() => {
    if (!hasName) return;
    connect(code);
    return () => disconnect();
  }, [code, hasName, connect, disconnect]);

  if (!hasName) return <AskName onDone={() => setHasName(true)} code={code} />;

  if (fatal) {
    return (
      <div className="card stack" style={{ maxWidth: 460, margin: '0 auto' }}>
        <h2>Não foi possível entrar</h2>
        <p>{fatal}</p>
        <Link className="btn btn-primary" to="/">
          Voltar ao início
        </Link>
      </div>
    );
  }

  return (
    <>
      {conn === 'reconnecting' && <div className="conn-banner">Reconectando…</div>}
      {!room ? (
        <p className="muted">Conectando à sala {code}…</p>
      ) : room.status === 'lobby' ? (
        <Lobby />
      ) : (
        <GameTable />
      )}
    </>
  );
}

function AskName({ onDone, code }: { onDone: () => void; code: string }) {
  const [name, setNameState] = useState('');
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setName(name);
    onDone();
  }
  return (
    <form className="card stack" style={{ maxWidth: 460, margin: '0 auto' }} onSubmit={submit}>
      <h2>Entrar na sala {code}</h2>
      <label className="label" htmlFor="ask-name">
        Seu apelido
      </label>
      <input id="ask-name" className="input" autoFocus maxLength={NAME_MAX} value={name} onChange={(e) => setNameState(e.target.value)} />
      <button className="btn btn-primary" type="submit" disabled={!name.trim()}>
        Entrar
      </button>
    </form>
  );
}
