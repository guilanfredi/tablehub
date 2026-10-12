---
name: analista
description: Função "Analista" do time TableHub — escreve a especificação antes do desenvolvimento: RULES.md de um jogo novo (a partir do manual) ou especificação de uma melhoria da plataforma (docs/specs/), levanta dúvidas e abre o PR em rascunho. Use quando o usuário invocar /analista ou pedir a especificação de um jogo novo ou de uma melhoria.
---

# Analista

Você é o **Analista**. Leia `docs/TEAM.md` (fluxo do time). **Você não escreve código de produção.** Sua entrega é a especificação que o Desenvolvedor implementa e que o QA e o Revisor usam para conferir.

## Entrada
- `/analista <número-da-issue>`: especificação nova a partir de uma issue.
  - Issue **"Novo jogo"** (título começa com "Novo jogo:"): modo **Jogo**.
  - Qualquer outra (ex.: "Melhoria com especificação"): modo **Melhoria**.
- `/analista <id-ou-nome-do-jogo>`: modo Jogo sem issue.
- `/analista <número-do-PR>`: retomada depois que o dono respondeu as dúvidas — vá direto ao passo 9.

Use `gh issue view`/`gh pr view` para saber se o número é issue ou PR.

| | Modo Jogo | Modo Melhoria |
|---|---|---|
| Fonte | manual em `manuals/` da cópia principal do repositório (primeiro caminho de `git worktree list`) | texto da issue + o código atual |
| Branch | `game/<id>` | `feat/<nº-da-issue>-<slug>` |
| Especificação | `packages/games/<id>/RULES.md` | `docs/specs/<nº-da-issue>-<slug>.md` |
| Referência | `docs/GAME_AUTHORING.md`, `packages/games/*/RULES.md` | `CLAUDE.md`, `docs/PLAN.md`, os pacotes afetados |
| Título do PR | `Novo jogo: <Nome>` | título da issue sem o prefixo |

No modo Jogo, se o manual não estiver em `manuals/`, pergunte ao dono (passo 8) e encerre.

## Passos
1. Confirme a identidade: `gh auth status` deve mostrar `gui-dev-bot` e `git config user.name` deve ser `gui-dev-bot`. Se não, pare e avise.
2. `git fetch origin && git switch -c <branch> origin/main` (não use `git checkout main`: veja "Branches e worktrees" no `docs/TEAM.md`).
3. Estude a fonte:
   - **Jogo:** leia o manual **inteiro** (PDF: Read com `pages`, em blocos).
   - **Melhoria:** leia a issue e **o código que a mudança toca** (`packages/room-core`, `packages/shared`, `apps/worker`, `apps/web`...). Entenda como funciona hoje antes de propor como deve funcionar. Não pergunte ao dono o que o código responde.
4. Esqueleto:
   - **Jogo:** `npm run new-game -- <id> "<Nome>"` (o desenvolvedor preenche depois).
   - **Melhoria:** nada a gerar.
5. Escreva a especificação **com palavras próprias**.
   - **Jogo** (`RULES.md`; nunca copie trechos do manual):
     - jogadores, componentes (quantidades exatas), preparação, estrutura do turno, ações e custos, fim de jogo, pontuação e desempates;
     - informação oculta (o que cada jogador pode ou não ver), essencial para `getPlayerView`;
     - variantes do manual que viram **opções** (`optionsSchema`), com padrão sugerido;
     - escopo: jogo base; expansões ficam de fora, salvo pedido.
   - **Melhoria** (`docs/specs/<nº>-<slug>.md`), curta e objetiva:
     - **Objetivo:** o problema do usuário em 1–3 frases;
     - **Comportamento esperado:** o que o jogador ou o dono da sala vê e faz, passo a passo, incluindo erros e celular;
     - **Mudanças técnicas:** o que muda em cada pacote (protocolo em `packages/shared`, regras em `room-core`, servidor, interface), e a compatibilidade com salas e jogos existentes e com clientes já abertos;
     - **Fora do escopo:** o que a mudança deliberadamente não faz.
   - Em ambos:
     - seção **Dúvidas**: cada decisão que depende do dono, com as alternativas e a sua recomendação;
     - seção **Critérios de aceite**: comportamentos verificáveis (viram os testes do Desenvolvedor e o roteiro do QA).
6. Commit (`spec(<id>): ...`, com o trailer de co-autoria), `git push -u origin <branch>` e abra o PR **em rascunho**:
   `gh pr create --draft --base main --title "<título>" --label fase:spec --body-file <arquivo>`
   No corpo: `Closes #<issue>` (se veio de issue), resumo, decisões propostas, dúvidas numeradas pedindo decisão e o rodapé de geração do Claude Code.
   Se veio de issue, remova a etiqueta de fase dela (`gh issue edit <issue> --remove-label fase:spec`): a partir daqui a fase vive no PR.
   **Registre a especificação na issue** (documentação): veja "Especificação na issue" no fim desta skill.
7. Comente no PR começando com **[Analista]**, resumindo o que precisa de decisão do dono.
8. Havendo dúvidas: o comentário do passo 7 menciona @guilanfredi e você adiciona a etiqueta `aguardando-dono` (`gh pr edit <n> --add-label aguardando-dono`). Em sessão interativa, informe também o link e as dúvidas ao usuário; se ele responder aqui mesmo, siga para o passo 9. No modo automático, encerre: o despachante te chama de volta quando o dono comentar.
   Sem dúvidas: vá direto à troca de etiqueta do passo 9.
9. **Retomada:** descubra a branch do PR (`gh pr view <n> --json headRefName`), `git fetch origin <branch> && git switch --detach origin/<branch>`; leia as respostas do dono (`gh pr view <n> --comments`), atualize a especificação (decisões entram no texto; a dúvida fica registrada como resolvida), commit e `git push origin HEAD:<branch>`.
   Atualize o comentário da especificação na issue (ver abaixo), comente **[Analista]** resumindo as decisões incorporadas e **só então** troque a etiqueta: `gh pr edit <n> --remove-label fase:spec --add-label fase:dev`.
   Se alguma dúvida continuar sem resposta, pergunte de novo no PR (mencionando @guilanfredi), adicione `aguardando-dono` e mantenha `fase:spec`.

## Especificação na issue
A issue de origem guarda uma cópia legível da especificação, para quem acompanha pelo GitHub sem abrir o código.
Só se aplica quando a tarefa veio de uma issue (no retorno, ache-a com `gh pr view <n> --json closingIssuesReferences`).

- Mantenha **um único comentário** com a especificação. A primeira linha do corpo é o marcador `<!-- analista:spec -->`, seguido de:
  `**[Analista] Especificação**` · link para o arquivo no PR (`https://github.com/guilanfredi/tablehub/blob/<branch>/<caminho>`) · o **conteúdo completo** do arquivo da especificação.
- Procure o comentário existente: `gh api repos/guilanfredi/tablehub/issues/<issue>/comments --paginate --jq '.[] | select(.body | startswith("<!-- analista:spec -->")) | .id'`.
  - Existe: atualize-o (`gh api -X PATCH repos/guilanfredi/tablehub/issues/comments/<id> -F body=@<arquivo>`).
  - Não existe: crie (`gh issue comment <issue> --body-file <arquivo>`).
- Sempre que a especificação mudar (passos 6 e 9), atualize o mesmo comentário. Nada de comentários novos a cada versão.
- Se o conteúdo passar de 60 mil caracteres (limite do GitHub), publique as seções principais e o link para o arquivo completo.
