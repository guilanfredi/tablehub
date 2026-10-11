# Catan (jogo base, 3–4 jogadores) — especificação

- **Tabuleiro:** 19 hexágonos (4 floresta, 4 pasto, 4 campo, 3 colina, 3 montanha, 1 deserto), fichas 2–12 em espiral (sem 7), 9 portos (4 genéricos 3:1, 5 específicos 2:1). Modo aleatório embaralha terrenos e portos e evita 6/8 vizinhos. Ladrão começa no deserto.
- **Ordem:** sorteada. **Preparação** em serpente (1→n, n→1): aldeia + estrada ligada a ela; a 2ª aldeia recebe 1 recurso de cada terreno vizinho.
- **Turno:** (opcional: Cavaleiro antes) rolar 2d6 →
  - ≠7: cada aldeia vizinha a terreno sorteado (sem ladrão) recebe 1, cidade 2. Banco sem estoque para todos → ninguém recebe aquele recurso (exceto se só um jogador recebe: leva o que houver).
  - 7: quem tem mais que `discardLimit` cartas descarta metade (arred. para baixo); o jogador move o ladrão e rouba 1 carta aleatória de um dono de construção vizinha.
  - Fase principal: construir, comprar carta, jogar 1 carta de desenvolvimento, trocar, encerrar.
- **Custos:** estrada (tijolo+madeira), aldeia (tijolo+madeira+lã+trigo), cidade (2 trigo+3 minério), carta (lã+trigo+minério). Peças: 15 estradas, 5 aldeias, 4 cidades.
- **Colocação:** regra da distância (nenhuma construção em cruzamento vizinho); aldeia (fora da preparação) precisa tocar estrada própria; estrada liga a construção/estrada própria e não atravessa construção adversária.
- **Cartas (25):** 14 cavaleiros, 5 pontos, 2 construção de estradas, 2 ano de fartura, 2 monopólio. Não se joga carta comprada no mesmo turno; 1 por turno; pontos contam automaticamente (ocultos).
- **Trocas:** banco 4:1, porto genérico 3:1, porto específico 2:1; entre jogadores só com o jogador da vez (oferta → respostas → confirmação).
- **Bônus:** Maior Estrada (≥5, contínua, interrompida por construção adversária; empate mantém o atual) e Maior Exército (≥3 cavaleiros) valem 2 PV.
- **Vitória:** atingir `vpToWin` (8–12) no próprio turno.
