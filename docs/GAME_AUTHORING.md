# Como adicionar um jogo ao TableHub

Todo jogo é um módulo independente que implementa `GameDefinition` (`packages/game-sdk/src/types.ts`).
A plataforma (salas, lobby, prontos, servidor, reconexão) não muda quando um jogo é adicionado.

## 1. Criar o esqueleto

```bash
npm run new-game -- <id-kebab-case> "<Nome do jogo>"
```

Gera e registra:

| arquivo | papel |
|---|---|
| `packages/games/<id>/RULES.md` | especificação das regras (fonte da verdade para os testes) |
| `packages/games/<id>/engine.ts` | motor: estado, ações, regras |
| `packages/games/<id>/<id>.test.ts` | testes de regra + bateria de conformidade |
| `apps/web/src/games/<id>/<Nome>Board.tsx` | interface (tabuleiro) |

## 2. Contrato do motor (`GameDefinition`)

| campo | regra |
|---|---|
| `optionsSchema` | parâmetros de regra (`select` / `number` / `boolean`). O lobby gera o formulário a partir daqui. `visibleWhen` esconde campos irrelevantes. |
| `rulesSummary(options, n)` | frases curtas mostradas a todos no lobby. Devem refletir as opções escolhidas. |
| `validateConfig(options, n)` | retorna mensagem de erro quando a combinação é inválida (ex.: truco só com 2 ou 4). |
| `seatLabel?(seat, options, n)` | rótulo do assento no lobby (ex.: "Dupla A"). |
| `setup({ players, options, seed })` | estado inicial. **100% JSON** (nada de `Map`, `Set`, classes, funções). |
| `getPlayerView(state, playerId \| null)` | o que cada jogador vê. **Nunca** inclua mãos, baralhos ou cartas ocultas de outros. |
| `getLegalActions(state, playerId)` | **obrigatório**. Ações válidas agora (alimenta a UI e os testes aleatórios). Para ações com infinitas combinações (ex.: troca livre), retorne um subconjunto representativo. |
| `applyAction(state, playerId, action)` | recebe **uma cópia** do estado (pode mutar). Valide tudo e retorne `{ error }` em português para jogadas inválidas. |
| `getStatus(state)` | fase, quem pode agir (`currentPlayers`), vencedores e placar. Mais de um jogador pode agir ao mesmo tempo (respostas de truco, descartes no Catan). |
| `getLog?(state)` | histórico **público** da partida (`GameLog`), mostrado no painel comum. Guarde no estado com `pushLog(s.log, texto, quemAgiu)` (últimas 60) e devolva `toGameLog(s.log)`. Nunca registre a peça comprada ou carta encoberta. |

Regras de ouro:
- **Aleatoriedade só via `Rng`** com a semente guardada no estado (`state.rng`). Nunca `Math.random()` ou `Date.now()` no motor.
- O servidor é autoritativo: o cliente nunca decide resultado.
- Mensagens e textos em **português**.

## 3. Testes obrigatórios

1. Um teste por regra do `RULES.md` (monte estados controlados para casos de borda).
2. `runConformance(def, {...})` com `requireFinish: true` sempre que partidas aleatórias consigam terminar
   (use `chooseAction` para guiar jogos longos, como no Catan). Ela verifica:
   - partidas aleatórias até o fim sem travar;
   - determinismo (replay das ações reproduz o estado);
   - estado estável em JSON;
   - ação inválida e jogador de fora são rejeitados;
   - `leakCheck` (forneça um!) — nenhuma informação oculta vaza na view;
   - com `getLog`: formato, limite de 60, total que só cresce e, com `logLeakCheck`, nada oculto no histórico.

## 4. Interface

- Recebe `game.view` (a view do jogador), `game.legal` (ações legais) e `act(action)`.
- Destaque o que é jogável a partir de `game.legal` — não reimplemente regras na UI.
- Mobile-first: teste em 375×812. Tabuleiros grandes usam `components/board/PanZoom`.
- Jogos de mesa com assentos usam `components/table/GameTableLayout` (você embaixo, demais ao redor). O tabuleiro não desenha log próprio: o histórico é o painel comum.
- Utilitários prontos: `game-sdk/hexgrid` (tabuleiros hexagonais), `PlayingCard` (truco), `DominoTile`.
- Arte própria (SVG). Nunca use arte, logotipos ou textos protegidos dos jogos comerciais.
- Segue o design system (`docs/design-system/`): cores da arte do jogo em `games/<id>/art.tsx`, o resto por token de `tokens.css`; `node scripts/check-design-system.mjs` roda no CI.

## Bots (opcional)

- Estratégias ficam em `packages/bots/src/<id>.ts`, implementando `BotStrategy` do `game-sdk`, e são registradas em `BOTS`.
- O bot recebe o mesmo que a interface de um humano (`view`, `status`, `legal`) e devolve uma ação; a sala valida como qualquer jogada.
- Só jogos registrados em `BOTS` mostram "Adicionar bot" no lobby.

## 5. Checklist antes do PR

```bash
npm run typecheck
npm test
npm run build
```

Depois, teste no navegador com várias abas (`?perfil=2`, `?perfil=3`… simulam jogadores diferentes) e abra o PR.
