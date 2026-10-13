import type { Face } from '@tablehub/games/king-of-tokyo/engine';

export const MONSTER_COLORS: Record<string, string> = {
  Alienoid: '#e0a526',
  'Cyber Kitty': '#d65aa8',
  Gigazaur: '#3f9b4b',
  'Meka Dragon': '#c7432f',
  'Space Penguin': '#3a7fd0',
  'The King': '#7a5a3a',
};

/** Retrato próprio, em SVG, de cada monstro (silhueta simples com a cor do monstro). */
export function MonsterPortrait({ monster, size = 44, dead }: { monster: string; size?: number; dead?: boolean }) {
  const c = dead ? '#8a8a8a' : (MONSTER_COLORS[monster] ?? '#777');
  const shape = Object.keys(MONSTER_COLORS).indexOf(monster);
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={monster} className="kot-portrait">
      <circle cx="24" cy="24" r="23" fill="var(--surface-raised)" stroke={c} strokeWidth="2" />
      {shape === 0 && <path d="M24 6 L27 14 L21 14 Z M14 10 L19 16 L13 17 Z M34 10 L35 17 L29 16 Z" fill={c} />}
      {shape === 1 && <path d="M12 18 L15 6 L21 15 Z M36 18 L33 6 L27 15 Z" fill={c} />}
      {shape === 2 && <path d="M16 13 L20 6 L22 13 M24 12 L28 5 L30 12 M31 14 L36 8 L36 16" fill={c} stroke={c} strokeWidth="2" />}
      {shape === 3 && <path d="M13 16 L8 6 L19 13 Z M35 16 L40 6 L29 13 Z" fill={c} />}
      {shape === 4 && <ellipse cx="24" cy="34" rx="9" ry="7" fill="#fff" opacity="0.85" />}
      {shape === 5 && <path d="M15 14 L18 7 L22 12 L24 6 L26 12 L30 7 L33 14 Z" fill="#e5c03c" />}
      <path d="M10 40 C10 22 14 13 24 13 C34 13 38 22 38 40 Z" fill={c} />
      {shape === 4 && <ellipse cx="24" cy="33" rx="8" ry="7" fill="#fff" opacity="0.9" />}
      <circle cx="18.5" cy="24" r="4" fill="#fff" />
      <circle cx="29.5" cy="24" r="4" fill="#fff" />
      {dead ? (
        <path d="M16 22 L21 26 M21 22 L16 26 M27 22 L32 26 M32 22 L27 26" stroke="#333" strokeWidth="1.6" />
      ) : (
        <>
          <circle cx="19" cy="24.5" r="1.8" fill="#222" />
          <circle cx="29" cy="24.5" r="1.8" fill="#222" />
        </>
      )}
      <path d="M17 32 L20 35 L22 32 L24 35 L26 32 L28 35 L31 32" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function FaceIcon({ face, size = 22 }: { face: Face; size?: number }) {
  if (face === '1' || face === '2' || face === '3')
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <text x="12" y="19" textAnchor="middle" fontSize="20" fontWeight="800" fill="currentColor" fontFamily="system-ui, sans-serif">
          {face}
        </text>
      </svg>
    );
  if (face === 'energy')
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14 2 L5 14 H11 L9 22 L19 9 H13 Z" fill="#f2c94c" stroke="#a7811a" strokeWidth="1" />
      </svg>
    );
  if (face === 'heart')
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21 C5 15 2 12 2 8 A5 5 0 0 1 12 6 A5 5 0 0 1 22 8 C22 12 19 15 12 21 Z" fill="#e0475b" />
      </svg>
    );
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 20 L10 4 M10 21 L15 5 M15 21 L19 7" stroke="#d9d9d9" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M5 20 L10 4 M10 21 L15 5 M15 21 L19 7" stroke="#b33" strokeWidth="1.2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export const FACE_NAMES: Record<Face, string> = { '1': '1', '2': '2', '3': '3', energy: 'energia', claw: 'garra', heart: 'coração' };
