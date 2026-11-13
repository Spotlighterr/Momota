#!/bin/bash
set -euo pipefail
unset ELECTRON_RUN_AS_NODE
for key in ${!VSCODE_@}; do unset "$key"; done
app='/Applications/Visual Studio Code.app/Contents/MacOS/Code'
if /bin/ps -axo comm= | /usr/bin/grep -Fx "$app" >/dev/null; then
  echo 'Close the original VS Code first so the rendering flags can take effect.' >&2
  exit 2
fi
# Preserve the original signed application and profile; avoid the Dawn/Graphite path.
exec "$app" --use-angle=metal --disable-features=SkiaGraphite "$@"
