# StatusPill

Barra do topo da partida: nome do jogo, de quem é a vez e a ação do dono.

Classes: `table-header` no contêiner; `status-pill` com a mensagem; `my-turn` somado quando é a vez de quem está vendo. No app: `GameTable.tsx`.

- Na sua vez a pílula fica âmbar e diz "Sua vez!". Nas outras, mostra a mensagem do jogo ("Vez de Bia").
- Use `aria-live="polite"` para leitores de tela anunciarem a troca de vez.
