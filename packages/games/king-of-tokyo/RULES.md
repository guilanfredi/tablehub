# King of Tokyo — especificação

> Regras escritas a partir do manual da edição 2.0 (PT-BR); cartas de Poder da 1ª edição PT-BR (decisão do dono, Dúvida 2).
> Cada regra aqui deve ter um teste correspondente.
> Escopo: jogo base. Expansões (Power Up!, Halloween, cartas promocionais) ficam de fora.

## Visão geral
- **Jogadores:** 2 a 6. Cada um controla um monstro.
- **Objetivo:** ser o primeiro a ter **20 PV** (pontos de vitória) ou ser o **último monstro vivo**.
- **Recursos por jogador:** PV (começa em 0, sem máximo), Vida (começa em 10, máximo 10 salvo carta), Energia (começa em 0, sem máximo).
- **Lugares:** fora de Tóquio, **Cidade de Tóquio** e **Baía de Tóquio**. "Em Tóquio" = Cidade ou Baía.
  A Baía só existe com **5 ou 6 monstros vivos**.

## Componentes
- **6 monstros**, sem diferença de regra entre eles (só nome e cor), com os nomes do jogo: **Alienoid, Cyber Kitty, Gigazaur, Meka Dragon, Space Penguin, The King** (Dúvida 3).
- **6 dados pretos** e **2 dados verdes** (os verdes só entram por carta, ver "Cabeça Extra"). Faces de cada dado: `1`, `2`, `3`, `energia`, `garra` (ataque), `coração` (cura).
- **66 cartas de Poder**: nome, custo em energia, tipo **Constante** (fica com o dono) ou **Descarte** (efeito imediato e vai para o descarte). Catálogo no fim deste arquivo.
- **Fichas:** 1 Imitador, 12 Encolhido, 12 Envenenado. Cargas da Nuvem de Fumaça e energia da Bateria de Monstros ficam sobre as cartas. Energia é ilimitada (o banco não acaba).

## Preparação
1. Cada jogador recebe um monstro (ordem dos assentos da sala), 10 de Vida, 0 PV, 0 energia.
2. Baralho de Poder embaralhado com o `Rng`; as 3 primeiras cartas ficam reveladas na **vitrine**.
3. Ninguém começa em Tóquio.
4. **Primeiro jogador:** o manual manda todos rolarem os dados e começar quem tirar mais garras (desempate rolando de novo).
   O motor simula isso com o `Rng` (rolagens registradas no log para todos verem). A ordem segue os assentos a partir dele.

## Turno (5 passos)
### 1. Rolar os dados
- Até **3 rolagens** por turno (cartas podem dar rolagens extras). A 1ª rolagem usa todos os dados do monstro: 6 pretos, +1 verde por "Cabeça Extra", −1 por ficha de Encolhido, −1 por turno extra encadeado de "Congelar o Tempo" (mínimo 0 dados).
- Entre rolagens o jogador escolhe quais dados **guardar**; os demais são rolados. Dados guardados podem ser soltos e rolados de novo numa rolagem seguinte.
- O jogador pode **parar** a qualquer momento após a 1ª rolagem. Acabadas as rolagens, o resultado é definitivo (salvo cartas que mudam dados: Espreitador, Chefe do Rebanho, Alongado, Reviravolta, Sonda Psíquica).
- Ações: `roll { keep: number[] }` (índices dos dados guardados; a 1ª rolagem ignora `keep`) e `resolve` (parar e resolver).

