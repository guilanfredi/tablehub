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

interface TokyoOccupant {
  monster: string;
  name: string;
}

/** Facetas low poly de um prédio: frente clara, lateral escura e topo. */
function Tower({ x, w, h, tone }: { x: number; w: number; h: number; tone: number }) {
  const base = 150;
  const fronts = ['#4a5872', '#56637d', '#3f4c66'];
  const sides = ['#323d52', '#3a455b', '#2b3446'];
  const d = w * 0.35;
  return (
    <g>
      <polygon points={`${x},${base} ${x},${base - h} ${x + w},${base - h - 4} ${x + w},${base}`} fill={fronts[tone % 3]} />
      <polygon points={`${x + w},${base} ${x + w},${base - h - 4} ${x + w + d},${base - h} ${x + w + d},${base}`} fill={sides[tone % 3]} />
      <polygon points={`${x},${base - h} ${x + w * 0.5},${base - h - 9} ${x + w},${base - h - 4}`} fill="#6b7a96" />
    </g>
  );
}

function Zone({ cx, label, who, wide }: { cx: number; label: string; who?: TokyoOccupant; wide: boolean }) {
  const top = 112;
  const hw = wide ? 92 : 70;
  return (
    <g className="kot-zone" data-zone={label} color="#f4ecd8">
      <polygon points={`${cx - hw},${top + 34} ${cx - hw + 18},${top} ${cx + hw - 18},${top} ${cx + hw},${top + 34} ${cx + hw - 12},${top + 64} ${cx - hw + 12},${top + 64}`} fill="#000" opacity="0.18" />
      <text x={cx} y={top + 82} textAnchor="middle" fontSize="13" fontWeight="700" fill="currentColor" fontFamily="system-ui, sans-serif">
        {label}
      </text>
      {/* trocar o ocupante remonta o grupo: o monstro entra deslizando */}
      <g key={who?.name ?? 'vazia'} transform={`translate(${cx - 30} ${top - 14})`}>
        <g className="kot-slide">
          {who ? (
            <>
              <MonsterPortrait monster={who.monster} size={60} />
              <text x="30" y="72"textAnchor="middle" fontSize="11" fontWeight="700" fill="currentColor" fontFamily="system-ui, sans-serif">
                {who.name}
              </text>
            </>
          ) : (
            <>
              <circle cx="30" cy="30" r="27" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="5 4" opacity="0.6" />
              <text x="30" y="34" textAnchor="middle" fontSize="11" fill="currentColor" opacity="0.7" fontFamily="system-ui, sans-serif">
                vazia
              </text>
            </>
          )}
        </g>
      </g>
    </g>
  );
}

/** Tabuleiro de Tóquio em low poly próprio: silhueta da cidade, área Cidade e, com 5+ monstros vivos, a Baía. */
export function TokyoBoard({ city, bay, showBay }: { city?: TokyoOccupant; bay?: TokyoOccupant; showBay: boolean }) {
  const towers: [number, number, number][] = [
    [6, 22, 58], [34, 16, 84], [56, 26, 46], [88, 18, 102], [112, 24, 66], [142, 14, 120], [162, 28, 74],
    [196, 20, 92], [222, 16, 54], [244, 26, 110], [276, 18, 70], [300, 24, 88], [330, 20, 50],
  ];
  return (
    <svg viewBox="0 0 360 200" className="kot-board" role="group" aria-label={`Tóquio${city ? `: ${city.name} na Cidade` : ''}${showBay && bay ? `, ${bay.name} na Baía` : ''}`}>
      <polygon points="0,0 360,0 360,120 0,140" fill="#2a3350" />
      <polygon points="0,0 180,0 0,90" fill="#323c5c" />
      <polygon points="360,0 210,0 360,70" fill="#262e48" />
      <polygon points="298,14 312,26 296,34 288,22" fill="#e9d8a6" opacity="0.85" />
      {towers.map(([x, w, h], i) => (
        <Tower key={i} x={x} w={w} h={h} tone={i} />
      ))}
      <polygon points="166,30 170,8 174,30" fill="#c7432f" />
      <polygon points="0,150 360,150 360,200 0,200" fill="#5b4a3a" />
      <polygon points="0,150 120,150 40,200 0,200" fill="#66533f" />
      <polygon points="200,150 360,150 360,176" fill="#4f4031" />
      {showBay && (
        <g>
          <polygon points="220,150 360,140 360,200 196,200" fill="#2f6f9a" />
          <polygon points="220,150 290,146 252,178" fill="#3b82b0" />
          <polygon points="290,146 360,140 360,172 318,182" fill="#28628a" />
          <polygon points="196,200 252,178 300,200" fill="#357aa6" />
        </g>
      )}
      <Zone cx={showBay ? 108 : 180} label="Tóquio Cidade" who={city} wide={!showBay} />
      {showBay && <Zone cx={272} label="Tóquio Baía" who={bay} wide={false} />}
    </svg>
  );
}

/** Verso próprio das cartas de poder (facetas low poly). */
export function CardBack() {
  return (
    <svg viewBox="0 0 50 70" className="kot-back" aria-hidden="true">
      <rect x="0" y="0" width="50" height="70" rx="5" fill="#3a2f5c" />
      <polygon points="0,0 50,0 25,24" fill="#4a3c74" />
      <polygon points="0,70 50,70 25,46" fill="#2e2549" />
      <polygon points="25,24 40,35 25,46 10,35" fill="#e0a526" />
      <polygon points="25,24 40,35 25,35" fill="#f2c94c" />
      <rect x="2.5" y="2.5" width="45" height="65" rx="4" fill="none" stroke="#e0a526" strokeWidth="1.4" />
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
