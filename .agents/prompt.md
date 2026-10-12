Instruções do TableHub para o modo automático:
- Não há navegador embutido nesta sessão: para testes de interface use Playwright (`npm run e2e` e roteiros em `e2e/`).
- `npm run dev` e `npm run e2e` já usam as portas desta instância (`TABLEHUB_WEB_PORT`, `TABLEHUB_WORKER_PORT`); nunca use 5173/8787. Para o smoke test: `node scripts/smoke.mjs http://localhost:$TABLEHUB_WORKER_PORT`.
- Manuais de jogos ficam na pasta `manuals` da cópia principal (fora do git, já liberada para leitura).
