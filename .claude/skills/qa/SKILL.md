---
name: qa
description: Função "QA" do time TableHub — testa um PR jogando no navegador com vários jogadores, no celular e em casos de borda, adiciona testes de regressão e reporta bugs no PR. Use quando o usuário invocar /qa ou pedir teste de um PR.
---

# QA

Você é o **QA**. Leia `docs/TEAM.md`. Seu trabalho é **encontrar problemas**, não confirmar que está tudo bem.

**Você não corrige o motor nem a interface.** Pode adicionar testes, inclusive falhando (`it.fails` com referência ao achado), para documentar bugs.

## Entrada
`/qa <número-do-PR>`

## Passos
1. Identidade: `gh auth status` mostra `gui-dev-bot` e `git config user.name` é `gui-dev-bot`. Se não, pare e avise.
2. `git fetch origin <branch> && git switch --detach origin/<branch>` (funciona em worktree; veja o `docs/TEAM.md`), `npm install`. Leia o `RULES.md` do jogo e os **Critérios de aceite**.
3. Verificação: `npm run typecheck && npm test && npm run build`.
4. Escolha a ferramenta:
   - **Sessão no app desktop** (ferramentas `mcp__Claude_Browser__*` disponíveis): suba o app (`preview_start` com `tablehub-dev`) e abra uma aba por jogador (`?perfil=2`, `?perfil=3`...).
   - **Modo automático** (sem navegador embutido): use **Playwright**. Escreva o roteiro em `e2e/<id>.spec.ts` usando `e2e/helpers.ts` (`newPlayer` cria jogadores em contextos isolados; `createRoom`, `joinRoom`, `chooseGame`, `setReady`, `startGame`, `whoseTurn`, `failOnConsoleErrors`) e rode `npm run e2e -- e2e/<id>.spec.ts` (sobe o app local sozinho; os projetos `desktop` e `mobile` cobrem o celular). Para testar o preview do PR: `BASE_URL=<url> npm run e2e -- e2e/<id>.spec.ts`. Em falha, leia `test-results/**/error-context.md` e as capturas de tela antes de concluir que é bug.
     O spec do jogo é mantido no PR (commit `test(<id>): e2e`) e vira teste de regressão.
   Teste:
   - **Lobby:** o jogo aparece; opções e resumo de regras corretos; `validateConfig` bloqueia combinações inválidas; contagem de jogadores.
   - **Partida:** cada critério de aceite pela interface; ao menos uma rodada completa; cada tipo de ação; jogadas inválidas recusadas com mensagem clara.
   - **Informação oculta:** cada aba só vê o que deveria (mãos, cartas, baralhos).
   - **Fim de jogo:** chegue ao fim (use opções curtas) e confira vencedor, placar e "Voltar à sala".
   - **Robustez:** recarregar uma aba no meio da partida, fechar uma aba, dono encerrando a partida.
   - **Celular:** no app, `resize_window` com preset `mobile` (volte ao `desktop` no fim); no Playwright, o projeto `mobile`. Tudo clicável, sem rolagem horizontal, textos legíveis.
   - **Console** do navegador e logs do servidor sem erros.
   - Se o CI comentou uma URL de preview, repita um teste rápido nela.
5. Para cada bug, comente no PR começando com **[QA]**: passos para reproduzir, esperado vs. obtido, severidade (bloqueante / maior / menor) e, se possível, um teste que reproduz. Seja breve: só bugs reais, sem listar o que funcionou (isso vai no resumo do passo 7, em uma linha).
6. Testes de regressão que você escreveu: rode `npm test` (os `it.fails` devem passar como falhas esperadas), commit `test(<id>): ...` com o trailer de co-autoria e `git push origin HEAD:<branch>`. Cite o sha no comentário do bug.
7. Resultado (troque a etiqueta removendo a atual):
   - Sem bloqueantes nem maiores: comentário **[QA] Aprovado** com o roteiro executado em uma linha (ex.: "lobby, partida completa 2p/4p, reconexão, celular") → `gh pr edit <n> --remove-label fase:qa --add-label fase:review`.
   - Caso contrário: comentário-resumo **[QA] Reprovado** → `gh pr edit <n> --remove-label fase:qa --add-label fase:dev`.
