# TableHub — Plano

## Contexto
App PWA (browser + celular) onde usuários entram com apelido, criam ou entram em salas; o dono escolhe o jogo e os parâmetros de regra, os demais veem as regras e marcam "pronto", e o dono inicia quando todos estiverem prontos. A plataforma é genérica (de dominó/truco a Catan/Terra Mystica). Jogos iniciais: **Dominó, Truco Paulista e Catan**. Hospedagem serverless na Cloudflare (sem servidor ligado à toa), CI/CD com PRs abertos pelo Claude, testados automaticamente, aprovados pelo merge do dono do repositório e publicados automaticamente. Futuro: o Claude implementa novos jogos a partir do manual.

### Decisões
- PWA responsivo (um único app web).
- Login apenas com apelido (token anônimo no localStorage), sem banco no MVP.
- Truco Paulista; Dominó duplo-6 com parâmetros; Catan base 3–4 completo (com comércio entre jogadores).
- Mudança de parâmetros pelo dono **não** desmarca o "pronto" (mudanças aparecem destacadas).
- Hospedagem: Cloudflare Workers + Durable Objects (~US$0/mês no plano gratuito).
- Repositório GitHub **público**; aprovação = **merge** do PR.

## Stack
- Monorepo TypeScript (npm workspaces).
- Web: Vite + React + React Router + Zustand + `vite-plugin-pwa`; tabuleiros em SVG com pan/zoom para celular.
- Backend: 1 Cloudflare Worker (também serve os assets do site) + 1 Durable Object por sala (WebSocket Hibernation API, estado salvo no storage do DO).
- zod para validar o protocolo; Vitest para testes.

## Estrutura
```
packages/shared        protocolo (schemas zod), tipos Room/Player
packages/game-sdk      GameDefinition, OptionField, Rng serializável, hexgrid, runner, testing/conformance
packages/room-core     lógica pura de sala/lobby (portável, sem Cloudflare)
packages/games/        registry + {domino, truco-paulista, catan}/ (engine, RULES.md, testes, assets/)
apps/worker            Worker (/api, /ws/:code, assets) + RoomDurableObject
apps/web               PWA; src/games/<id>/Board.tsx; src/components/board/*
.claude/skills/add-game/SKILL.md, docs/GAME_AUTHORING.md
.github/workflows/{pr.yml, deploy.yml, pr-cleanup.yml}
```

## Contrato genérico de jogo (`game-sdk`)
`GameDefinition`: `optionsSchema` (gera o formulário do lobby), `rulesSummary`, `validateConfig`, `setup` (seed; estado 100% JSON), `getPlayerView` (oculta informação), `getLegalActions` (**obrigatório**), `applyAction` (determinístico; recebe cópia do estado), `getStatus`.

Bateria de conformidade (`runConformance`) obrigatória para todo jogo: partidas aleatórias até o fim, determinismo por seed, round-trip JSON, rejeição de ação inválida, views sem vazamento de informação oculta.

## Salas
- Sessão por token no localStorage (playerId = hash do token); reconexão automática.
- Código de 5 caracteres + link `/sala/ABCDE`.
- Mensagens: `setGame`, `setOptions`, `movePlayer`, `ready`, `start`, `action`, `leave`, `backToLobby`. Servidor envia `room` e `game` (view individual + ações legais).
- Mudança de parâmetros não desmarca "pronto"; mudanças destacadas para os jogadores.
- Iniciar: todos prontos + nº de jogadores válido + `validateConfig` ok (validado no servidor).
- Troca de dono ao sair/desconectar; alarme apaga sala após ~2h inativa; fim de jogo volta ao lobby.

## Jogos
- **Dominó duplo-6**: 2–4 jogadores; opções: modo bloqueio/compra, pontos para vencer (50/100/150), duplas (4 jogadores); maior duplo abre a 1ª rodada; batida soma pontos dos adversários; jogo fechado → menor soma vence.
- **Truco Paulista**: 2 ou 4 jogadores, 40 cartas, manilha pela vira (zap > copas > espadas > ouros), melhor de 3 vazas com regras de empate, truco 3→6→9→12 (aceitar/correr/aumentar), mão de onze, mão de ferro, carta encoberta.
- **Catan base 3–4**: tabuleiro iniciante/aleatório com portos, colocação inicial em serpente, dados, produção, ladrão no 7 (descarte/roubo), construções, cartas de desenvolvimento, comércio com banco/portos e entre jogadores, maior estrada/maior exército; opções: tabuleiro, pontos para vencer (8–12), limite de descarte. Arte própria em SVG.

## CI/CD (GitHub Actions + Cloudflare)
1. `pr.yml` (todo PR): install → typecheck → testes (inclui conformidade de todos os jogos) → build → deploy de Worker de preview `tablehub-pr-<n>` (salas isoladas; preview URLs nativas da Cloudflare não suportam Durable Objects) → comenta URL no PR.
2. Proteção da `main` (grátis em repo público): exige PR + `pr.yml` verde.
3. Usuário aprova clicando **Merge**.
4. `deploy.yml` (push na `main`): testes de novo → `wrangler deploy` produção (concurrency de 1).
5. `pr-cleanup.yml` (PR fechado): remove o Worker de preview.
6. PRs de forks rodam testes sem secrets e sem preview.

## Automação "manual → jogo"
Skill `add-game`: lê o manual → `RULES.md` (com dúvidas listadas) → `npm run new-game <id>` → engine + testes + conformidade → `Board.tsx` e assets → todos os testes → auto-revisão (`/code-review`) → teste no navegador embutido → abre PR (esteira acima).

## Passos manuais do usuário (uma vez)
Criar conta Cloudflare + API token; criar repo público no GitHub; cadastrar secrets `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`.

## Ordem de implementação
1. Monorepo, `git init`, `npm run dev`; `shared`, `game-sdk`, `room-core` + testes.
2. Worker + Durable Object; Home e Lobby ponta a ponta.
3. Workflows CI/CD + primeiro deploy.
4. Dominó → Truco → Catan (engine + testes → Board).
5. PWA e polimento responsivo.
6. Skill `add-game` + docs.

## Verificação
- Testes: engines, conformidade dos 3 jogos, room-core (iniciar bloqueado sem prontos, pronto mantido ao mudar opções, troca de dono, reconexão).
- Navegador embutido com várias abas (desktop e 375×812): partidas completas dos 3 jogos, recarregar no meio da partida.
- Esteira: preview do PR funcional, merge → produção, preview removido ao fechar PR.
