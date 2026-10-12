#!/usr/bin/env bash
# Publica o Worker com novas tentativas (a API do Cloudflare às vezes responde 5xx/timeout).
# Uso: scripts/deploy.sh [nome-do-worker]   (sem nome: produção, conforme wrangler.jsonc)
# Escreve url=<...> em $GITHUB_OUTPUT (se existir) e falha se a publicação não der certo.
set -euo pipefail

name="${1:-}"
attempts=3
cd "$(dirname "$0")/../apps/worker"

for i in $(seq 1 "$attempts"); do
  args=(deploy)
  [ -n "$name" ] && args+=(--name "$name")
  if npx wrangler "${args[@]}" 2>&1 | tee deploy.log; then
    url=$(grep -oE 'https://[a-zA-Z0-9.-]+\.workers\.dev' deploy.log | head -1 || true)
    if [ -n "$url" ]; then
      echo "Publicado em $url"
      [ -n "${GITHUB_OUTPUT:-}" ] && echo "url=$url" >> "$GITHUB_OUTPUT"
      exit 0
    fi
    echo "Publicação sem URL no log (tentativa $i/$attempts)" >&2
  else
    echo "wrangler deploy falhou (tentativa $i/$attempts)" >&2
  fi
  [ "$i" -lt "$attempts" ] && sleep $((i * 20))
done

echo "Falha ao publicar após $attempts tentativas" >&2
exit 1
