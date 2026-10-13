import { AVATARS, isAvatarId, type AvatarId, type RoomPlayerView } from '@tablehub/shared';
import { AVATAR_ART, BOT_BADGE, type AvatarArt } from './art';
import './avatars.css';

function Art({ art }: { art: AvatarArt }) {
  return (
    <>
      <circle cx="50" cy="50" r="50" fill={art.bg} />
      {art.polys.map(([points, fill], i) => (
        <polygon key={i} points={points} fill={fill} />
      ))}
    </>
  );
}

export const avatarLabel = (id: string) => AVATARS.find((a) => a.id === id)?.label ?? 'Avatar';

interface AvatarProps {
  id: string;
  size?: number;
  /** Anel de destaque (ex.: jogador da vez). */
  ring?: boolean;
  /** Mostra o selo de robô no canto. */
  bot?: boolean;
  /** Jogador desconectado (avatar em cinza). */
  dim?: boolean;
  className?: string;
}

/** Cabeça de animal low poly em círculo, legível de 24 px a 96 px. */
export function Avatar({ id, size = 40, ring, bot, dim, className = '' }: AvatarProps) {
  const avatarId: AvatarId = isAvatarId(id) ? id : 'onca';
  const label = avatarLabel(avatarId);
  return (
    <span className={`avatar ${ring ? 'avatar-ring' : ''} ${dim ? 'avatar-dim' : ''} ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={label}>
        <Art art={AVATAR_ART[avatarId]} />
      </svg>
      {bot && (
        <svg className="avatar-bot" viewBox="0 0 100 100" role="img" aria-label="Bot">
          <title>Bot</title>
          <Art art={BOT_BADGE} />
        </svg>
      )}
    </span>
  );
}

/** Avatar de um jogador da sala, com selo de bot e "pensando…" quando é a vez de um bot. */
export function PlayerAvatar({ player, size = 28, thinking = false, ring }: { player: RoomPlayerView | undefined; size?: number; thinking?: boolean; ring?: boolean }) {
  if (!player) return null;
  return (
    <span className="player-avatar">
      <Avatar id={player.avatar} size={size} bot={player.bot} dim={!player.connected} ring={ring} />
      {thinking && player.bot && <Thinking />}
    </span>
  );
}

export function Thinking() {
  return (
    <span className="thinking" role="status">
      pensando
      <span className="thinking-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </span>
  );
}

/** Grade com os 20 avatares. Escolher chama `onPick`. */
export function AvatarPicker({ value, onPick }: { value: string; onPick(id: AvatarId): void }) {
  return (
    <div className="avatar-grid" role="listbox" aria-label="Escolha seu avatar">
      {AVATARS.map((a) => (
        <button
          key={a.id}
          type="button"
          role="option"
          aria-selected={a.id === value}
          aria-label={a.label}
          title={a.label}
          className={`avatar-option ${a.id === value ? 'selected' : ''}`}
          onClick={() => onPick(a.id)}
        >
          <Avatar id={a.id} size={48} />
        </button>
      ))}
    </div>
  );
}
