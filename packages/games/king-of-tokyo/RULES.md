# King of Tokyo — especificação

> Escrita a partir do manual da edição 2.0 (PT-BR). Cada regra aqui deve ter um teste correspondente.
> Escopo: jogo base. Expansões (Power Up!, Halloween, cartas promocionais) ficam de fora.

## Visão geral
- **Jogadores:** 2 a 6. Cada um controla um monstro.
- **Objetivo:** ser o primeiro a ter **20 PV** (pontos de vitória) ou ser o **último monstro vivo**.
- **Recursos por jogador:** PV (começa em 0, sem máximo), Vida (começa em 10, máximo 10 salvo carta), Energia (começa em 0, sem máximo).
- **Lugares:** fora de Tóquio, **Cidade de Tóquio** e **Baía de Tóquio**. "Em Tóquio" = Cidade ou Baía.
  A Baía só existe com **5 ou 6 monstros vivos**.

## Componentes
- **6 monstros**, sem diferença de regra entre eles (só nome e cor). Ver Dúvida 3 sobre nomes e arte.
- **6 dados pretos** e **2 dados verdes** (os verdes só entram por carta, ver "Cabeça Extra"). Faces de cada dado: `1`, `2`, `3`, `energia`, `garra` (ataque), `coração` (cura).
- **66 cartas de Poder**: nome, custo em energia, tipo **Constante** (fica com o dono) ou **Descarte** (efeito imediato e vai para o descarte). Catálogo no fim deste arquivo.
- **Fichas:** 3 Fumaça, 1 Imitador, 12 Encolhido, 12 Envenenado. Energia é ilimitada (o banco não acaba).

## Preparação
1. Cada jogador recebe um monstro (ordem dos assentos da sala), 10 de Vida, 0 PV, 0 energia.
2. Baralho de Poder embaralhado com o `Rng`; as 3 primeiras cartas ficam reveladas na **vitrine**.
3. Ninguém começa em Tóquio.
4. **Primeiro jogador:** o manual manda todos rolarem os dados e começar quem tirar mais garras (desempate rolando de novo).
   O motor simula isso com o `Rng` (rolagens registradas no log para todos verem). A ordem segue os assentos a partir dele.

## Turno (5 passos)
### 1. Rolar os dados
- Até **3 rolagens** por turno (cartas podem dar rolagens extras). A 1ª rolagem usa todos os dados do monstro: 6 pretos, +1 verde por "Cabeça Extra", −1 por ficha de Encolhido (mínimo 0 dados).
- Entre rolagens o jogador escolhe quais dados **guardar**; os demais são rolados. Dados guardados podem ser soltos e rolados de novo numa rolagem seguinte.
- O jogador pode **parar** a qualquer momento após a 1ª rolagem. Acabadas as rolagens, o resultado é definitivo.
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
- Vida chega a 0 → monstro **eliminado na hora**: perde todas as cartas Constantes e a energia; sai de Tóquio se estiver lá. Não joga mais (seus assentos são pulados).
- Eliminado ≠ derrotado imediatamente em PV: ter 20 PV não salva quem chega a 0 de Vida no mesmo turno (é eliminado).
- Se a contagem de vivos cair para **4 ou menos**, quem está na **Baía sai imediatamente**; se a Cidade estiver vazia nesse momento, ele **vai para a Cidade** (sem ganhar o PV de entrada).

### Ceder Tóquio
- Só pode ceder quem **perdeu Vida por garras de outro monstro** neste resolver (dano de carta não dá direito a ceder, salvo a carta dizer).
- Cada ocupante de Tóquio atingido e vivo decide **ficar** ou **ceder**. As decisões são simultâneas (`getStatus.currentPlayers` traz todos os que devem decidir). Ação: `yield { leave: boolean }`.
- Quem cede vai para fora de Tóquio (o dano já foi sofrido).

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
- **Baralho vazio:** ver Dúvida 5.
- Ações: `buy { cardId }`, `sweep`, `endTurn`.

### 5. Fim do turno
- Efeitos de "fim do turno" (cartas, dano de Envenenado) são aplicados.
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
- Mais de um vivo com 20+ PV no mesmo fim de turno: ver Dúvida 6.
- Uma carta de Poder não pode levar a Vida acima do máximo (10, ou 12 com "Ainda Maior").
- `getStatus.scores`: PV de cada jogador; eliminados marcados.

