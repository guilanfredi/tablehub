import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { GAME_LIST } from '@tablehub/games';
import { isValidRoomCode, normalizeRoomCode } from '@tablehub/shared';
import { ProfileEditor } from '../components/avatars/ProfileEditor';
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
    if (!isValidRoomCode(c)) return setError('Código de mesa inválido (5 letras/números).');
    setError(null);
    setBusy('join');
    try {
      setName(name);
      if (!(await roomExists(c))) return setError('Mesa não encontrada. Confira o código.');
      nav(`/sala/${c}${profileQuery()}`);
    } catch {
      setError('Não foi possível verificar a mesa.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <main>
      <section className="hero">
        <h1>Jogue com os amigos, onde estiverem</h1>
        <p className="muted">Abra uma mesa, compartilhe o código e escolha o jogo.</p>
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
          <h3 style={{ margin: 0 }}>Seu perfil</h3>
          <ProfileEditor
            name={name}
            onName={(n) => {
              setNameState(n);
              setName(n);
            }}
            inputId="name"
          />
          <button className="btn btn-primary btn-block" onClick={onCreate} disabled={busy !== null}>
            {busy === 'create' ? 'Abrindo…' : 'Abrir uma mesa'}
          </button>
        </div>

        <form className="card stack" onSubmit={onJoin}>
          <label className="label" htmlFor="code">
            Entrar em uma mesa
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
