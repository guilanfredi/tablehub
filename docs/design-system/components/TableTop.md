# TableTop

O tampo da mesa: a superfície onde o tabuleiro de cada jogo é desenhado.

Classe: `table-top` (o app ainda usa `felt`, que este estilo também cobre). Os tabuleiros (`apps/web/src/games/<id>`) desenham por cima.

- Degradê radial de `table` (centro) para `table-edge` (bordas), canto `radius-lg`, padding `space-3`. É madeira escura, no lugar do feltro verde.
- Texto sobre o tampo em `ink` ou `ink-muted`.
- Controles de zoom ficam no canto inferior direito, como `btn btn-sm` com `shadow-float`.
