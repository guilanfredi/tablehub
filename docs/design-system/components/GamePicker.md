# GamePicker

Grade de opções para escolher o jogo da mesa.

Classes: `game-picker` no grupo (`role="group"`), `game-option` em cada `<button>` com `aria-pressed`. Dentro: `<strong>` com o nome e `<span>` com jogadores. No app: `Lobby.tsx`.

- Selecionado: borda `primary` e fundo `primary-soft`.
- Só o dono da mesa troca o jogo; para os outros, mostre o jogo escolhido como texto.
