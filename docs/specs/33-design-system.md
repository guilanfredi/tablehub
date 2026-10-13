# 33 — Design system Taverna

## Objetivo
O app tem um visual provisório (feltro verde, tema claro/escuro automático, dado verde como ícone). O dono criou um design system próprio, **Taverna**: escuro e quente, âmbar como cor da marca, tipografia arredondada e um jeito de falar de "mesa". Esta melhoria aplica esse design system a todo o app e trava as regras para que mudanças futuras de interface continuem dentro dele.

## Fonte
- Pacote anexado na issue: [`tablehub-design-system.zip`](https://github.com/user-attachments/files/33360063/tablehub-design-system.zip) (SHA-256 `6b263e209f217c2fb4b7501310134a3a242081a4a264928fbf3defaee7409934`), feito sobre o commit `4c64eea`.
- A parte de documentação do pacote já está neste PR em `docs/design-system/` (README da marca, `tokens.json`, guias dos 14 componentes, `preview.html` e logos). **É a fonte da verdade visual**; esta especificação diz *como* levá-la ao app.
- O restante do pacote o Desenvolvedor copia do zip, sem reescrever:

| Arquivo do zip | Destino |
| --- | --- |
| `apps/web/src/design-system/tokens.css` | igual |
| `apps/web/src/design-system/components.css` | igual (substitui `apps/web/src/styles.css`) |
| `apps/web/public/favicon.svg` | igual (substitui o dado verde) |
| `.claude/skills/design-system/SKILL.md` | igual |
| `scripts/check-design-system.mjs` | igual, com a correção de Windows abaixo |
| `DESIGN_SYSTEM_HANDOFF.md` | **não entra** no repositório; esta especificação o substitui |

## Comportamento esperado
O que o jogador vê, em todas as telas (Home, entrada pelo código, Lobby, mesa de jogo, fim de partida), no desktop e no celular:

1. **Só tema escuro.** Fundo `bg` quente, cards em `surface`, texto `ink`. O tema claro (hoje automático por `prefers-color-scheme`) deixa de existir, mesmo com o sistema em modo claro.
2. **Âmbar como cor de ação.** Botão principal âmbar com texto escuro (`on-primary`) e "base" de 4px que afunda ao clicar; um botão principal por área. Ações destrutivas (Encerrar, Remover) em coral. Selos: Pronto em verde-água, Dono/Sua vez em âmbar.
3. **Fontes.** Títulos, marca, código da mesa e números grandes em Fredoka; o resto em Nunito. Placar, log e contagens com números tabulares. Enquanto a fonte não carrega (ou sem rede), cai em `system-ui` sem quebrar o layout.
4. **Foco visível.** Todo elemento clicável mostra anel âmbar de 3px ao navegar por teclado.
5. **Toque.** Botões e campos com no mínimo 44px de altura (34px em `btn-sm`).
6. **Mesa de jogo.** `.felt` desenha o tampo de madeira (`table` → `table-edge`), não feltro verde. Cada tabuleiro (Dominó, Truco Paulista, Catan, King of Tokyo) continua legível: peças, cartas, hexes, dados e textos com contraste, seleção e destaques visíveis.
7. **Marca.** Barra superior com o símbolo das cartas em leque (`tablehub-mark.svg`) + "TableHub" em Fredoka. Favicon, ícones do PWA (instalar na tela inicial) e `theme-color` da barra do navegador do celular no visual novo (`#1A1614`).
8. **Voz "mesa".** Na interface, "sala" vira "mesa", seguindo a tabela de voz do `docs/design-system/README.md`:

| Hoje | Passa a ser |
| --- | --- |
| Crie uma sala, compartilhe o código e escolha o jogo. | Abra uma mesa, compartilhe o código e escolha o jogo. |
| Criar sala · Criando… | Abrir uma mesa · Abrindo… |
| Entrar em uma sala | Entrar em uma mesa |
| Entrar na sala {código} | Entrar na mesa {código} |
| Conectando à sala {código}… | Conectando à mesa {código}… |
| Código da sala | Código da mesa |
| Código de sala inválido (5 letras/números). | Código de mesa inválido (5 letras/números). |
| Sala não encontrada. | Mesa não encontrada. Confira o código. |
| Não foi possível verificar a sala. | Não foi possível verificar a mesa. |
| Não foi possível criar a sala. | Não foi possível abrir a mesa. |
| O dono da sala ainda não escolheu o jogo. | O dono da mesa ainda não escolheu o jogo. |
| Remover {nome} da sala? | Remover {nome} da mesa? |
| Você foi removido da sala pelo dono. | Você foi removido da mesa pelo dono. |
| Entre na minha sala: {código} (compartilhar) | Entre na minha mesa: {código} |
| Encerrar a partida para todos e voltar à sala? | Encerrar a partida para todos e voltar à mesa? |
| Voltar à sala | Voltar à mesa |
| `<meta name="description">` "Crie uma sala e jogue…" | "Abra uma mesa e jogue…" |

   Mensagens que o **servidor** manda e o jogador vê também mudam (ver Dúvida 3): "Sala não encontrada." → "Mesa não encontrada. Confira o código.", "Sala expirada." → "Mesa expirada.", "Não foi possível criar a sala, tente de novo." → "Não foi possível abrir a mesa, tente de novo.".
   **Não mudam:** a rota `/sala/:código` (links já compartilhados continuam valendo), nomes no código (`room`, `RoomPage`…), o protocolo, comentários e documentação interna. "Dono" continua "Dono" (o README do design system usa esse selo).
   Sem emoji na interface (hoje não há; continuar assim).

## Mudanças técnicas
Só `apps/web`, `scripts/`, `.github/`, `CLAUDE.md`, `.claude/skills/` e as mensagens de texto do `apps/worker`. **Nada** em `packages/` (motores, `room-core`, protocolo em `shared`): estado e mensagens continuam iguais, então salas abertas e clientes já carregados seguem funcionando; o cliente antigo só troca de visual quando o service worker atualizar.

### 1. Base (`apps/web`)
- Copiar `tokens.css` e `components.css` (tabela acima). Em `main.tsx`, importar `./design-system/tokens.css` e `./design-system/components.css` no lugar de `./styles.css`; apagar `styles.css`. `components.css` mantém todos os nomes de classe de `styles.css` (conferido: é um superconjunto; acrescenta `badge-primary`, `seat-2..4`, `seat-empty`, `table-top`, `panzoom-controls`).
- `index.html`: `theme-color` = `#1A1614`; descrição com "mesa"; fontes conforme a Dúvida 2.
- `vite.config.ts` (manifesto do PWA): `theme_color` e `background_color` = `#1A1614` (a tela de abertura do app instalado fica escura).
- Barra superior (`App.tsx`): logo `tablehub-mark.svg` + nome na classe `brand`. O SVG precisa estar em `apps/web/public/` (ou importado como asset) para ser servido; copiar sem alterar de `docs/design-system/logos/`.

### 2. Variáveis antigas usadas pelos tabuleiros
Os CSS dos jogos usam variáveis de `styles.css` que **somem ou mudam de sentido**. Sem tratar, os tabuleiros quebram assim que `styles.css` sai. Migrar cada uso para o token novo (sem criar aliases das antigas):

| Antiga | Onde | Nova |
| --- | --- | --- |
| `--accent` (era o verde da marca: seleção) | domino.css, catan.css, king-of-tokyo.css | `--primary` (atenção: `--accent` agora é **coral**) |
| `--accent-soft` (fundo de seleção) | domino.css, catan.css | `--primary-soft` |
| `--surface-2` | catan.css, king-of-tokyo.css, king-of-tokyo/art.tsx | `--surface-raised` |
| `--text-muted` | catan.css | `--ink-muted` |
| `--border` | catan.css | `--line` (decorativo) ou `--line-strong` (borda de controle) |
| `--warn` | catan.css, king-of-tokyo.css, truco.css | `--accent` |
| `--shadow` | king-of-tokyo.css | `--shadow-float` |
| `--font` | catan.css | `--font-body` |

Critério: depois da migração, nenhum `var(--x)` em `apps/web/src` aponta para variável não definida (ver aceite 4).

### 3. Cores literais nos tabuleiros
Hoje há cores literais em `catan.css`, `CatanBoard.tsx`, `domino.css`, `king-of-tokyo.css` e `truco.css` (≈57 ocorrências). Para cada uma:
- cor de **interface** (texto, borda, fundo de painel, destaque) → variável do token;
- cor de **arte do jogo** (recurso do Catan, naipe/verso de carta, pip do dominó, cor de jogador, monstro) → mover para o `art.tsx` do jogo (criar `domino/art.tsx` e `truco-paulista/art.tsx` se preciso) ou, se mover não fizer sentido (ex.: CSS de uma carta), marcar a linha com o comentário `design-system-ignore`.
- O `.felt` passa a ser madeira: conferir em cada jogo que nada dependia do verde (ex.: texto escuro sobre o feltro).
- Mudança só visual: nenhuma regra de jogo, interação ou `data-*` usado nos e2e muda.

### 4. Textos
Trocas da tabela acima em `Home.tsx`, `RoomPage.tsx`, `Lobby.tsx`, `GameTable.tsx`, `store/room.ts`, `lib/api.ts`, `index.html` e, conforme a Dúvida 3, `apps/worker/src/index.ts` e `room-do.ts` (só o texto; códigos de fechamento 4404/4410 iguais). Atualizar os e2e que procuram esses textos (`e2e/helpers.ts` "Criar sala"; `bots.spec.ts` e `king-of-tokyo-qa.spec.ts` "Voltar à sala") e testes do worker/smoke que comparem a mensagem, se houver.

### 5. Logo e ícones
- `favicon.svg` do zip.
- Reescrever `scripts/gen-icons.mjs` para gerar `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` e `apple-touch-icon.png` a partir de `docs/design-system/logos/tablehub-app-icon.svg` (conforme a Dúvida 4). O maskable e o apple-touch são de fundo cheio (`#1A1614`, sem cantos transparentes) com o leque dentro da zona segura central (~80%). Os PNGs gerados são commitados.

### 6. Script de verificação e CI
- `scripts/check-design-system.mjs` do zip tem um defeito no Windows: `new URL('..', import.meta.url).pathname` vira `/D:/...` e o `readdirSync` falha. Trocar por `fileURLToPath(new URL('..', import.meta.url))`. De resto, igual ao zip.
- Acrescentar `"check:ds": "node scripts/check-design-system.mjs"` no `package.json` da raiz (atalho; opcional mas recomendado).
- `.github/workflows/pr.yml`, job `test`, depois da verificação de tipos: passo `Design system` rodando `node scripts/check-design-system.mjs`.
- Gerador de `tokens.css` conforme a Dúvida 5.

### 7. Documentação e skill
- `.claude/skills/design-system/SKILL.md` do zip.
- `CLAUDE.md`: seção nova logo depois de "## Convenções":
  ```markdown
  ## Design system (obrigatório em toda mudança de interface)
  - O visual do app é o design system Taverna, em `docs/design-system/` (fonte da verdade). Antes de criar ou alterar UI, use a skill `design-system` e leia `docs/design-system/README.md`.
  - Cores, espaços, cantos e sombras só por variável de `apps/web/src/design-system/tokens.css`. Nada de hex/rgb/hsl em `apps/web/src` fora de `design-system/` e da arte dos jogos (`games/*/art.tsx`).
  - Reutilize as classes de `apps/web/src/design-system/components.css`; componente novo ganha guia em `docs/design-system/components/` no mesmo PR.
  - Texto de UI usa "mesa" (não "sala"): Abrir uma mesa, Sentar, Código da mesa.
  - `node scripts/check-design-system.mjs` precisa passar antes do PR (roda no CI).
  - Mudar um valor visual = editar `docs/design-system/tokens.json`, regenerar `tokens.css` e atualizar o README no mesmo PR.
  ```
  e, em "## Comandos", a linha `node scripts/check-design-system.mjs   # cores só por token (roda no CI)`.
- `docs/GAME_AUTHORING.md`: uma linha dizendo que a interface do jogo segue o design system (cores de arte em `art.tsx`, o resto por token) e que o check roda no CI.
- `docs/design-system/README.md`, seção Tipografia: ajustar o trecho das fontes conforme a Dúvida 2.
- O `preview.html` referencia `../../apps/web/src/design-system/*.css`; continua funcionando depois do passo 1 (abrir direto no navegador).

## Fora do escopo
- Telas, componentes ou funcionalidades novas mostrados nos guias mas que o app ainda não tem (ex.: Toast, Scoreboard, Log, GamePicker como componente, assentos coloridos): o CSS deles entra com `components.css`, mas **não** se cria UI nova para usá-los.
- Renomear "sala" no código, na rota `/sala/...`, no protocolo ou na documentação técnica.
- Tema claro ou seletor de tema.
- Redesenhar a arte dos jogos (cartas, hexes, monstros): só se reorganiza onde as cores moram e se garante legibilidade sobre a madeira.
- Mudanças nos motores, em `room-core` ou no protocolo.

## Dúvidas
1. **Um PR ou cinco?** O roteiro do pacote sugere 5 PRs (base, logo, textos, tabuleiros, CI). Aqui cada merge faz deploy em produção e cada PR passa por analista → dev → QA → revisor.
   - (a) **Um PR só, este** (recomendado): entre o PR 1 e o PR 4 do roteiro os tabuleiros ficariam quebrados em produção (variáveis antigas somem e `--accent` vira coral); fazer tudo junto evita isso e o trabalho é quase todo mecânico.
   - (b) Cinco PRs, na ordem do roteiro, com aliases temporários das variáveis antigas para não quebrar a produção.
2. **Fontes: Google Fonts ou hospedadas no app?**
   - (a) **Hospedar no app** via `@fontsource/fredoka` e `@fontsource/nunito` (só os pesos usados), importadas em `main.tsx` (recomendado): o PWA funciona offline com as fontes certas (o service worker já guarda os assets), sem depender de terceiro e sem enviar o IP dos jogadores ao Google. Licença OFL, permitida.
   - (b) `<link>` do Google Fonts no `index.html`, como no pacote: mais simples, mas offline cai na fonte do sistema e o primeiro acesso depende do Google.
3. **"Mesa" também nas mensagens do servidor?** "Sala não encontrada.", "Sala expirada." e "Não foi possível criar a sala…" vêm do worker e aparecem para o jogador.
   - (a) **Sim** (recomendado): senão o jogador vê "mesa" e "sala" misturados. Só muda o texto; códigos de fechamento iguais.
   - (b) Não, só o `apps/web`.
4. **Como gerar os ícones PNG a partir do SVG?** O script atual desenha o dado pixel a pixel, sem dependências.
   - (a) **Dependência de desenvolvimento `@resvg/resvg-js`** para renderizar o SVG oficial (recomendado): o ícone fica idêntico ao logo e se atualiza sozinho se o logo mudar. Só roda à mão; os PNGs são commitados, então não pesa no build nem no CI.
   - (b) Manter sem dependências e redesenhar as três cartas giradas à mão no script: nada novo no `package.json`, mas duplica a geometria do logo.
5. **Gerador do `tokens.css`?** O pacote diz "não edite `tokens.css` à mão, regenere do `tokens.json`", mas não traz o gerador.
   - (a) **Criar `scripts/gen-tokens.mjs`** (lê `tokens.json`, escreve `tokens.css`; a saída para o `tokens.json` atual tem de ser igual ao `tokens.css` do zip) e um teste/passo no CI que falha se o `tokens.css` estiver desatualizado (recomendado).
   - (b) Não criar agora; a regra fica só como orientação e quem mudar o token edita os dois arquivos.

## Critérios de aceite
1. `apps/web/src/styles.css` não existe; `main.tsx` importa `design-system/tokens.css` e `design-system/components.css`; os dois arquivos são idênticos aos do zip.
2. Com o sistema operacional/navegador em **modo claro**, o app continua escuro (fundo `#1A1614`); não há `prefers-color-scheme` no CSS do app.
3. `node scripts/check-design-system.mjs` passa no Linux (CI) **e** no Windows, e roda no job `test` do `pr.yml`. Colocar uma cor literal (ex.: `color: #fff;`) num `.css` de jogo faz o script falhar; com `/* design-system-ignore */` na linha, passa.
4. Nenhuma `var(--nome)` em `apps/web/src` referencia variável inexistente em `tokens.css`/`components.css` (Revisor confere por busca; `--surface-2`, `--text-muted`, `--border`, `--warn`, `--shadow`, `--font` não aparecem mais). Seleção/destaque nos tabuleiros (peça jogável no Dominó, hex/vértice/aresta e recursos selecionados no Catan, dados travados e alvos no King of Tokyo) aparece em âmbar, não em coral.
5. Botão principal da Home ("Abrir uma mesa") é âmbar com texto escuro e afunda ao clicar; "Encerrar" na mesa é coral; selo "Pronto" é verde-água; foco por teclado (Tab) mostra anel âmbar em botões, campos e opções.
6. Títulos e código da mesa em Fredoka e corpo em Nunito (conferir `getComputedStyle(...).fontFamily` e que a fonte carregou); com a rede bloqueada para fontes externas, o texto aparece na fonte do sistema sem quebrar o layout. Se a Dúvida 2 for (a): com o app instalado e offline, as fontes continuam Fredoka/Nunito.
7. Barra superior mostra o leque de cartas + "TableHub"; `favicon.svg` é o do zip; `theme-color` e o manifesto (`theme_color`, `background_color`) são `#1A1614`; os 4 PNGs do PWA mostram o leque (não o dado) e o maskable tem fundo cheio.
8. Nenhum texto visível da interface contém "sala"/"Sala" (Home, entrar pelo código, Lobby, mesa, fim de partida, diálogos de confirmação, mensagens de erro, texto de compartilhar), exceto a URL `/sala/...`. Os textos novos são os da tabela. Código inválido mostra "Código de mesa inválido (5 letras/números)."; código inexistente, "Mesa não encontrada. Confira o código.".
9. A rota `/sala/<código>` continua funcionando (link antigo abre a mesa).
10. Os quatro jogos começam e jogam algumas jogadas com 2 jogadores, no desktop e no celular (375px), com tabuleiro legível sobre a madeira, sem regressão de interação. `npm run e2e` passa (com os textos atualizados).
11. Alvos de toque: botões e campos com altura ≥ 44px (`btn-sm` ≥ 34px) no celular.
12. `npm run typecheck`, `npm test` e `npm run build` passam; nenhum arquivo em `packages/` mudou.
13. `CLAUDE.md` tem a seção "Design system" e a linha do comando; `.claude/skills/design-system/SKILL.md` existe; `DESIGN_SYSTEM_HANDOFF.md` **não** está no repositório.
14. Se a Dúvida 5 for (a): `node scripts/gen-tokens.mjs` gera um `tokens.css` idêntico ao commitado, e mudar um valor no `tokens.json` sem regenerar faz o CI falhar.
