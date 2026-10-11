# Truco Paulista — especificação

- **Jogadores:** 2 (individual) ou 4 (duplas em assentos alternados: 1+3 contra 2+4).
- **Baralho:** 40 cartas (sem 8, 9, 10). Ordem: 4 5 6 7 Q J K A 2 3.
- **Vira e manilha:** após dar 3 cartas a cada um, vira-se uma carta; a manilha é o valor seguinte (3 → 4). Naipes da manilha: ♣ (zap) > ♥ > ♠ > ♦. Cartas comuns de mesmo valor empatam.
- **Mão:** começa o jogador à direita de quem deu (próximo assento). Melhor de 3 vazas.
  - Vaza vence a carta mais forte; se as mais fortes forem de times diferentes → empate ("cangou"). A próxima vaza começa com quem venceu (ou quem jogou a maior carta primeiro, no empate).
  - Resultado: 2 vazas ganha; 1ª empatada → vale a 2ª; 2ª empatada após vitória na 1ª → vale a 1ª; 3ª empatada → vale a 1ª; três empates → ninguém pontua.
  - A partir da 2ª vaza pode-se jogar carta **encoberta** (vale menos que qualquer carta).
- **Apostas:** a mão vale 1. Na sua vez (antes de jogar) pode-se pedir Truco (3) → Seis (6) → Nove (9) → Doze (12). O time adversário (qualquer membro) responde: **aceitar**, **correr** (o pedinte ganha o valor atual) ou **aumentar** (aceita e pede o próximo nível). Quem fez o último aumento aceito não pode pedir o próximo.
- **Mão de onze** (opção): com exatamente um time em `pointsToWin-1`, esse time vê as cartas do parceiro e decide jogar (vale 3, sem truco) ou correr (+1 ao adversário).
- **Mão de ferro** (opção): ambos em `pointsToWin-1` → ninguém vê as próprias cartas, sem truco, sem encoberta.
- **Fim:** primeiro time a atingir `pointsToWin` (12 ou 24).
