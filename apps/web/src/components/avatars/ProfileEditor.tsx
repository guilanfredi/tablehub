import { useState } from 'react';
import { NAME_MAX, type AvatarId } from '@tablehub/shared';
import { getAvatar, setAvatar } from '../../lib/session';
import { Avatar, AvatarPicker } from './Avatar';

/** Avatar (com seletor) + apelido. O avatar é salvo no navegador assim que é escolhido. */
export function ProfileEditor({ name, onName, inputId, autoFocus }: { name: string; onName(name: string): void; inputId: string; autoFocus?: boolean }) {
  const [avatar, setAvatarState] = useState<AvatarId>(getAvatar);
  const [picking, setPicking] = useState(false);

  function pick(id: AvatarId) {
    setAvatar(id);
    setAvatarState(id);
    setPicking(false);
  }

  return (
    <div className="stack">
      <div className="profile-row">
        <button type="button" className="avatar-button" onClick={() => setPicking((v) => !v)} aria-label="Trocar avatar" aria-expanded={picking}>
          <Avatar id={avatar} size={72} />
          <span className="avatar-edit" aria-hidden="true">
            ✎
          </span>
        </button>
        <div className="grow stack" style={{ gap: 6 }}>
          <label className="label" htmlFor={inputId}>
            Seu apelido
          </label>
          <input
            id={inputId}
            className="input"
            value={name}
            maxLength={NAME_MAX}
            autoComplete="nickname"
            autoFocus={autoFocus}
            placeholder="Como os outros vão te chamar"
            onChange={(e) => onName(e.target.value)}
          />
        </div>
      </div>
      <button type="button" className="btn btn-sm" onClick={() => setPicking((v) => !v)} aria-expanded={picking}>
        {picking ? 'Fechar' : 'Trocar avatar'}
      </button>
      {picking && <AvatarPicker value={avatar} onPick={pick} />}
    </div>
  );
}