### 2. Resolver os dados
Todos os resultados são resolvidos de uma vez, nesta ordem fixa (o manual deixa o jogador escolher a ordem, mas no jogo base o resultado não depende dela):
1. **Números:** para cada número com 3+ dados iguais, ganha PV igual ao número; cada dado além do terceiro dá +1 PV. Ex.: `1 1 1 1` = 2 PV; `2 2 2` = 2 PV; `3 3 3 3 3` = 5 PV. Menos de 3 iguais não pontua.
2. **Energia:** +1 energia por dado de energia.
3. **Coração:** fora de Tóquio, +1 Vida por coração (sem passar do máximo). **Em Tóquio, corações não curam** (cartas ainda curam). Corações também removem fichas (ver Envenenado/Encolhido).
4. **Garras:** cada garra causa 1 de dano a cada alvo:
   - atacante **em Tóquio** → todos os monstros **fora** de Tóquio;
   - atacante **fora** de Tóquio → todos os monstros **em** Tóquio (Cidade e Baía).
   - Monstros em Tóquio não se atacam entre si. Se não há ninguém em Tóquio, as garras não causam dano (caso do 1º jogador).

### Dano e eliminação
- Vida chega a 0 → monstro **eliminado na hora**: perde todas as cartas Constantes e a energia; sai de Tóquio se estiver lá. Não joga mais (seus assentos são pulados). Exceção: "Ele Tem um Filho!".
- Ter 20 PV não salva quem chega a 0 de Vida no mesmo turno (é eliminado).
- Se a contagem de vivos cair para **4 ou menos**, quem está na **Baía sai imediatamente**; se a Cidade estiver vazia nesse momento, ele **vai para a Cidade** (sem ganhar o PV de entrada).

### Ceder Tóquio
- Só pode ceder quem **perdeu Vida por garras de outro monstro** neste resolver (dano de carta não dá direito a ceder, salvo a carta dizer).
- Cada ocupante de Tóquio atingido e vivo decide **ficar** ou **ceder**. As decisões são simultâneas (`getStatus.currentPlayers` traz todos os que devem decidir). Ação: `yield { leave: boolean }`.
- Quem cede vai para fora de Tóquio (o dano já foi sofrido; com "Jatos", o dano das garras é anulado para quem cede).

### 3. Entrar em Tóquio
- Se a **Cidade estiver vazia** (ninguém lá, porque cedeu, foi eliminado ou nunca entrou), o jogador da vez **é obrigado** a entrar na Cidade, desde que esteja fora de Tóquio.
- Com 5–6 vivos: se a Cidade está ocupada e a **Baía vazia**, o jogador da vez (fora de Tóquio) é obrigado a entrar na Baía.
- Se ambos cederam no mesmo ataque, o atacante entra **só na Cidade** e a Baía fica vazia até o próximo jogador (exemplo do manual).
- **Entrar em Tóquio dá +1 PV.**
- O monstro que já está em Tóquio no seu turno não muda de lugar (nem de Baía para Cidade, salvo a regra de "4 ou menos vivos").

### 4. Comprar cartas de Poder
- Opcional. Pode comprar quantas cartas da vitrine puder pagar. A vaga é **reposta na hora** com o topo do baralho; a carta nova pode ser comprada em seguida.
- Pode pagar **2 energia para limpar a vitrine**: as 3 cartas vão para o descarte e 3 novas são reveladas. Pode repetir enquanto tiver energia.
- Carta **Descarte**: efeito resolvido na hora; a carta vai para o descarte. Carta **Constante**: fica na frente do dono até o fim do jogo (ou até ser descartada por regra).
- **Baralho vazio:** o descarte é embaralhado (com o `Rng`) e vira o novo baralho; se o descarte também estiver vazio, a vitrine fica com menos cartas (Dúvida 5).
- Ações: `buy { cardId }`, `sweep`, `endTurn`.

### 5. Fim do turno
- Efeitos de "fim do turno" (cartas, dano de Envenenado) são aplicados.
- Turnos extras (Furor, Congelar o Tempo) acontecem antes de passar a vez.
- Passa para o próximo monstro vivo no sentido horário.

## Efeitos de estar em Tóquio (resumo)
- +1 PV ao entrar.
- **+2 PV ao começar o turno em Tóquio** (aplicado antes da 1ª rolagem; o monstro precisa estar vivo e em Tóquio).
- Corações não curam em Tóquio.
- Só se sai de Tóquio cedendo após dano de garras de outro monstro (ou pela regra da Baía / eliminação / carta).

