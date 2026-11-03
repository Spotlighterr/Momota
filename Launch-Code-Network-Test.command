#!/bin/bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
exec /bin/bash run-tool.sh tools/launch-code-network-test "$@"
