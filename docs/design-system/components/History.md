# History (histórico da partida)

Painel comum com o log público da partida, aberto pelo botão **Histórico** no cabeçalho da mesa.
Substitui os logs que ficavam dentro de cada tabuleiro.

Componente: `HistoryPanel` em `apps/web/src/components/table/`. Classes: `history-btn`, `history-count`,
`history-panel`, `history-entry`, `away-banner`.

- **Botão:** `btn btn-sm` com selo `badge-primary` de não lidas (jogadas de outros desde a última vez que o
  painel foi visto). Abrir o painel zera.
- **Painel:** da mais nova para a mais antiga, cada linha em `surface-raised` com o avatar de quem agiu.
  Desktop (≥ 900 px): lateral à direita, pode ser **Fixado** ao lado da mesa. Celular: gaveta de baixo.
- **Aviso de ausência:** ao voltar para a aba, `banner banner-info` "N jogadas enquanto você esteve fora"
  com **Ver histórico**.
- Frases curtas no passado, com o nome de quem agiu: "Bia jogou [3|5] na ponta direita."
- Só informação pública: nunca a peça comprada nem a carta encoberta.
