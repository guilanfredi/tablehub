# PlayerList

Lista dos jogadores sentados na mesa, com assento, presença e estado.

Classes: `player-list` no `<ul>`, `player-item` em cada `<li>`, `seat` (número do assento; `seat-2`…`seat-4` trocam a cor, `seat-empty` para lugar livre), `dot` / `dot-on` (presença), `name`, e `Badge` para o estado. No app: `Lobby.tsx`.

- Ordem: assento, presença, nome, selos, ações (`btn-ghost btn-sm`).
- Nomes longos cortam com reticências; o selo nunca quebra linha.
- Cores de assento seguem a ordem: `primary`, `accent`, `support`, `info`.
