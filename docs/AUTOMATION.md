# Automação local dos agentes

O despachante (`automation/dispatcher.ps1`) roda no Agendador de Tarefas do Windows a cada 5 minutos, enquanto você estiver logado.
Ele só consulta o GitHub com o `gh` — **parado, não gasta cota**. Quando acha uma tarefa, roda **uma** função por vez com o
Claude Code em modo automático (`claude -p "/<função> <n>"`), usando a **sua assinatura** (não há chave de API configurada).

## Como funciona
1. Procura issues/PRs abertos com etiqueta de fase, nesta prioridade: `fase:review` → `fase:qa` → `fase:dev` → `fase:spec`.
2. Ignora tarefas com `agente:trabalhando`, as que não foram criadas por @guilanfredi/@gui-dev-bot, e as com `aguardando-dono`
   (até você comentar — aí remove a etiqueta e retoma).
3. Prepara um worktree só da função em `D:\dev\TableHub-agents\<função>` (limpo, na `main`; `npm ci` quando o lockfile muda).
4. Marca a tarefa com `agente:trabalhando`, roda a função com as permissões de `automation/roles/<função>.json` e um tempo máximo
   (revisor 30 min, QA e analista 60, dev 120). Estourou o tempo: comenta no PR e marca `aguardando-dono`.
5. Login expirado → pausa 1 h; limite de uso da assinatura → pausa 30 min (`automation/state/paused-until.txt`).

## Instalação (uma vez)
1. **Login do Claude Code CLI** (o embutido no app desktop tem login próprio). No PowerShell:
   ```powershell
   & (Get-ChildItem "$env:APPDATA\Claude\claude-code\*\*\claude.exe" | Sort-Object { [version]$_.Directory.Parent.Name } | Select-Object -Last 1).FullName
   ```
   Dentro dele, rode `/login`, entre com a conta da assinatura Pro e saia com `/exit`.
2. **Teste manual**, sem agendar:
   ```powershell
   powershell -ExecutionPolicy Bypass -File D:\dev\TableHub\automation\dispatcher.ps1 -DryRun
   ```
3. **Agendar**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File D:\dev\TableHub\automation\install-scheduler.ps1
   ```
   Remover: `automation\uninstall-scheduler.ps1`. Pausar temporariamente: desabilite a tarefa "TableHub Agentes" no Agendador.

## Uso
- **Criar trabalho:** abra uma issue pelos modelos (Novo jogo → Analista; Bug/Melhoria → Desenvolvedor). Para jogo novo, coloque o manual em
  `D:\dev\TableHub\manuals\` antes.
- **Responder um agente:** quando aparecer `aguardando-dono` (você é mencionado e recebe notificação do GitHub), responda com um comentário.
- **Aprovar:** quando o PR chegar em `pronto-para-aprovação`, revise e aprove.
- **Rodar uma função na mão:** abra uma sessão no app e use `/analista`, `/dev`, `/qa` ou `/revisor` normalmente.

## Logs e diagnóstico
- `automation/logs/dispatcher.log` — uma linha por decisão.
- `automation/logs/<data>-<função>-<n>.json` — saída completa de cada execução (inclui custo estimado e turnos).
- `dispatcher.ps1 -DryRun` mostra o que seria feito; `-Only <função>` restringe a uma função.
- Trava presa: apague `automation/state/running.json` (o despachante também limpa travas vencidas sozinho).

## Segurança
- Permissões por função em `automation/roles/`: todas negam merge, force-push, push na `main`, segredos, `gh auth` (exceto `status`), deploy e acesso à web.
  O Revisor não tem `Edit`/`Write` nem `git commit`/`git push` — é técnico, não só instrução.
- Repositório público: só tarefas criadas por você ou pelo bot são processadas, e os agentes tratam comentários de terceiros como dados.
- A `main` continua protegida: nada entra sem a sua aprovação.
