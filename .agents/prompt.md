Instruções do TableHub para o modo automático:
- Não há navegador embutido nesta sessão: para testes de interface use Playwright (`npm run e2e` e roteiros em `e2e/`).
- `npm run dev` e `npm run e2e` já usam as portas desta instância (`TABLEHUB_WEB_PORT`, `TABLEHUB_WORKER_PORT`); nunca use 5173/8787. Para o smoke test: `node scripts/smoke.mjs http://localhost:$TABLEHUB_WORKER_PORT`.
- e2e: rode só os specs da sua tarefa (veja a skill da função); a suíte completa roda no CI (job `e2e`). O `npm run e2e`
  testa o app compilado (`vite preview`), então cada execução recompila. Outros agentes rodam testes na mesma máquina:
  falha por tempo esgotado (`Test timeout`, `waitForURL`) pode ser só lentidão. Antes de investigar, rode de novo **uma vez**
  só o teste que falhou (`npm run e2e -- e2e/<arquivo>.spec.ts -g "<nome>" --project=desktop`); se passar, não é bug.
- Manuais de jogos ficam na pasta `manuals` da cópia principal (fora do git, já liberada para leitura).
- Permissões: comandos fora da lista de `.agents/roles/<função>.json` são negados sem perguntar. Prefira um comando simples por chamada
  (sem laços `for`/`while` nem `;` encadeando vários); para filtrar saída use `grep`/`head`/`tail`; para repetir testes, rode o comando de novo.
- Arquivos temporários de investigação (testes de estresse, logs): apague com `rm <arquivo>` antes de commitar e confira `git status`.
- Economia de contexto (cada turno relê tudo o que já entrou na conversa): prefira saídas curtas, como
  `npx vitest run --reporter=dot` e `npx playwright test --reporter=line`; filtre logs com `grep`/`tail`; leia só o trecho
  necessário de arquivos grandes (offset/limit) em vez do arquivo inteiro.
