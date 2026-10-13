# Field

Campo de texto, select e campo de código da mesa, com rótulo.

Classes: `label` no `<label>`, `input` no `<input>`, `select` no `<select>`, e `code-input` somado a `input` para o código de 5 caracteres. No app: `Home.tsx` (apelido e código) e `OptionsForm.tsx` (opções do jogo).

- Fundo `surface-raised`, borda 2px `line-strong` (3:1), foco com anel `primary`.
- Placeholder em `ink-muted`, dizendo o que escrever: "Como os outros vão te chamar".
- O `code-input` usa Fredoka 22px, caixa-alta e espaçamento largo, igual ao `TableCode`.
- Erros aparecem num `Banner` logo abaixo do formulário, não dentro do campo.

O consumidor fornece `id` ligado ao `htmlFor` do rótulo, `maxLength` e o texto do rótulo.
