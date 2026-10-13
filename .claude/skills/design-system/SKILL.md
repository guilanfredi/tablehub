---
name: design-system
description: Use antes de criar ou alterar qualquer interface do TableHub (telas, componentes, CSS, textos de UI, ícones, tabuleiros) para seguir o design system Taverna.
---

# Design system TableHub (Taverna)

Toda interface do TableHub segue o design system em `docs/design-system/`. Leia `docs/design-system/README.md` antes de mexer em UI e o guia do componente em `docs/design-system/components/<Nome>.md` antes de usar ou alterar um componente.

## Regras obrigatórias

1. **Cores, espaços, cantos e sombras só por variável** de `apps/web/src/design-system/tokens.css` (`var(--primary)`, `var(--space-4)`…). Nada de hex, `rgb()` ou `hsl()` em `apps/web/src` fora de `apps/web/src/design-system/` e da arte dos jogos (`apps/web/src/games/*/art.tsx`).
2. **Use as classes existentes** de `components.css` (`btn btn-primary`, `card`, `badge badge-ok`, `player-item`, `status-pill`, `table-top`…) antes de criar estilo novo. Um componente novo ganha guia em `docs/design-system/components/` no mesmo PR.
3. **Tipografia:** Fredoka (`--font-display`) só em títulos, nome da marca, código da mesa e números grandes; Nunito (`--font-body`) no resto. Escala em `README.md`.
4. **Um `btn-primary` por área.** Destrutivo usa `btn-danger` e pede confirmação.
5. **Texto em português do Brasil, voz da marca:** "mesa" (não "sala"), "Abrir uma mesa", "Sentar", "Código da mesa". Botões dizem o que acontece. Sem emoji na interface.
6. **Acessibilidade:** texto com contraste de 4.5:1 sobre o fundo (os pares do README já passam), alvos de toque de 44px, foco visível com anel `--primary`.
7. **Logo:** use os SVGs de `docs/design-system/logos/` sem alterar; abaixo de 24px, o ícone do app.
8. **Mudou um valor?** Edite `docs/design-system/tokens.json`, regenere `tokens.css` e atualize o README no mesmo PR. Nunca edite `tokens.css` à mão.

## Antes de abrir o PR

- Rode `node scripts/check-design-system.mjs` e corrija o que ele apontar.
- Compare a tela com `docs/design-system/preview.html` aberto no navegador.