## Fim de jogo
- Verificado **ao fim de cada turno** (e imediatamente se só restar 0 ou 1 monstro vivo).
- Vence quem estiver **vivo com 20+ PV**, ou o **único sobrevivente**.
- **Todos eliminados ao mesmo tempo:** ninguém vence (todos perdem).
- **Dois ou mais vivos com 20+ PV no mesmo fim de turno:** vitória compartilhada entre eles (Dúvida 6).
- Uma carta de Poder não pode levar a Vida acima do máximo (10, ou 12 com "Ainda Maior").
- `getStatus.scores`: PV de cada jogador; eliminados marcados.

## Informação oculta
- **Ocultos para todos:** ordem do baralho de Poder e o estado do `Rng`.
- **Público:** dados (valores e quais estão guardados), Vida, PV, energia, cartas Constantes, fichas e cargas de todos, vitrine, quantidade de cartas no baralho e no descarte (e o conteúdo do descarte), quem está em Tóquio, log.
- "Criado no Laboratório" permite ao dono **ver o topo do baralho** durante sua compra: só a view do dono, só nesse momento, inclui essa carta. `leakCheck` deve cobrir isso.

## Opções
| chave | valores | padrão | efeito |
|---|---|---|---|
| `powerCards` | boolean | `true` | `false` = jogo só com dados (sem vitrine nem compra). Útil para iniciantes. |

(PV para vencer e Vida inicial são fixos no manual — 20 e 10 — e não viram opção.)

## Janelas de decisão fora do turno
Além do `yield`, algumas cartas pedem decisão de outro jogador fora do seu turno. Todas seguem o mesmo padrão: o motor abre uma janela, lista os jogadores em `currentPlayers` e espera as respostas antes de continuar.
- **Asas:** quando um monstro com Asas, sem a proteção ativa e com 2+ energia, vai sofrer dano, ele decide se paga 2 para não sofrer dano **até o fim do turno atual** (inclusive o dano que abriu a janela).
- **Oportunista:** quando uma carta nova é revelada na vitrine durante o turno de outro, o dono pode comprá-la na hora (vários Oportunistas, inclusive via Imitador: a vez segue o sentido horário a partir do jogador da vez).
- **Raio de Cura:** o dono decide quantos corações usa para curar cada outro monstro; quem recebe paga 2 energia por Vida curada (ou o que tiver). O monstro curado não pode recusar.
- **Sonda Psíquica:** depois de cada rolagem do jogador da vez, o dono pode rerrolar 1 dado dele (1 vez por turno de cada outro monstro).
- **Cura Rápida** (pagar 2 energia: +1 Vida) só pode ser usada no próprio turno e dentro das janelas acima (`yield`, Asas, Oportunista, Raio de Cura, Sonda Psíquica) em que o dono já esteja; nenhuma janela é aberta só para ela (Dúvida 7).
- Para não travar a partida, toda janela só abre se o jogador tiver uma decisão possível (ex.: energia suficiente). Recomenda-se um limite de tempo de interface, mas o motor não decide pelo jogador.

## Fichas
- **Envenenado:** no fim do turno do envenenado, ele sofre 1 de dano por ficha. Cada coração (fora de Tóquio) pode remover 1 ficha em vez de curar.
- **Encolhido:** o monstro rola 1 dado a menos por ficha. Remoção igual ao Envenenado.
- As fichas ficam mesmo que a carta que as deu seja descartada. **Em Tóquio não dá para removê-las** (corações não funcionam lá).
- **Imitador:** se a carta copiada sai de jogo, o Imitador fica sem efeito e a ficha volta ao dono, que pode recolocá-la pagando 1 no início do próximo turno.

