# TableHub

Jogue boardgames com os amigos pelo navegador ou celular: crie uma sala, compartilhe o código, escolha o jogo e as regras, todos marcam "pronto" e o dono inicia.

**Jogos:** Dominó (duplo-6) · Truco Paulista · Catan (base, 3–4 jogadores)

## Rodando localmente
Requer Node 20+.

```bash
npm install
npm run dev
```

Abra http://localhost:5173. Para simular outros jogadores no mesmo navegador, abra a sala em outra aba com `?perfil=2`.

## Testes
```bash
npm test          # regras dos jogos + bateria de conformidade + salas
npm run typecheck
```

## Estrutura
| pasta | conteúdo |
|---|---|
| `packages/game-sdk` | contrato genérico de jogo, RNG determinístico, tabuleiros hexagonais, testes de conformidade |
| `packages/room-core` | regras de sala/lobby |
| `packages/games` | um diretório por jogo (`RULES.md`, motor, testes) |
| `packages/shared` | protocolo cliente ↔ servidor |
| `apps/worker` | Cloudflare Worker + Durable Objects (uma instância por sala) |
| `apps/web` | app React/Vite (PWA) |

## Deploy
Cloudflare Workers, via GitHub Actions:
- **PR** → testes + build + ambiente de preview `tablehub-pr-<n>` (URL comentada no PR) + smoke test.
- **merge na `main`** → testes + deploy em produção + smoke test.
- **PR fechado** → preview removido.

Segredos necessários no repositório: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

## Adicionando jogos
Veja [docs/GAME_AUTHORING.md](docs/GAME_AUTHORING.md).
