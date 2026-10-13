# TableHub

A TableHub é uma plataforma para pessoas se encontrarem online e jogarem boardgames juntas, dos rápidos de 10 minutos às campanhas de uma noite inteira. O design system traduz isso numa mesa de jogo à meia-luz: fundo escuro e quente, cor de madeira e âmbar, peças arredondadas e um jeito de falar de quem está chamando os amigos para jogar.

Este documento é a fonte da verdade visual do app. Valores exatos ficam em `tokens.json`; o CSS em `apps/web/src/design-system/` é gerado a partir dele.

## Personalidade

- **Acolhedora.** Ninguém chega sozinho numa mesa. A interface recebe bem quem está começando e não pune erros.
- **Playful.** Formas de carta, dado e ficha; cantos generosos; botões que parecem peças.
- **Dinâmica.** Sempre tem alguém jogando agora. Estados ao vivo (online, em andamento, falta 1) aparecem em destaque.
- **Dark mode.** O escuro é o padrão da marca, como uma sala de jogos à noite. Não existe tema claro nesta versão.

## Voz e texto

Fale como um amigo que organiza a noite de jogos: direto, caloroso, em português do Brasil, sempre em "você".

| Em vez de | Escreva |
| --- | --- |
| Criar sala | Abrir uma mesa |
| Ingressar na partida | Sentar |
| Vagas disponíveis: 1 | Falta 1 |
| Usuário conectado à sessão | Rita entrou na sua mesa de Catan. |
| Erro ao processar solicitação | Não conseguimos te sentar. A mesa encheu, tente outra. |
| Criar sala · Voltar à sala | Abrir uma mesa · Voltar à mesa |
| Código da sala | Código da mesa |
| Sala não encontrada. | Mesa não encontrada. Confira o código. |

- Botões dizem o que acontece: **Abrir uma mesa**, **Sentar**, **Assistir**, **Enviar**.
- Use o vocabulário de mesa: mesa, assento, rodada, partida, anfitrião.
- Leve sem forçar: um emoji no chat dos jogadores é ok, mas a interface em si não usa emoji.
- Números de jogadores e duração sempre no mesmo formato: `3–4 jogadores · ~60 min`.

## Cores

A paleta Taverna é quente e escura. O âmbar é a cor da marca; coral, verde-água e azul dão vida a estados e selos.

| Token | Papel |
| --- | --- |
| `bg` #1A1614 | Fundo de tudo |
| `surface` #241F1C | Cards, painéis, barra superior |
| `surface-raised` #2E2824 | Coisas dentro de um card: linhas de jogador, campos, placar |
| `line` #3A322C | Divisórias e contorno de cards |
| `line-strong` #7A6C60 | Borda de campos e opções (3:1) |
| `ink` #F5EDE3 | Texto principal |
| `ink-muted` #B3A79A | Metadados e legendas |
| `primary` #F2A93B | Ação principal, seleção, sua vez, foco |
| `primary-soft` #3A2C17 | Fundo de item selecionado e banner de informação |
| `accent` #FF6B5A | Destrutivo, erro, aviso, jogo pesado |
| `accent-soft` #3D211C | Fundo de banner de erro e selo de atenção |
| `support` #3FC1A5 | Online, pronto, em andamento |
| `support-soft` #17332C | Fundo do selo Pronto |
| `info` #8FB8FF | Links, jogo leve, avatares |
| `table` #3B2B21 · `table-edge` #2A1F18 | Tampo de madeira da mesa de jogo |

Regras:

