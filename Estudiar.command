#!/bin/zsh
# Doble clic para abrir el Cuaderno de Certificaciones en http://127.0.0.1:3901
cd "$(dirname "$0")"
[ -d node_modules ] || npm install
if [ ! -f .next/BUILD_ID ] || [ -n "$(find src content -newer .next/BUILD_ID -type f | head -1)" ]; then
  echo "Preparando la plataforma (solo tarda la primera vez o tras cambios)…"
  npm run build || exit 1
fi
if ! lsof -iTCP:3901 -sTCP:LISTEN >/dev/null 2>&1; then
  npm start &
  for i in {1..40}; do curl -s -o /dev/null http://127.0.0.1:3901/ && break; sleep 0.5; done
fi
open http://127.0.0.1:3901/ai-901
echo "Plataforma abierta. Deja esta ventana abierta mientras estudias; ciérrala para apagarla."
wait
