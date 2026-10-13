# Button

Botão de ação do TableHub, com variantes por peso da ação.

Classes: `btn` + uma variante: `btn-primary`, `btn-ghost`, `btn-danger`, `btn-warn`; tamanho `btn-sm`; largura total `btn-block`. No app: `apps/web/src/styles.css` (`.btn`).

- **`btn-primary`**: a ação principal da área (Abrir uma mesa, Pronto, Voltar à mesa). Âmbar `primary` com texto `on-primary` e `shadow-press`, que afunda ao clicar. Um por área.
- **`btn`** (padrão): ações comuns (Entrar, Copiar código). `surface-raised` com borda `line-strong`.
- **`btn-ghost`**: ações discretas em listas (Subir, Descer, som). Normalmente com `btn-sm`.
- **`btn-danger`**: ações destrutivas (Encerrar, Remover jogador), contorno `accent`. Sempre peça confirmação.
- **`btn-warn`**: raro; uma ação urgente que não destrói nada.

O consumidor fornece o `<button>`, o texto e `disabled` quando a ação não está disponível (fica a 45% de opacidade). Altura mínima de 44px (34px no `btn-sm`) para toque. Texto diz o que acontece: "Abrir uma mesa", nunca "OK".