## Arte e apresentação (decisões do dono, Dúvidas 1 e 3)
- **Cartas de Poder usam a imagem da carta escaneada** do zip da 1ª edição (`manuals/King of Tokyo/king_of_tokyo_cartas_pt_br_1_edicao_125616.zip`, 8 PDFs com 7–9 cartas por folha; retângulos vermelhos são vagas vazias).
  - O Dev recorta cada carta e salva em `apps/web/public/games/king-of-tokyo/cards/<id>.webp` (o `id` do catálogo; as duplicadas usam a mesma imagem → 64 arquivos). Largura sugerida ~300 px, qualidade suficiente para ler o texto ao ampliar; tamanho total alvo < 3 MB.
  - Os PDFs são imagens escaneadas: o recorte pode ser feito com um script local (ex.: Node/`pdftoppm` + `sharp`), que não precisa entrar no repositório. O repositório é público e o dono aceitou publicar essas imagens.
  - A interface mostra a imagem da carta na vitrine e nas Constantes; tocar/clicar amplia. O nome, custo e efeito do catálogo também ficam no componente como texto (`alt`/legenda) para acessibilidade e para quando a imagem não carregar.
  - O registro do motor (`id`, nome, custo, tipo) vem do catálogo abaixo, não da imagem.
- **Monstros:** nomes do jogo (Componentes). O zip não traz arte dos monstros: retratos em SVG próprio, um por monstro, com a cor do jogador.

## Catálogo das cartas de Poder (1ª edição PT-BR, 66 cartas)
Conferido nas cartas do zip. Nomes como impressos; efeitos resumidos com palavras próprias.
**D** = Descarte (18), **C** = Constante (48). `id` = identificador no motor e nome do arquivo de imagem.

### Descarte (18)
| id | carta | custo | efeito |
|---|---|---|---|
| `lojinha-da-esquina` | Lojinha da Esquina | 3 | +1 PV |
| `trem-metropolitano` | Trem Metropolitano | 4 | +2 PV |
| `predio-residencial` | Prédio Residencial | 5 | +3 PV |
| `arranha-ceu` | Arranha-céu | 6 | +4 PV |
| `vindo-do-alto` | Vindo do Alto | 5 | +2 PV e assume a Cidade de Tóquio se não estiver em Tóquio (quem estava na Cidade sai sem sofrer dano; o comprador não ganha o +1 PV de entrada) |
| `energizar` | Energizar | 8 | +9 energia |
| `ordens-de-evacuacao` (×2) | Ordens de Evacuação | 7 | cada outro monstro perde 5 PV (mínimo 0) |
| `rajada-de-fogo` | Rajada de Fogo | 3 | 2 de dano em cada outro monstro |
| `furor` | Furor | 7 | joga um turno extra logo depois deste |
| `refinaria-de-gas` | Refinaria de Gás | 6 | +2 PV e 3 de dano em cada outro monstro |
| `cura` | Cura | 3 | +2 Vida |
| `bombardeio-das-alturas` | Bombardeio das Alturas | 4 | 3 de dano em **todos**, inclusive o comprador |
| `avioes-de-combate` | Aviões de Combate | 5 | +5 PV e o comprador sofre 4 de dano |
| `guarda-nacional` | Guarda Nacional | 3 | +2 PV e o comprador sofre 2 de dano |
| `usina-de-energia-nuclear` | Usina de Energia Nuclear | 6 | +2 PV e +3 Vida |
| `tanques` | Tanques | 4 | +4 PV e o comprador sofre 3 de dano |
| `tempestade-gigante` | Tempestade Gigante | 6 | +2 PV; cada outro monstro perde 1 energia para cada 2 que tiver (arredondado para baixo) |

