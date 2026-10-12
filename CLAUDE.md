# TableHub

Plataforma PWA para jogar boardgames em salas (Dominó, Truco Paulista, Catan…). Plano completo: `docs/PLAN.md`.

## Fluxo de trabalho (obrigatório)
- **Nunca commitar direto na `main`.** Toda mudança vai em branch + PR.
- **Commits e PRs são feitos pela conta bot do GitHub**; o dono do repositório só revisa e aprova.
  Antes de commitar, confira `git config user.name` / `user.email` (identidade do bot neste repo) e `gh auth status` (bot ativo).
  Se não estiver configurado, pare e peça ao usuário — não use a conta pessoal dele.
- PR aprovado + CI verde → merge → deploy automático (`.github/workflows/deploy.yml`).
- **Time de agentes** (`docs/TEAM.md`): cada função roda numa sessão própria — `/analista`, `/dev`, `/qa`, `/revisor`. O PR é o quadro de passagem (etiquetas `fase:*` + comentários com a função entre colchetes).
- Automação local (despachante + monitor) fica no repositório [tablehub-agent-automation](https://github.com/guilanfredi/tablehub-agent-automation); aqui só a configuração em `.agents/` (ver `docs/AUTOMATION.md`). Tarefas são issues; etiquetas `agente:trabalhando` e `aguardando-dono`.
- Manuais de jogos ficam em `manuals/` (fora do git; material protegido).
- Detalhes técnicos de jogos: `docs/GAME_AUTHORING.md`. A skill `add-game` é o modo solo (uma sessão faz tudo).

## Comandos
```bash
npm run dev         # worker (wrangler, :8787) + web (vite, :5173)
npm test            # vitest: motores, conformidade, room-core
npm run typecheck
npm run build       # build do PWA em apps/web/dist
node scripts/smoke.mjs http://localhost:8787   # teste ponta a ponta contra um servidor rodando
npm run new-game -- <id> "<Nome>"
npm run e2e         # Playwright (desktop + mobile); BASE_URL=<url> para outro ambiente
```
Para testar vários jogadores no mesmo navegador, use `?perfil=2`, `?perfil=3`… na URL.

## Arquitetura
- `packages/game-sdk` — contrato `GameDefinition`, `Rng`, hexgrid, `runConformance`.
- `packages/room-core` — regras de sala/lobby puras (portáveis). Mudar regras **não** desmarca "pronto" (decisão de produto).
- `packages/games/<id>` — motores dos jogos (TS puro, determinísticos, estado JSON).
- `apps/worker` — Cloudflare Worker + 1 Durable Object por sala (WebSocket Hibernation). Protocolo em `packages/shared`.
- `apps/web` — React + Vite PWA; tabuleiros em `src/games/<id>`.

## Convenções
- Textos de interface e mensagens de erro em português.
- Aleatoriedade só via `Rng` com semente no estado; servidor autoritativo.
- Arte própria (SVG); nunca usar assets protegidos de jogos comerciais.
