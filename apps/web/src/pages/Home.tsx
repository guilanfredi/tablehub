import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { GAME_LIST } from '@tablehub/games';
import { isValidRoomCode, NAME_MAX, normalizeRoomCode } from '@tablehub/shared';
import { createRoom, roomExists } from '../lib/api';
import { getName, profileQuery, setName } from '../lib/session';

export function Home() {
  const nav = useNavigate();
  const [name, setNameState] = useState(getName());
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nameOk = name.trim().length > 0;

  async function onCreate() {
    if (!nameOk) return setError('Escolha um apelido primeiro.');
    setError(null);
    setBusy('create');
    try {
      setName(name);
      const c = await createRoom();
      nav(`/sala/${c}${profileQuery()}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onJoin(e: FormEvent) {
    e.preventDefault();
    if (!nameOk) return setError('Escolha um apelido primeiro.');
    const c = normalizeRoomCode(code);
    if (!isValidRoomCode(c)) return setError('Código de sala inválido (5 letras/números).');
    setError(null);
    setBusy('join');
    try {
      setName(name);
      if (!(await roomExists(c))) return setError('Sala não encontrada.');
      nav(`/sala/${c}${profileQuery()}`);
    } catch {
      setError('Não foi possível verificar a sala.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <main>
      <section className="hero">
        <h1>Jogue com os amigos, onde estiverem</h1>
        <p className="muted">Crie uma sala, compartilhe o código e escolha o jogo.</p>
        <div className="games-strip">
          {GAME_LIST.map((g) => (
            <span key={g.id} className="badge">
              {g.name}
            </span>
          ))}
        </div>
      </section>

      <div className="home-grid">
        <div className="card stack">
          <div>
            <label className="label" htmlFor="name">
              Seu apelido
            </label>
            <input
              id="name"
              className="input"
              value={name}
              maxLength={NAME_MAX}
              autoComplete="nickname"
              placeholder="Como os outros vão te chamar"
              onChange={(e) => setNameState(e.target.value)}
            />
          </div>
          <button className="btn btn-primary btn-block" onClick={onCreate} disabled={busy !== null}>
            {busy === 'create' ? 'Criando…' : 'Criar sala'}
          </button>
        </div>

        <form className="card stack" onSubmit={onJoin}>
          <label className="label" htmlFor="code">
            Entrar em uma sala
          </label>
          <div className="row">
            <input
              id="code"
              className="input code-input grow"
              value={code}
              maxLength={5}
              placeholder="ABCDE"
              autoCapitalize="characters"
              autoComplete="off"
              onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
            />
            <button className="btn" type="submit" disabled={busy !== null}>
              {busy === 'join' ? '…' : 'Entrar'}
            </button>
          </div>
        </form>

        {error && (
          <div className="banner" role="alert">
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