### Constante (48)
| id | carta | custo | efeito |
|---|---|---|---|
| `acumulador-de-energia` | Acumulador de Energia | 3 | no fim do seu turno, +1 PV para cada 6 energia que tiver |
| `ainda-maior` | Ainda Maior | 4 | Vida máxima +2; ao comprar, +2 Vida. Se a carta sair, a Vida acima de 10 é cortada |
| `alongado` | Alongado | 3 | paga 2 energia: muda um dado seu para qualquer face (repetível, na fase de rolagem) |
| `amigo-das-criancas` | Amigo das Crianças | 3 | +1 energia extra a cada vez que ganhar energia (por evento, não por ponto) |
| `armadura-blindada` | Armadura Blindada | 4 | ignora o dano quando o total de um efeito é exatamente 1 |
| `asas` | Asas | 6 | paga 2 energia: não sofre dano até o fim do turno atual (ver Janelas) |
| `ataque-de-acido` | Ataque de Ácido | 6 | +1 de dano no ataque de cada turno seu, mesmo sem garras (com 0 garras, causa 1 de dano aos alvos normais de garras) |
| `bateria-de-monstros` | Bateria de Monstros | 2 | ao comprar, o dono move quanta energia quiser da reserva para a carta e o banco põe o mesmo valor; no início de cada turno do dono, 2 (ou o que restar) voltam para a reserva; vazia → descarta |
| `cabeca-extra` (×2) | Cabeça Extra | 7 | +1 dado (verde) |
| `camuflagem` | Camuflagem | 3 | ao sofrer dano, rola 1 dado por ponto de dano (via `Rng`, no log); cada coração anula 1 ponto |
| `cauda-com-pontas` | Cauda com Pontas | 5 | +1 de dano ao atacar |
| `cerdas-envenenadas` | Cerdas Envenenadas | 3 | pontuar `2 2 2` também causa 2 de dano aos alvos normais de garras |
| `cerebro-gigante` | Cérebro Gigante | 5 | +1 rolagem por turno |
| `chefe-do-rebanho` | Chefe do Rebanho | 3 | 1 vez por turno, muda um dado seu para `1` |
| `congelar-o-tempo` | Congelar o Tempo | 5 | ao pontuar `1 1 1`, joga um turno extra com 1 dado a menos (cumulativo se repetir no turno extra; volta ao normal no próximo turno comum) |
| `criado-no-laboratorio` | Criado no Laboratório | 2 | durante a sua compra, vê o topo do baralho e pode comprá-lo pelo custo normal |
| `cura-rapida` | Cura Rápida | 3 | paga 2 energia: +1 Vida (quando: ver Janelas) |
| `cuspe-envenenado` | Cuspe Envenenado | 4 | ao causar dano, dá 1 ficha Envenenado a cada monstro atingido |
| `destruicao-total` | Destruição Total | 3 | resolver com pelo menos um dado de cada face (`1 2 3` energia garra coração) dá +9 PV, além dos efeitos normais |
| `devorador-de-mortos` | Devorador de Mortos | 4 | +3 PV a cada vez que um monstro chega a 0 de Vida |
| `ele-so-esta-ficando-mais-forte` | Ele Só Está Ficando Mais Forte | 3 | ao perder 2+ de Vida de uma vez, +1 energia |
| `ele-tem-um-filho` | Ele Tem um Filho! | 7 | ao chegar a 0 de Vida: descarta todas as suas cartas (inclusive esta), perde todos os PV e a energia, sai de Tóquio e volta com 10 de Vida; não é eliminado (mas conta como "chegar a 0" para Devorador de Mortos) |
| `equipe-exclusiva-de-jornalismo` | Equipe Exclusiva de Jornalismo | 3 | +1 PV a cada carta comprada depois desta |
| `escavando` | Escavando | 5 | +1 de dano ao atacar estando em Tóquio; ao ceder Tóquio, causa 1 de dano a quem entra no seu lugar |
| `espreitador` | Espreitador | 4 | pode rerrolar dados com face `3` na fase de rolagem, inclusive após a última rolagem, sem gastar rolagem (repetível) |
| `energia-solar` | Energia Solar | 2 | no fim do seu turno, se tiver 0 energia, +1 |
| `gourmet` | Gourmet | 4 | pontuar `1 1 1` dá +2 PV extras |
| `halito-de-supernova` | Hálito de Supernova | 7 | suas garras atingem todos os outros monstros, onde quer que estejam |
| `herbivoro` | Herbívoro | 5 | +1 PV no fim do seu turno se não causou dano a ninguém nele |
| `imitador` | Imitador | 8 | coloca a ficha de imitação numa Constante de qualquer monstro e funciona como cópia dela; no início do seu turno pode pagar 1 energia para mudar a ficha |
| `jatos` | Jatos | 5 | não sofre o dano das garras quando decide ceder Tóquio |
| `metabolismo-alienigena` | Metabolismo Alienígena | 3 | cartas custam 1 energia a menos (mínimo 0; não vale para limpar a vitrine) |
| `metamorfose` | Metamorfose | 3 | no fim do seu turno, pode descartar Constantes suas e receber o custo impresso de cada em energia |
| `monstro-alfa` | Monstro Alfa | 5 | +1 PV ao atacar (resolver 1+ garras) |
| `nuvem-de-fumaca` | Nuvem de Fumaça | 4 | começa com 3 cargas; gaste 1 carga por rolagem extra; sem cargas → descarta |
| `onivoro` | Onívoro | 4 | 1 vez por turno, `1 2 3` vale 2 PV; os mesmos dados ainda contam para outras combinações |
| `oportunista` | Oportunista | 3 | sempre que uma carta nova é revelada na vitrine, pode comprá-la na hora (ver Janelas) |
| `raio-de-cura` | Raio de Cura | 4 | pode usar seus corações para curar outros monstros, que pagam 2 energia por Vida curada (ou o que tiverem) |
| `raio-de-encolhimento` | Raio de Encolhimento | 6 | ao causar dano, dá 1 ficha Encolhido a cada monstro atingido |
| `regeneracao` | Regeneração | 4 | ao se curar, +1 Vida extra (por evento de cura) |
| `reviravolta` | Reviravolta | 3 | muda um dado seu para qualquer face; descarta ao usar |
| `sonda-psiquica` | Sonda Psíquica | 3 | 1 vez no turno de cada outro monstro, rerrola 1 dado dele; se sair coração, descarta esta carta |
| `sopro-de-fogo` | Sopro de Fogo | 4 | ao causar dano, os vizinhos de assento vivos (esquerda e direita) sofrem 1 de dano extra, mesmo estando no mesmo lugar; com 2 vivos, o adversário sofre só 1 extra |
| `telepata` | Telepata | 4 | paga 1 energia: +1 rolagem (repetível) |
| `tentaculos-parasiticos` | Tentáculos Parasíticos | 4 | na sua compra, pode comprar Constantes de outros monstros pagando o custo a eles |
| `torcendo-pelo-azarao` | Torcendo pelo Azarão | 3 | no fim de qualquer turno, se tiver estritamente menos PV que cada outro monstro vivo, +1 PV |
| `urbanivoro` | Urbanívoro | 4 | +1 PV ao começar o turno em Tóquio; +1 de dano ao causar qualquer dano estando em Tóquio |

