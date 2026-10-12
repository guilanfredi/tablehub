---
name: add-game
description: Modo solo (uma única sessão) para implementar um novo jogo de tabuleiro no TableHub a partir do manual (PDF, imagens ou texto) — especificação, motor, testes, interface, revisão e PR. Use apenas quando o usuário pedir explicitamente que uma única sessão faça tudo; o padrão é /analista.
---

# Adicionar um jogo a partir do manual (modo solo)

> O fluxo padrão do projeto é o time de agentes em sessões separadas (`docs/TEAM.md`: /analista → /dev → /qa → /revisor). Use este modo solo só quando o usuário pedir explicitamente que uma sessão faça tudo.

Siga as etapas em ordem. Leia `docs/GAME_AUTHORING.md` antes de começar e use Dominó, Truco Paulista e Catan (`packages/games/*`) como referência de estilo.

## 0. Preparação
- Crie a branch a partir da `main` remota: `git fetch origin && git switch -c game/<id> origin/main` (funciona em worktree; veja o `docs/TEAM.md`).
- Confirme que commits sairão pela **conta bot** (`git config user.name`, `gh auth status`). Se não estiverem configurados, pare e peça ao usuário — não use a conta pessoal dele.

## 1. Entender o manual → `RULES.md`
- Leia o manual inteiro (PDF: use a skill de PDF / Read com `pages`).
- Escreva `packages/games/<id>/RULES.md` como especificação objetiva: jogadores, componentes, preparação, turno, fim de jogo, pontuação, variantes que viram **opções**.
- Liste em "Dúvidas de interpretação" toda ambiguidade e a decisão tomada. **Se alguma dúvida mudar a jogabilidade de forma relevante, pergunte ao usuário antes de implementar.**
- Escopo: implemente o jogo base. Expansões só se pedidas.

## 2. Esqueleto
```bash
npm run new-game -- <id> "<Nome>"
```

## 3. Motor + testes (TDD)
- Para cada item do `RULES.md`, escreva o teste primeiro (estados controlados, casos de borda) e depois a regra em `engine.ts`.
- `getLegalActions` completo; `getPlayerView` sem vazamentos; tudo determinístico via `Rng`.
- Configure `runConformance` com `leakCheck`, várias contagens de jogadores e conjuntos de opções, `requireFinish: true` (com `chooseAction` guiado se o jogo for longo).
- Rode `npx vitest run packages/games/<id>` até ficar verde.

## 4. Interface
- Implemente `apps/web/src/games/<id>/<Nome>Board.tsx` + CSS próprio, guiando-se por `game.legal`.
- Arte própria em SVG; nada de assets protegidos.
- Mobile-first; tabuleiros com `PanZoom`.

## 5. Verificação completa
```bash
npm run typecheck && npm test && npm run build
```
- Suba o app (`preview_start` com `tablehub-dev`), abra 1 aba por jogador (`?perfil=2`, `?perfil=3`…), jogue o início de uma partida e pelo menos um caso especial; confira 375×812 e o console sem erros.
- Rode também `node scripts/smoke.mjs http://localhost:8787` (no modo automático, use a porta de `TABLEHUB_WORKER_PORT`).

## 6. Auto-revisão
- Rode `/code-review` sobre a branch e corrija o que for confirmado. Repita os testes.

## 7. PR
- Commit (conta bot) com mensagem descritiva e o trailer de co-autoria.
- `gh pr create` com: resumo do jogo, opções implementadas, dúvidas de interpretação e decisões, como testar.
- Acompanhe o CI; corrija falhas no próprio PR. O usuário revisa/aprova → merge → deploy automático.
