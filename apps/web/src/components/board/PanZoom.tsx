import { useRef, useState, type PointerEvent, type ReactNode, type WheelEvent } from 'react';
import './board.css';

interface Props {
  /** viewBox do conteúdo (unidades do SVG). */
  viewBox: { x: number; y: number; w: number; h: number };
  children: ReactNode;
  minScale?: number;
  maxScale?: number;
  ariaLabel?: string;
}

/**
 * SVG com arrastar e zoom (pinça no celular, roda do mouse no desktop).
 * Cliques após arrastar são ignorados para não disparar jogadas sem querer.
 */
export function PanZoom({ viewBox, children, minScale = 1, maxScale = 3.5, ariaLabel }: Props) {
  const [t, setT] = useState({ x: 0, y: 0, k: 1 });
  const svgRef = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; k: number; moved: number } | null>(null);
  const moved = useRef(0);

  const clamp = (k: number) => Math.min(maxScale, Math.max(minScale, k));

  /** Converte pixels de tela para unidades do viewBox. */
  function unitsPerPx() {
    const el = svgRef.current;
    if (!el) return 1;
    const r = el.getBoundingClientRect();
    return Math.max(viewBox.w / r.width, viewBox.h / r.height);
  }

  function limit(x: number, y: number, k: number) {
    const maxX = (viewBox.w * (k - 1)) / 2 + viewBox.w * 0.1;
    const maxY = (viewBox.h * (k - 1)) / 2 + viewBox.h * 0.1;
    return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)), k };
  }

  function onPointerDown(e: PointerEvent<SVGSVGElement>) {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) moved.current = 0;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), k: t.k, moved: 0 };
    }
  }

  function onPointerMove(e: PointerEvent<SVGSVGElement>) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, cur);
    if (pointers.current.size === 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      moved.current += 10;
      setT((s) => limit(s.x, s.y, clamp((gesture.current!.k * d) / gesture.current!.dist)));
      return;
    }
    if (pointers.current.size === 1 && t.k > 1) {
      const u = unitsPerPx();
      const dx = (cur.x - prev.x) * u;
      const dy = (cur.y - prev.y) * u;
      moved.current += Math.abs(dx) + Math.abs(dy);
      if (moved.current > 4 && !svgRef.current?.hasPointerCapture(e.pointerId)) svgRef.current?.setPointerCapture(e.pointerId);
      setT((s) => limit(s.x + dx, s.y + dy, s.k));
    }
  }

  function onPointerUp(e: PointerEvent<SVGSVGElement>) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
  }

  function onWheel(e: WheelEvent<SVGSVGElement>) {
    if (!e.ctrlKey && !e.metaKey && t.k === 1 && e.deltaY > 0) return;
    setT((s) => limit(s.x, s.y, clamp(s.k * (e.deltaY < 0 ? 1.15 : 1 / 1.15))));
  }

  const cx = viewBox.x + viewBox.w / 2;
  const cy = viewBox.y + viewBox.h / 2;

  return (
    <div className="panzoom">
      <svg
        ref={svgRef}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        className="panzoom-svg"
        role="img"
        aria-label={ariaLabel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onClickCapture={(e) => {
          if (moved.current > 8) {
            e.stopPropagation();
            e.preventDefault();
          }
        }}
      >
        <g transform={`translate(${t.x} ${t.y}) translate(${cx} ${cy}) scale(${t.k}) translate(${-cx} ${-cy})`}>{children}</g>
      </svg>
      <div className="panzoom-controls">
        <button className="btn btn-sm" aria-label="Aproximar" onClick={() => setT((s) => limit(s.x, s.y, clamp(s.k * 1.3)))}>
          +
        </button>
        <button className="btn btn-sm" aria-label="Afastar" onClick={() => setT((s) => limit(s.x, s.y, clamp(s.k / 1.3)))}>
          −
        </button>
        {t.k !== 1 && (
          <button className="btn btn-sm" aria-label="Centralizar" onClick={() => setT({ x: 0, y: 0, k: 1 })}>
            ⟲
          </button>
        )}
      </div>
    </div>
  );
}