## Informação oculta
- **Ocultos para todos:** ordem do baralho de Poder e o estado do `Rng`.
- **Público:** dados (valores e quais estão guardados), Vida, PV, energia, cartas Constantes e fichas de todos, vitrine, quantidade de cartas no baralho e no descarte (e o conteúdo do descarte), quem está em Tóquio, log.
- "Feito em Laboratório" permite ao dono **ver o topo do baralho** durante sua compra: só a view do dono, só nesse momento, inclui essa carta. `leakCheck` deve cobrir isso.

## Opções
| chave | valores | padrão | efeito |
|---|---|---|---|
| `powerCards` | boolean | `true` | `false` = jogo só com dados (sem vitrine nem compra). Útil para iniciantes e para entregar o motor em etapas. |

(PV para vencer e Vida inicial são fixos no manual — 20 e 10 — e não viram opção.)

## Janelas de decisão fora do turno
Além do `yield`, algumas cartas pedem decisão de outro jogador ou do dono fora do seu turno. Todas seguem o mesmo padrão: o motor abre uma janela, lista os jogadores em `currentPlayers` e espera as respostas antes de continuar.
- **Asas:** quando um monstro com Asas e 2+ energia vai sofrer dano, ele decide se paga 2 para anular **todo** o dano daquele efeito.
- **Oportunista:** quando uma carta nova é revelada na vitrine durante o turno de outro, o dono pode comprá-la na hora (vários Oportunistas: a vez segue o sentido horário a partir do jogador da vez, como diz o manual).
- **Raio Curador:** quem recebe cura paga ao curador.
- **Sonda Psíquica:** o dono escolhe um dado do jogador da vez para rerrolar.

## Catálogo das cartas de Poder (edição 2.0) — **RASCUNHO A CONFERIR** (ver Dúvida 2)
Reconstruído sem acesso às cartas (o arquivo de cartas recebido é da 1ª edição e não pôde ser aberto nesta sessão).
Nomes em português provisórios, salvo os confirmados pelo manual (✔). Efeitos com palavras próprias.

### Descarte (18)
| carta | custo | efeito |
|---|---|---|
| Prédio de Apartamentos | 5 | +3 PV |
| Trem Urbano | 4 | +2 PV |
| Loja da Esquina | 3 | +1 PV |
| Entrando do Alto ✔ (custo 5 no manual) | 5 | +2 PV e assume a Cidade de Tóquio se não estiver em Tóquio (quem estava lá sai, sem ganhar nada) |
| Energizar | 8 | +9 energia |
| Ordem de Evacuação (×2) | 7 | todos os outros perdem 5 PV (mínimo 0) |
| Explosão de Fogo | 3 | 2 de dano em todos os outros |
| Frenesi | 7 | joga mais um turno logo após este |
| Refinaria de Gás | 6 | +2 PV e 3 de dano em todos os outros |
| Curar | 3 | +2 Vida |
| Bombardeio de Grande Altitude | 4 | 3 de dano em **todos**, inclusive você |
| Caças | 5 | +5 PV e você sofre 4 de dano |
| Guarda Nacional | 3 | +2 PV e você sofre 2 de dano |
| Usina Nuclear | 6 | +2 PV e +3 Vida |
| Arranha-céu | 6 | +4 PV |
| Tanques | 4 | +4 PV e você sofre 3 de dano |
| Tempestade | 6 | +2 PV; cada outro perde 1 energia para cada 2 que tiver |

