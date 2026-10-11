# Dominó (duplo-6) — especificação

- **Jogadores:** 2 a 4. Duplas opcionais com 4 (assentos 1+3 contra 2+4).
- **Peças:** 28 (0-0 a 6-6). 7 por jogador; o resto forma o monte (só usado no modo *compra*).
- **Abertura:** na 1ª rodada começa quem tem o maior duplo e é obrigado a jogá-lo (sem duplos: a peça de maior soma). Nas seguintes começa o vencedor da rodada anterior (empate: quem estava na vez).
- **Turno:** jogar uma peça que case com uma das pontas. Sem jogada: no modo *compra*, compra do monte até poder jogar; monte vazio (ou modo *bloqueio*) → passa.
- **Fim da rodada:**
  - *Batida* — quem esvazia a mão vence e marca a soma das peças dos adversários (em duplas: da dupla adversária).
  - *Fechado* — todos passam em sequência: vence a menor soma na mão (por dupla, se em duplas) e marca a soma dos demais; empate → ninguém pontua.
- **Fim de jogo:** primeiro a atingir `pointsToWin` (50/100/150). Empate no topo → todos empatados vencem.

## Opções
| chave | valores |
|---|---|
| `mode` | `bloqueio` \| `compra` |
| `pointsToWin` | 50 \| 100 \| 150 |
| `teams` | boolean (exige 4 jogadores) |
