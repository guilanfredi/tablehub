# GameTable (mesa comum)

Layout dos tabuleiros: assentos ao redor do tampo, você embaixo e os demais na ordem da mesa
(embaixo → direita → em cima → esquerda). Espectador vê o 1º assento embaixo.

Componente: `GameTableLayout` em `apps/web/src/components/table/`, com `arrangeSeats(ordem, você)`.
Classes: `gt`, `gt-seat`, `gt-felt` (usa `table-top`), `gt-corners`, `gt-strip` (celular).

- **Assento** (`gt-seat`): avatar 40 px (32 px no celular), nome ("Você" para si), selo de bot, cinza se
  desconectado, "pensando…" para bot e uma linha de contadores do jogo (13 px, `ink-muted`, números em `ink`).
- **Da vez:** anel `primary` pulsando no avatar e fundo `primary-soft` que entra deslizando no assento.
- **Centro:** conteúdo do jogo. **Cantos** (`cornerLeft`/`cornerRight`) para monte, vira, mercado; no celular
  descem para baixo do centro, logo acima da sua mão.
- **Celular (≤ 600 px):** oponentes numa faixa no topo, centro na largura toda, sem rolagem horizontal.
- Animações que saem do assento usam `fromSeat(place)` (`--dx`/`--dy`, direção do centro para o assento).

## Movimento
Curto (150–350 ms), nunca bloqueia cliques (o estado novo já está clicável). Com
`prefers-reduced-motion: reduce`, `components.css` desliga toda animação e transição do app.