- **Um primary por área.** Num card de mesa, só o botão **Sentar** é âmbar.
- **Texto sobre cor usa `on-primary`** (o mesmo marrom do fundo) em `primary`, `accent` e `support`. Nunca texto branco sobre âmbar.
- **Selos de estado** usam o fundo "soft" com o texto na cor cheia: `support` = Pronto, `primary` = Dono ou Sua vez, `accent` = atenção. Selo neutro: `surface-raised` com `ink-muted`.
- **Assentos** seguem a ordem `primary`, `accent`, `support`, `info`, com número ou iniciais em `on-primary`. Lugar livre: contorno tracejado em `line-strong`.
- Coral e verde-água têm luminosidade parecida. O texto do selo sempre diz o estado; a cor só reforça.
- `line` é decorativo. Bordas de campos, opções e assentos vazios usam `line-strong`.
- **Foco:** anel sólido de 3px em `primary`, afastado 2px, em todo elemento clicável.
- **Mesa de jogo:** o tampo é madeira (`table` → `table-edge`, degradê radial), não feltro verde.

## Tipografia

- **Fredoka** (títulos, 600): arredondada, lembra peças e fichas. Use com moderação, só em títulos, nome da marca e números grandes de placar.
- **Nunito** (texto, 400 e 700): leitura confortável, também arredondada, conversa com a Fredoka.

As duas são hospedadas no próprio app via `@fontsource/fredoka` e `@fontsource/nunito` (importadas em `apps/web/src/main.tsx`, só o subconjunto latino e os pesos usados), sem Google Fonts: funcionam offline no PWA. Sem a fonte, o texto cai em `system-ui`.

Escala: `display` 48, `heading-1` 32, `heading-2` 24, `heading-3` 19, `table-code` 28 (código da mesa), `body` 16, `body-strong` 16, `small` 14, `overline` 12 (caixa-alta, selos). Placar, log e contagens usam números tabulares (`font-variant-numeric: tabular-nums`).

## Espaço e forma

- Espaçamento: `space-1` 4, `space-2` 8, `space-3` 12, `space-4` 16, `space-6` 24. Cards têm padding `space-4`; blocos dentro do card ficam a `space-3`; seções a `space-6`.
- Cantos generosos: `radius-sm` 10 (campos, botões, linhas), `radius-md` 14 (cartas), `radius-lg` 20 (cards, tampo da mesa), `radius-full` (selos, assentos, toast).
- Botão primary tem `shadow-press`, uma base escura de 4px que faz ele parecer uma peça e afunda ao clicar. `shadow-float` só no que flutua (toast, zoom). Cards se separam por cor e contorno, não por sombra.
- Toque: botões e campos com pelo menos 44px de altura (34px no `btn-sm`).

## Componentes

Os estilos estão em `apps/web/src/design-system/components.css` e as variáveis em `apps/web/src/design-system/tokens.css`. Cada componente tem um guia em `docs/design-system/components/` e todos aparecem juntos em `docs/design-system/preview.html`:

- **Ações:** Button
- **Formulários:** Field, GamePicker, Switch
- **Feedback:** Badge, Banner, Toast
- **Mesa:** Card, PlayerList, StatusPill, TableTop, GameTable, History, Scoreboard, TableCode, Log

Animações são curtas (150–350 ms), nunca atrasam cliques e somem por completo com `prefers-reduced-motion`.

A classe `felt` continua funcionando e desenha o tampo de madeira; prefira `table-top` em código novo.

## Iconografia e imagens

- **Logo:** três cartas em leque (verde-água, coral e âmbar na frente, com um ponto escuro no centro), em `docs/design-system/logos/`. Em fundo escuro use `tablehub-mark.svg`; sobre âmbar, `tablehub-mark-on-amber.svg`; como favicon, ícone do PWA ou abaixo de 24px, `tablehub-app-icon.svg`.
- **Assinatura:** símbolo à esquerda e **TableHub** em Fredoka 600, `ink`, separados por 8px (classe `brand`). Sempre TableHub, com T e H maiúsculos.
- Não gire o leque, não troque a ordem das cores e não tire o contorno escuro entre as cartas.
- Formas de jogo (dado, meeple, ficha) podem aparecer como ilustração, desenhadas em blocos de cor sólida da paleta, sem gradientes.
- Ícones de interface: traço arredondado, 2px, cantos redondos, na cor do texto ao lado.