Diferenças em relação ao rascunho anterior (reconstruído da 2.0): "Jogar um Petroleiro" não existe nesta edição; "Asas" protege até o fim do turno (não só um efeito); "Bateria de Monstros" dobra a energia que o dono coloca; vários nomes mudaram (ex.: "Espreitador", "Vindo do Alto", "Criado no Laboratório", "Hálito de Supernova").

## Dúvidas (todas resolvidas pelo dono em 2026-10-12)
1. **Arte das cartas** — ✅ usar as cartas recortadas dos PDFs, mesmo com o repositório público. Ver "Arte e apresentação".
2. **Conjunto de cartas** — ✅ cartas do zip (1ª edição PT-BR); o catálogo acima foi conferido nelas. Regras do turno seguem o manual 2.0 (iguais à 1ª edição no que importa ao motor).
3. **Nomes dos monstros** — ✅ nomes do jogo (Alienoid, Cyber Kitty, Gigazaur, Meka Dragon, Space Penguin, The King).
4. **Entrega** — ✅ tudo no mesmo PR (núcleo + todas as cartas, inclusive as de janela de reação). Sugestão de ordem para o Dev: núcleo com `powerCards=false`, depois cartas simples, depois janelas.
5. **Baralho de Poder acaba** — ✅ embaralhar o descarte.
6. **Dois ou mais vivos com 20+ PV no mesmo fim de turno** — ✅ vitória compartilhada.
7. **"A qualquer momento"** (Cura Rápida) — ✅ no próprio turno e nas janelas de reação já existentes.

