# 24 — Experiência mais acolhedora (perfil, bots, histórico, mesa)

## Objetivo
Jogadores acham a plataforma impessoal: todo mundo é só um nome, bots são "Bot 1" e jogam instantaneamente,
quem se distrai não sabe o que aconteceu e cada jogo tem uma tela diferente. Esta melhoria dá rosto aos jogadores
(avatar), personalidade aos bots, um histórico comum, aviso de vez, animações e uma mesa padrão onde os jogadores
ficam sentados — com o Dominó e o King of Tokyo como primeiros beneficiados.

**Direção de arte (vale para tudo aqui):** todo asset novo (avatares, ícones, monte do dominó, tabuleiro do
King of Tokyo) é **low poly**: formas facetadas em SVG feito à mão/código, com 2–4 tons por face, sem gradientes
fotográficos e sem assets de jogos comerciais.

## Partes
A issue reúne oito pedidos. Para manter cada entrega testável, a especificação é dividida em partes e
**cada parte vira um PR próprio** (Dúvida 1, decidida). Este arquivo continua sendo a especificação de todas elas.

| Parte | Itens da issue | Conteúdo | Entrega |
|---|---|---|---|
| A — Perfil e bots | 1, 2, 5 | avatares, perfil salvo, bots com nome/avatar/tempo de pensar, aviso de vez | **este PR (#25)** |
| C — Dominó | 3, 7 | monte visual e compra pelo jogador | #27, 1ª na fila |
| B — Mesa comum, histórico e animações | 4, 6, 8 (base) | componente de mesa, painel de histórico, animações | #28, depois de A e C |
| D — Mesa do King of Tokyo | 8 | tabuleiro de Tóquio, monstros ao redor, mercado em miniatura | #29, depende de B |

---

## Parte A — Perfil e bots

### A1. Avatares
- Conjunto fixo de **20 avatares** low poly de **animais** (Dúvida 2, decidida): cabeças de animais da fauna
  brasileira e clássicos — onça, capivara, tucano, arara, boto, jacaré, mico, tamanduá, preguiça, lobo-guará, coruja, raposa,
  gato, cachorro, coelho, panda, pinguim, sapo, polvo, tartaruga.
- Cada avatar tem um id estável (`onca`, `capivara`…) e um rótulo em português (usado no `aria-label`).
- Renderização: componente `<Avatar id size ring? bot? />` em `apps/web/src/components/avatars/`, SVG em
  `viewBox` quadrado, legível de 24 px (lista) a 96 px (seletor). Fundo circular colorido por avatar.

### A2. Perfil salvo
- **Página inicial:** o cartão "Seu apelido" vira "Seu perfil": avatar atual grande + campo de apelido + botão
  "Trocar avatar", que abre uma grade 5×4 (4×5 no celular, alvos de toque ≥ 44 px). Escolher fecha a grade.
- Apelido **e** avatar ficam no `localStorage` por perfil (`th:name`, `th:avatar`, com o sufixo de `?perfil=`
  como hoje) e são salvos ao escolher o avatar e ao criar/entrar em sala. Ao voltar, tudo já vem preenchido.
- Quem nunca escolheu avatar recebe um **sugerido aleatório** (salvo na primeira vez que for mostrado), para
  nunca entrar sem rosto.
- **Entrar por link sem apelido** (`RoomPage`): o formulário "Seu apelido" passa a ter também o seletor de avatar.
- **Na sala (lobby):** cada jogador aparece com o avatar ao lado do nome. Tocar no **próprio** avatar abre o
  seletor; a troca vale na hora para todos e é salva no navegador. Durante a partida não se troca avatar.
- Avatares repetidos na mesma sala são permitidos (o nome diferencia).

### A3. Bots com nome e avatar
- Ao adicionar um bot, ele recebe um **nome** da lista fixa escolhida pelo dono (Dúvida 5, decidida), com
  11 nomes: Paula, Jacinto, Benjamin, Cuca, Kelly, Oscar, Simas, Giuseppe, Sujiro, Tati, Kevin (a resposta
  listava "Oscar" duas vezes; fica uma). Basta para o maior jogo (6 lugares). Também recebe um **avatar** do
  mesmo conjunto dos humanos, ambos sorteados entre os que **ainda não estão em uso** na sala (nome comparado sem
  acento/maiúsculas, inclusive contra humanos).
- Indicação de bot, em todo lugar onde o jogador aparece (lobby, mesa, histórico): um pequeno selo de robô
  (🤖 em SVG low poly) no canto do avatar + `title`/`aria-label` "Bot". O selo "Bot" do lobby continua.
- Se todos os nomes da lista já estiverem em uso (só acontece com humanos usando esses nomes), o bot recebe
  "Bot <n>" como hoje.
- Ids continuam `bot-<n>` (nenhuma regra de sala depende do nome).
- **Onde aparece antes da Parte B:** enquanto a mesa comum não existe, avatar, selo de bot e "pensando…" (A4)
  entram onde cada tabuleiro já mostra os jogadores (assentos do Truco, lista de jogadores do Dominó, do Catan
  e do King of Tokyo), sem redesenhar o layout. A Parte B depois move isso para `GameTableLayout`.

### A4. Tempo de pensar dos bots
- Antes de cada jogada, o bot espera um tempo **aleatório**:
  - primeira ação da vez dele: **1,2 s a 2,5 s**;
  - ações seguidas do mesmo bot sem troca de vez (ex.: comprar várias peças no dominó): **0,6 s a 1 s**.
- Enquanto o bot "pensa", o assento dele na mesa mostra "pensando…" com três pontinhos animados
  (o cliente deduz isso: o jogador da vez é bot e a partida está em andamento).
- Sem humano conectado, os bots continuam parados (como hoje).

### A5. Aviso de que é a sua vez
O som de vez (`turn`) já existe. Somam-se:
- **Título da aba** alterna entre "● Sua vez! — TableHub" e o título normal enquanto for sua vez e a aba estiver
  em segundo plano; volta ao normal ao focar a aba ou quando a vez passar.
- **Notificação do sistema** opcional: botão de sino ao lado do botão de som, no cabeçalho da mesa. O primeiro
  toque pede permissão ao navegador (nunca pedimos sozinhos). Ligado + permissão concedida + aba em segundo plano
  → notificação "Sua vez em <jogo>" (tocá-la foca a aba). Usar `ServiceWorkerRegistration.showNotification`
  quando houver service worker (necessário no Android), senão `new Notification`. Preferência salva em
  `th:notificar`. Permissão negada → o sino fica riscado e o toque mostra um aviso explicando como liberar.
- **Vibração** curta (`navigator.vibrate(150)`) no celular quando vira sua vez, se o som estiver ligado.
- Nada disso dispara na primeira mensagem da partida nem para espectadores.

### Mudanças técnicas — Parte A
- `packages/shared`: `AVATARS` (lista de `{ id, label }`) e `avatarIdSchema` (`z.enum`); `hello` e `rename`
  ganham `avatar` **opcional**; `RoomPlayerView.avatar: string`.
- `packages/room-core`: `RoomPlayer.avatar?: string`. `join(room, id, name, avatar, now)` grava o avatar se
  vier; `rename` aceita avatar (recusa durante a partida só a troca de avatar: "Não é possível trocar o avatar
  durante a partida."). `addBot(room, by, now, seed)` sorteia nome e avatar livres com `Rng(seed)`.
  `toView` usa um **avatar padrão determinístico** (hash do id sobre a lista) quando o jogador não tem avatar —
  cobre salas já gravadas e clientes antigos que não mandam avatar.
- Tempo de pensar: `RoomData.botDueAt: number | null`, calculado (com `Rng`) quando um bot passa a ter vez e
  limpo após jogar; `scheduleAlarm` usa `botDueAt` em vez de `BOT_DELAY_MS` fixo (sem isso, cada `commit`
  sortearia um prazo novo). `room-core` expõe as faixas como constantes para teste.
- `apps/web`: `Avatar`, seletor, `session.ts` (`getAvatar`/`setAvatar`), `hello` com avatar, cabeçalho da mesa
  com sino, lógica de título/notificação/vibração ao lado de `soundEvents` (função pura testável que decide
  "virou minha vez").
- Compatibilidade: cliente antigo (PWA em cache) não manda avatar e continua funcionando com o avatar padrão;
  cliente novo ignora a ausência de `avatar` em servidor antigo usando o mesmo padrão local.

---

## Parte B — Mesa comum, histórico e animações

### B1. Mesa comum (`GameTableLayout`)
Componente de layout em `apps/web/src/components/table/` usado pelos tabuleiros:
- **Assentos ao redor** de uma área central ("feltro"), começando por **você embaixo** e seguindo a ordem da mesa
  no sentido horário (como o Truco já faz). Espectador vê o assento 1 embaixo.
- Cada assento mostra: avatar (com anel colorido pulsando quando é a vez daquele jogador), nome ("Você" para si),
  selo de bot, indicador de desconectado (avatar em cinza) e uma área livre de **contadores** que o jogo preenche
  (peças na mão, pontos, vida…), além de "pensando…" para bots (A4).
- O centro recebe o conteúdo do jogo (linha do dominó, vaza do truco, Tóquio…). Slots opcionais nos cantos
  (ex.: monte do dominó, mercado).
- **Celular (≤ 600 px):** os oponentes viram uma faixa horizontal compacta no topo (avatar 32 px + contadores),
  o centro ocupa a largura toda e a sua mão fica embaixo. Nada de rolagem horizontal da página.
- Aplicar em: **Dominó**, **Truco** (substitui o layout próprio de assentos, mantendo o visual atual das cartas)
  e **King of Tokyo** (Parte D). **Catan** fica como está, só ganhando avatares no painel de jogadores
  (Dúvida 4, decidida).

### B2. Histórico (log) em todos os jogos
- Botão "Histórico" no cabeçalho da mesa, com **contador de não lidas**. Abre um painel lateral (desktop, ≥ 900 px,
  pode ficar fixo aberto) ou uma gaveta de baixo (celular). Entradas da mais nova para a mais antiga, cada uma com
  o avatar de quem agiu quando houver.
- Ao voltar para a aba depois de tê-la deixado em segundo plano, se houve entradas novas: aviso
  "N jogadas enquanto você esteve fora — Ver histórico". Abrir o painel zera o contador.
- O log mostra **somente informação pública**: nunca qual peça foi comprada, qual carta encoberta foi jogada etc.
- Os logs que hoje ficam dentro dos tabuleiros do Catan, Truco e King of Tokyo saem do tabuleiro (o painel comum
  substitui). O "última jogada" curto do Dominó continua no centro da mesa.
- O histórico guarda as **últimas 60** entradas e é da partida (zera ao iniciar outra).

### B3. Animações
Curtas (150–350 ms), em CSS/Web Animations, **desligadas com `prefers-reduced-motion`**. Escopo mínimo:
- Plataforma: anel do jogador da vez pulsa; troca de vez desliza o destaque; entrada de linha nova no histórico.
- Dominó: peça jogada entra na linha vindo da direção do assento de quem jogou; peça comprada entra na mão com
  leve "virada"; peças da mão de um oponente diminuem com fade.
- Truco: carta jogada vai do assento ao centro; vencedor da vaza recolhe as cartas.
- King of Tokyo: dados "chacoalham" ao rolar; monstro entrando/saindo de Tóquio desliza; dano/cura mostra
  "−2 ❤"/"+1 ❤" flutuando sobre o assento.
- Catan: peça construída "cai" no lugar.
A animação nunca atrasa a interação: o estado novo já está clicável durante a animação.

### Mudanças técnicas — Parte B
- `packages/game-sdk`: tipo `GameLog = { total: number; entries: LogEntry[] }`, `LogEntry = { text: string;
  by?: string }`, helper `pushLog(log, text, by?)` (limite 60; `total` conta tudo que já entrou, para o contador
  de não lidas) e método **opcional** `getLog?(state): GameLog` em `GameDefinition`. `runConformance` verifica,
  quando existir, formato, limite e que o log é o mesmo para todos (é público por contrato).
- Motores: Catan, Truco e King of Tokyo migram `log: string[]` para `GameLog`; **Dominó ganha log** (jogou
  `[a|b]` na ponta tal, comprou uma peça, passou, fim de rodada com motivo e pontos, vencedor). `getLog` tolera
  estado antigo (`string[]` → `total = length`) para partidas em andamento no deploy.
- `packages/shared`: mensagem `game` ganha `log?: GameLog`; `room-core.gameViewFor` preenche.
- `apps/web`: `GameTableLayout`, painel de histórico (contador de não lidas no store, por partida), animações.
  Tabuleiros deixam de renderizar log próprio.
- Cliente antigo ignora o campo `log`.

---

## Parte C — Dominó

### C1. Comprar é uma ação do jogador
Hoje o motor **não** compra sozinho: quando não há jogada, a interface mostra só o botão "Comprar do monte" e a
peça aparece na mão sem nenhum retorno visual, o que provavelmente foi percebido como compra automática
(Dúvida 3, decidida: o que os jogadores querem é **comprar tocando no monte**). Comportamento:
- Sem jogada possível e com monte: aparece o aviso "Sem peça para jogar — compre do monte", o **monte pisca** e o
  jogador compra **tocando no monte** (o botão continua, para acessibilidade). Uma peça por toque.
- A peça comprada entra na mão com animação e fica destacada até a próxima jogada; se ela (ou outra) encaixar, as
  jogáveis acendem como hoje.
- Monte vazio: aviso "O monte acabou" e o botão "Passar a vez" em destaque. Passar continua manual.
- Nenhuma regra do motor muda.

### C2. Monte visual
- No canto superior direito do feltro (no celular, acima da sua mão), uma **fileira de peças viradas para baixo**,
  uma por peça do monte (máx. 14 com 2 jogadores), levemente sobrepostas; com mais de 7, duas fileiras. O número
  continua num selo pequeno ao lado ("×9").
- Verso das peças low poly (padrão facetado na cor da plataforma).
- Comprar remove a peça da ponta da fileira com animação (inclusive quando outro jogador compra — todos veem o
  monte diminuir). Modo bloqueio / monte zerado: o espaço não aparece.
- Mãos dos oponentes nos assentos também como peças viradas (miniaturas), não só número.

---

## Parte D — Mesa do King of Tokyo
- Centro da mesa: **tabuleiro de Tóquio** low poly próprio — silhueta da cidade com a área **Tóquio Cidade** e,
  enquanto houver 5 ou mais monstros vivos, **Tóquio Baía**; o retrato do monstro que ocupa cada área aparece dentro
  dela.
- Monstros nos assentos ao redor (`GameTableLayout`): retrato, ❤ vida, ★ pontos, ⚡ energia e cartas
  Constantes como miniaturas.
- **Mercado** num canto do tabuleiro: as 3 cartas à venda em **miniatura** + o verso do baralho ("Descartar e
  repor (2⚡)"). Desktop: passar o mouse amplia a carta (zoom ~2,5× flutuando, sem deslocar o layout). Celular:
  toque abre a carta grande (comportamento atual de zoom). Comprar continua por botão na carta ampliada/painel.
- Dados e ações da vez ficam abaixo do tabuleiro, como hoje.
- Sem mudanças no motor.

---

## Fora do escopo
- Refazer em low poly as artes já existentes (peças de dominó, cartas do truco, hexágonos do Catan).
- Upload de foto/avatar personalizado, contas de usuário ou perfil no servidor (o perfil é do navegador).
- Bots para jogos que ainda não têm bot (Catan, King of Tokyo).
- Mudar regras de qualquer jogo (inclusive a compra no dominó).
- Chat entre jogadores.
- Notificação com a aba/app fechados (push do servidor).

## Dúvidas (todas resolvidas pelo dono em 12/10/2026)
1. **Entrega** (tudo neste PR / A + C / um PR por parte) → **um PR por parte.** Este PR (#25) entrega a Parte A;
   C (#27), B (#28) e D (#29) viram issues próprias, nessa ordem (D depende de B).
2. **Tema dos avatares** (animais / pessoas / misto) → **animais** (lista em A1).
3. **Compra no dominó** (comprar tocando no monte / poder comprar mesmo tendo peça / outra) → **comprar tocando
   no monte**, com aviso e animação (C1). Nenhuma regra do motor muda.
4. **Catan na mesa comum** (só avatares / assentos ao redor do mapa) → **só avatares** no painel de jogadores.
5. **Nomes dos bots** (nomes brasileiros de interior / nomes de robô) → **lista do dono** (A3).

## Critérios de aceite
O PR #25 é conferido pelos critérios 1–8 (Parte A) e pelo 19 no que toca a Parte A (avatares e selo de bot).
Os demais valem para o PR de cada parte.

**Parte A**
1. Na página inicial é possível escolher 1 de 20 avatares e um apelido; recarregar a página (e abrir em outra aba
   do mesmo perfil) mantém os dois. `?perfil=2` tem perfil próprio.
2. Primeira visita sem nada salvo: já aparece um avatar sugerido, que persiste ao recarregar.
3. Entrar por link sem apelido mostra apelido + seletor de avatar; ao entrar, o lobby mostra o avatar escolhido
   para todos os jogadores.
4. No lobby, tocar no próprio avatar e escolher outro atualiza a lista de todos em até 1 s; tocar no avatar de
   outra pessoa não faz nada. Durante a partida, `rename` com avatar é recusado com mensagem em português.
5. Cliente que manda `hello` sem `avatar` entra normalmente e aparece com um avatar padrão estável (o mesmo a
   cada reconexão).
6. Bots adicionados recebem nomes da lista de A3 e avatares distintos entre si e dos nomes humanos da sala, com o selo
   de robô visível no lobby e na mesa.
7. Cada jogada de bot acontece entre 1,2 s e 2,5 s após a vez chegar a ele (ações seguidas: 0,6–1 s); durante a
   espera o assento mostra "pensando…". Teste de `room-core` cobre as faixas com `Rng` semeado.
8. Com a aba em segundo plano, quando vira sua vez: o título alterna "● Sua vez!"; com o sino ligado e permissão
   concedida, sai uma notificação; ao focar a aba o título volta ao normal. Permissão nunca é pedida sem toque no
   sino.

**Parte B**
9. Dominó, Truco e King of Tokyo usam a mesa comum: você embaixo, demais em sentido horário, anel no jogador da
   vez; em 375 px de largura não há rolagem horizontal e a mão fica visível sem rolar.
10. Os quatro jogos mostram o histórico no painel comum; após uma jogada de outro jogador o contador de não lidas
    aumenta; abrir o painel zera.
11. Ao voltar a uma aba que ficou em segundo plano enquanto houve jogadas, aparece "N jogadas enquanto você esteve
    fora".
12. O log do dominó registra jogar (com peça e ponta), comprar (sem revelar a peça), passar e fim de rodada; nenhum
    log revela informação oculta (teste de conformidade: log idêntico para todos os jogadores).
13. Partida em andamento criada antes do deploy (log no formato antigo) continua jogável e mostra o histórico.
14. Com `prefers-reduced-motion: reduce`, nenhuma animação roda; sem ele, as animações listadas em B3 existem e
    não bloqueiam cliques.

**Parte C**
15. Dominó com compra, sem peça jogável: o monte destaca e um toque nele compra 1 peça (o botão faz o mesmo); a
    peça nova aparece destacada na mão. Nada é comprado sem ação do jogador.
16. O monte aparece como fileira de peças viradas igual à quantidade restante (e o selo com o número); diminui para
    todos quando alguém compra; não aparece no modo bloqueio.

**Parte D**
17. King of Tokyo mostra o tabuleiro de Tóquio com o monstro em Tóquio Cidade (e Baía com 5+ monstros vivos), monstros
    nos assentos com vida/pontos/energia, e o mercado com 3 miniaturas.
18. No desktop, passar o mouse sobre uma carta do mercado amplia sem deslocar o layout; no celular, tocar abre a
    carta grande e é possível comprá-la.
19. Toda arte nova (avatares, selo de bot, verso do dominó, Tóquio) é SVG próprio em estilo low poly.
