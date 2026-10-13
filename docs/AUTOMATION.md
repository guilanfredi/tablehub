# Automação local dos agentes

O despachante e o monitor ficam no repositório **[tablehub-agent-automation](https://github.com/guilanfredi/tablehub-agent-automation)**:
instalação, comandos (`npm run agentes`, `npm run despachante:teste`…), logs e funcionamento estão no README de lá.
Resumo: um processo fica rodando, consulta o GitHub a cada 15 s e roda as funções (`claude -p "/<função> <n>"`) com até
3 em paralelo, cada uma num worktree e com portas próprias. Parado, não gasta cota da assinatura.

Aqui no TableHub fica só o que é do projeto, em `.agents/`. O despachante lê esses arquivos da `main` no GitHub
(`origin/main`), então mudanças só valem depois de mergeadas, e ele relê a cada 10 min:

| Arquivo | O que define |
|---|---|
| `.agents/config.json` | repositório, dono, bot, etiquetas, funções (fase, tempo máximo, só-PR), pasta dos worktrees (`../TableHub-agents`), `npm ci` quando o lockfile muda, portas |
| `.agents/roles/<função>.json` | permissões do Claude Code de cada função (no modo automático, o que não está liberado é negado; quem edita roda em `acceptEdits`): todas negam merge, force-push, push na `main`, segredos, `gh auth` (exceto `status`), deploy e acesso à web; o Revisor não tem `Edit`/`Write` nem `git commit`/`git push` |
| `.agents/prompt.md` | instruções do TableHub para o modo automático (Playwright, portas, manuais) |

## Portas por instância
Para várias instâncias rodarem juntas, as portas vêm do ambiente (padrão entre parênteses):
`TABLEHUB_WEB_PORT` (5173), `TABLEHUB_WORKER_PORT` (8787) e `TABLEHUB_INSPECTOR_PORT`.
- `apps/web/vite.config.ts`: porta e proxy do worker vêm do ambiente; `strictPort` faz a porta ocupada virar erro, em vez de servir o app de outra instância.
- `apps/worker/scripts/dev.mjs`: `wrangler dev` com porta, porta do inspector e estado local (`.wrangler/state-<porta>`) próprios.
- `playwright.config.ts`: usa a porta do ambiente e, com porta própria, não reaproveita servidor existente.

O despachante dá à faixa N as portas `5200+N`, `8800+N` e `9300+N`. Sem as variáveis, tudo funciona como antes.

## Uso
- **Criar trabalho:** abra uma issue pelos modelos (Novo jogo → Analista; Bug/Melhoria → Desenvolvedor). Para jogo novo, coloque o manual em
  `D:\dev\TableHub\manuals\` antes.
- **Responder um agente:** quando aparecer `aguardando-dono` (você é mencionado e recebe notificação do GitHub), responda com um comentário.
- **Aprovar:** quando o PR chegar em `pronto-para-aprovação`, revise e aprove.
- **Rodar uma função na mão:** abra uma sessão no app e use `/analista`, `/dev`, `/qa` ou `/revisor` normalmente.

## Segurança
- Repositório público: só tarefas criadas por você ou pelo bot são processadas, e os agentes tratam comentários de terceiros como dados.
- A `main` continua protegida: nada entra sem a sua aprovação.