### Constante (49 cartas — com as 18 de Descarte o rascunho soma 67, uma a mais que as 66 do jogo; sobra uma a confirmar)
| carta | custo | efeito |
|---|---|---|
| Ataque Ácido | 6 | causa 1 dano extra a cada turno, mesmo sem garras |
| Metabolismo Alienígena | 3 | cartas custam 1 a menos |
| Monstro Alfa | 5 | +1 PV quando ataca |
| Blindagem | 4 | ignora dano de exatamente 1 |
| Morador do Fundo | 4 | pode rerrolar dados com `3` (sem contar rolagem) |
| Escavador | 5 | +1 dano quando ataca em Tóquio; causa 1 dano a quem entra quando você cede |
| Camuflagem | 3 | ao sofrer dano, rola 1 dado por ponto de dano; cada coração anula 1 |
| Destruição Total | 3 | rolar `1 2 3 energia garra coração` (um de cada) dá +9 PV |
| Equipe de Reportagem | 3 | +1 PV a cada carta comprada |
| Devorador dos Mortos | 4 | +3 PV sempre que um monstro é eliminado |
| Acumulador de Energia | 3 | no fim do seu turno, +1 PV para cada 6 energia |
| Ainda Maior | 4 | Vida máxima +2; ao comprar, +2 Vida |
| Cabeça Extra (×2) | 7 | +1 dado (verde) |
| Sopro de Fogo ✔ | 4 | ao causar dano, os vizinhos de assento (esquerda e direita, vivos) sofrem 1 de dano extra mesmo estando no mesmo lugar; com 2 vivos, o adversário sofre só 1 |
| Congelar o Tempo | 5 | ao pontuar `1 1 1`, joga mais um turno com 1 dado a menos |
| Amigo das Crianças | 3 | +1 energia sempre que ganha energia |
| Cérebro Gigante | 5 | +1 rolagem por turno |
| Gourmet | 4 | `1 1 1` dá +2 PV extras |
| Raio Curador | 4 | pode usar seus corações para curar outros; eles pagam 2 energia por Vida (ou tudo o que tiverem) |
| Herbívoro | 5 | +1 PV no fim do turno em que não causou dano |
| Abate do Rebanho | 3 | 1 vez por turno, troca um dado para `1` |
| Ele Tem um Filhote | 7 | ao ser eliminado: descarta todas as cartas, perde todos os PV e volta com 10 de Vida |
| Jatos | 5 | não sofre dano ao ceder Tóquio |
| Feito em Laboratório | 2 | ao comprar, pode ver e comprar o topo do baralho |
| Metamorfose ✔ | 3 | no fim do turno, pode descartar Constantes e receber de volta o custo **impresso** de cada |
| Imitador ✔ | 8 | ficha numa Constante de qualquer monstro; funciona como cópia dela; 1 energia no início do turno muda a ficha |
| Baterias de Monstro | 2 | ao comprar, põe 6 energia do banco nela; no início do turno tira 2; vazia → descarta |
| Sopro Nova | 7 | suas garras atingem todos os outros monstros |
| Onívoro | 4 | 1 vez por turno, `1 2 3` vale 2 PV (os dados ainda contam para outras combinações) |
| Oportunista ✔ | 3 | pode comprar cada carta nova assim que é revelada |
| Tentáculos Parasitas | 4 | pode comprar Constantes de outros monstros, pagando o custo a eles |
| Reviravolta | 3 | troca um dado por qualquer face; descarta ao usar |
| Espinhos Venenosos | 3 | `2 2 2` também causa 2 de dano |
| Cuspe Envenenado ✔ | 4 | ao causar dano com garras, dá 1 ficha Envenenado a cada atingido |
| Sonda Psíquica | 3 | 1 vez por turno de cada outro, rerrola 1 dado dele; se sair coração, descarta esta carta |
| Cura Rápida | 3 | pague 2 energia a qualquer momento: +1 Vida |
| Regeneração | 4 | ao se curar, +1 Vida extra |
| Torcida pelo Azarão | 3 | no fim do turno, se tiver menos PV que todos, +1 PV |
| Raio de Encolhimento ✔ | 6 | ao causar dano com garras, dá 1 ficha Encolhido a cada atingido |
| Nuvem de Fumaça | 4 | começa com 3 fichas de Fumaça; gaste 1 por rolagem extra; sem fichas → descarta |
| Energia Solar | 2 | no fim do turno, se tiver 0 energia, +1 |
| Cauda com Espinhos | 5 | +1 dano quando ataca |
| Elástico | 3 | pague 2 energia: troca um dado por qualquer face |
| Telepata | 4 | pague 1 energia: +1 rolagem |
| Urbívoro | 4 | +1 PV ao começar o turno em Tóquio; +1 dano ao atacar de Tóquio |
| Isso Só Nos Fortalece | 3 | ao perder 2+ Vida de uma vez, +1 energia |
| Asas | 6 | pague 2 energia: anula o dano de um efeito |
| Jogar um Petroleiro | 4 | +2 PV no turno em que causar 3+ de dano |

