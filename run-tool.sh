#!/bin/bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
if [[ $# -lt 1 || ! "$1" =~ ^((tools|tests)/[a-zA-Z0-9_.-]+|inspect-code)$ ]]; then
  echo 'Usage: ./run-tool.sh tools/tool-name [arguments] or ./run-tool.sh inspect-code [arguments]' >&2
  exit 2
fi
tool="$1"
shift
if [[ ! -f "$tool.ts" ]]; then
  echo "TypeScript tool not found: $tool.ts" >&2
  exit 2
fi
output="build/js/$tool.js"
rebuild=0
# Imported modules, shared declarations and compiler settings affect emitted tools.
for source in browser/*.ts tools/*.ts tests/*.ts inspect-code.ts tsconfig.json package-lock.json build-typescript.sh; do
  if [[ "$source" -nt "$output" ]]; then rebuild=1; break; fi
done
if [[ ! -f "$output" || "$rebuild" = 1 ]]; then
  bash build-typescript.sh
fi
if command -v node >/dev/null 2>&1; then
  exec node "$output" "$@"
fi
exec "$HOME/.local/share/momota-tools/node-current/bin/node" "$output" "$@"
