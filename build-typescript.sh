#!/bin/bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
if ! command -v node >/dev/null 2>&1; then
  runtime="$HOME/.local/share/momota-tools/node-current/bin"
  if [[ ! -x "$runtime/node" ]]; then
    echo 'Node.js 24 is required to compile the TypeScript tools.' >&2
    exit 1
  fi
  export PATH="$runtime:$PATH"
fi
if [[ ! -f node_modules/typescript/bin/tsc ]]; then
  echo 'Installing pinned TypeScript build dependencies; Electron runtime download is disabled.' >&2
  ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci --ignore-scripts --no-audit --no-fund
fi
node node_modules/typescript/bin/tsc -p tsconfig.json "$@"
