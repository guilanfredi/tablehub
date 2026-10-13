import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Chaves que apareceram depois da primeira renderização (ex.: peça recém-jogada), para receber a classe de
 * entrada por `ms`. O que já estava na tela ao abrir a mesa não anima.
 */
export function useFreshKeys(keys: string[], ms = 400): Set<string> {
  const known = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const sig = keys.join('|');
  useLayoutEffect(() => {
    const before = known.current;
    known.current = new Set(keys);
    if (!before) return;
    const added = keys.filter((k) => !before.has(k));
    if (!added.length) return;
    setFresh(new Set(added));
    const t = setTimeout(() => setFresh(new Set()), ms);
    return () => clearTimeout(t);
  }, [sig, ms]);
  return fresh;
}

/** Quantos itens acabaram de sair de uma contagem (ficam um instante na tela para animar a saída). */
export function useLeaving(count: number, ms = 300): number {
  const [leaving, setLeaving] = useState(0);
  const prev = useRef(count);
  useEffect(() => {
    const gone = prev.current - count;
    prev.current = count;
    if (gone <= 0) {
      setLeaving(0);
      return;
    }
    setLeaving(gone);
    const t = setTimeout(() => setLeaving(0), ms);
    return () => clearTimeout(t);
  }, [count, ms]);
  return leaving;
}