### Fichas (regras confirmadas no manual)
- **Envenenado:** no fim do turno do envenenado, ele sofre 1 de dano por ficha. Cada coração (fora de Tóquio) pode remover 1 ficha em vez de curar.
- **Encolhido:** o monstro rola 1 dado a menos por ficha. Remoção igual ao Envenenado.
- As fichas ficam mesmo que a carta que as deu seja descartada. **Em Tóquio não dá para removê-las** (corações não funcionam lá).
- **Imitador:** se a carta copiada sai de jogo, o Imitador fica sem efeito e a ficha volta ao dono, que pode recolocá-la pagando 1 no início do próximo turno.
- **Oportunista ×2** (via Imitador): o primeiro em sentido horário a partir do jogador da vez tem preferência.

## Dúvidas
1. **Arte das cartas e dos monstros** — a issue pede recortar as cartas dos PDFs e usá-las como assets. Isso contraria a regra do repositório ("Arte própria (SVG); nunca usar assets protegidos de jogos comerciais") e o repositório é público: as imagens ficariam publicadas. **Recomendação:** cartas desenhadas pelo próprio app (moldura SVG + nome, custo, tipo e efeito em texto próprio) e monstros com silhuetas SVG próprias. *Pendente.*
2. **Conjunto de cartas** — o manual é da edição 2.0, mas o arquivo de cartas é da 1ª edição (as duas têm cartas diferentes), e a sessão automática não tem permissão para abrir o zip. **Recomendação:** usar as cartas da 2.0 (combinam com o manual); preciso da lista oficial de nome/custo/efeito para fechar o catálogo acima (ou permissão para ler o zip, se a escolha for a 1ª edição). *Pendente.*
3. **Nomes dos monstros** — usar os nomes do jogo (Gigazaur, Cyber Kitty, Space Penguin, The King, Meka Dragon, Alienoid) ou nomes próprios? **Recomendação:** nomes próprios genéricos (ex.: Lagartão, Robogato, Pinguim Espacial, Gorilão, Dragomeca, Alienzinho), alinhado à Dúvida 1. *Pendente.*
4. **Entrega em etapas** — 66 cartas com janelas de reação (Asas, Oportunista, Sonda Psíquica…) é a maior parte do trabalho. **Recomendação:** um único PR, mas o Dev implementa primeiro o núcleo (opção `powerCards=false`) e depois as cartas; se o dono preferir, as cartas com janela de reação ficam para um 2º PR. *Pendente.*
5. **Baralho de Poder acaba** — o manual não diz. **Recomendação:** embaralhar o descarte e formar um novo baralho; se também estiver vazio, a vitrine fica com menos cartas. *Decisão do analista, salvo objeção.*
6. **Dois ou mais vivos com 20+ PV no mesmo fim de turno** (possível com Devorador dos Mortos, Monstro Alfa…) — o manual não diz. **Recomendação:** vitória compartilhada entre eles. *Decisão do analista, salvo objeção.*
7. **Momento de "a qualquer momento"** (Cura Rápida) — **Recomendação:** permitido no próprio turno e em qualquer janela de decisão em que o dono esteja (`yield`, Asas); não é preciso abrir janela extra só para isso. *Decisão do analista, salvo objeção.*

## Critérios de aceite
1. Setup: 2–6 jogadores; todos com 10 Vida, 0 PV, 0 energia; vitrine com 3 cartas (ou nenhuma com `powerCards=false`); ninguém em Tóquio; ordem determinística pela semente.
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
13. Fim: vivo com 20+ PV ao fim do turno vence; último sobrevivente vence; 20 PV e 0 Vida no mesmo turno → eliminado; todos eliminados → sem vencedor.
14. Cada carta do catálogo final tem pelo menos um teste do efeito.
15. View: ordem do baralho nunca aparece; topo só para o dono de "Feito em Laboratório" durante a compra dele.
16. `runConformance` com `requireFinish: true`, com e sem `powerCards`.
17. Interface no celular (375×812): dados com toque para guardar, botões de rolar/parar, Tóquio com Cidade e Baía, painel de cada monstro (Vida, PV, energia, cartas, fichas), vitrine com custo e efeito legíveis, janelas de ceder/Asas visíveis para quem decide.
