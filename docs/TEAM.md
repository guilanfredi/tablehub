# Time de agentes

Cada função roda em **uma sessão separada** do Claude Code, iniciada com a skill da função.
As sessões não compartilham memória: **o PR no GitHub é o quadro de passagem** — etiquetas dizem de quem é a vez,
comentários carregam achados e decisões. O dono do repositório (@guilanfredi) é o único que aprova.

| Função | Comando | Entrega | Não faz |
|---|---|---|---|
| Analista de regras | `/analista <jogo>` | `RULES.md` + dúvidas de interpretação, PR em rascunho | código |
| Desenvolvedor | `/dev <PR>` | motor, testes, interface; corrige achados | aprovar, mudar regras sem aval |
| QA | `/qa <PR>` | jogo testado no navegador/celular, testes de regressão, relatório | corrigir o motor |
| Revisor | `/revisor <PR>` | revisão comentada do diff contra o `RULES.md` | editar código |
| Você | — | responde dúvidas, aprova e faz o merge | — |

## Fluxo de um jogo novo

```
manual em manuals/<id>.pdf
  └─ /analista  → branch game/<id>, RULES.md, PR rascunho        [fase:spec]
       você responde as dúvidas no PR e troca a etiqueta          → [fase:dev]
  └─ /dev       → motor + testes + interface, CI verde            → [fase:qa]
  └─ /qa        → joga com vários perfis, celular, casos de borda
                   ok → [fase:review]   bugs → comentários + [fase:dev]
  └─ /revisor   → revisão contra o RULES.md
                   ok → [pronto-para-aprovação] e PR sai do rascunho
                   achados → comentários + [fase:dev]
  └─ você aprova → merge → deploy automático
```

Mudanças que não são jogos novos (bugs, melhorias) começam direto no `/dev` com uma issue ou descrição.

## Etiquetas de fase
`fase:spec` · `fase:dev` · `fase:qa` · `fase:review` · `pronto-para-aprovação`

Cada sessão, ao terminar, troca a etiqueta (`gh pr edit <n> --remove-label X --add-label Y`) e deixa um comentário-resumo começando com o nome da função em negrito, ex.: **[QA]**.

## Identidade
Todas as funções usam a conta **gui-dev-bot** (commits e comentários). Por isso todo comentário começa com a função entre colchetes.
O GitHub não permite que o autor aprove ou peça mudanças formalmente no próprio PR — o revisor usa comentários,
e a aprovação formal é sempre de @guilanfredi (CODEOWNERS).

## Manuais
Manuais são material protegido por direitos autorais: ficam em `manuals/` (ignorado pelo git) e **nunca** vão para o repositório público.
O `RULES.md` é escrito com palavras próprias, como especificação técnica — não copie trechos do manual.

## Limites
- Máximo de 3 ciclos dev ↔ revisor/QA por PR; depois disso, a sessão para e pede decisão ao dono.
- Nenhuma função muda as regras de sala/plataforma ou o fluxo de CI sem que isso esteja explícito no PR.