## Critérios de aceite
1. Setup: 2–6 jogadores; todos com 10 Vida, 0 PV, 0 energia; vitrine com 3 cartas (ou nenhuma com `powerCards=false`); ninguém em Tóquio; ordem determinística pela semente; monstros com os nomes do jogo.
2. Rolagens: no máximo 3 (sem cartas); dados guardados não mudam; `resolve` antes da 3ª encerra as rolagens; 1ª rolagem usa 6 dados (+1 por Cabeça Extra, −1 por Encolhido).
3. Pontuação de números: `1 1 1`=1, `1 1 1 1`=2, `2 2 2`=2, `3 3 3 3 3`=5, `2 2 3 3 1 1`=0.
4. Energia: +1 por dado de energia.
5. Cura: fora de Tóquio +1 por coração, limitada a 10; em Tóquio corações não curam.
6. Garras: de fora atingem só quem está em Tóquio (Cidade e Baía); de dentro atingem todos de fora; ninguém em Tóquio → sem dano.
7. Eliminação: Vida 0 elimina na hora, descarta Constantes e energia, sai de Tóquio, assento é pulado.
8. Ceder: só quem sofreu dano de garras pode ceder; atacante entra no lugar cedido e ganha +1 PV; ambos cedendo → atacante vai para a Cidade e a Baía fica vazia.
9. Entrada obrigatória: Cidade vazia no passo 3 → jogador da vez entra; com 5–6 vivos e Baía vazia (Cidade ocupada) → entra na Baía.
10. +2 PV ao começar o turno em Tóquio.
11. Cair para 4 vivos: ocupante da Baía sai na hora e vai para a Cidade se ela estiver vazia.
12. Compra: custo debitado, vaga reposta na hora; limpar vitrine custa 2; energia insuficiente → erro em português.
13. Baralho vazio na reposição → descarte embaralhado vira baralho (determinístico pela semente); ambos vazios → vitrine com menos cartas, sem erro.
14. Fim: vivo com 20+ PV ao fim do turno vence; dois ou mais com 20+ → todos vencem; último sobrevivente vence; 20 PV e 0 Vida no mesmo turno → eliminado; todos eliminados → sem vencedor.
15. O catálogo do motor tem exatamente 66 cartas (48 C, 18 D, com Ordens de Evacuação e Cabeça Extra em dobro), com nome e custo iguais à tabela; cada carta tem pelo menos um teste do efeito.
16. Janelas: Asas, Oportunista, Raio de Cura e Sonda Psíquica abrem só para quem pode decidir, listam o jogador em `currentPlayers` e a partida segue depois da resposta; Cura Rápida é aceita no próprio turno e dentro dessas janelas, e recusada (erro em português) fora delas.
17. View: ordem do baralho nunca aparece; topo só para o dono de "Criado no Laboratório" durante a compra dele.
18. `runConformance` com `requireFinish: true`, com e sem `powerCards`.
19. Imagens: existe `apps/web/public/games/king-of-tokyo/cards/<id>.webp` para cada `id` do catálogo; a vitrine e as Constantes mostram a imagem, com nome/custo/efeito como texto alternativo; tocar amplia a carta.
20. Interface no celular (375×812): dados com toque para guardar, botões de rolar/parar, Tóquio com Cidade e Baía, painel de cada monstro (retrato SVG, nome, Vida, PV, energia, cartas, fichas), vitrine legível ao ampliar, janelas de ceder/Asas/Oportunista/Sonda visíveis para quem decide.
