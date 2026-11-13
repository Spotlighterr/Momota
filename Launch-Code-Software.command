#!/bin/bash
set -euo pipefail
unset ELECTRON_RUN_AS_NODE DYLD_INSERT_LIBRARIES RTX_FORCE RTX_REGISTRY_ID
for key in ${!VSCODE_@}; do unset "$key"; done
app='/Applications/Visual Studio Code.app/Contents/MacOS/Code'
if /bin/ps -axo comm= | /usr/bin/grep -Fx "$app" >/dev/null; then
  echo 'Save your work and close the original VS Code first so software rendering can take effect.' >&2
  exit 2
fi
# Keep the signed application and existing profile; bypass accelerated app rendering.
exec "$app" --disable-gpu "$@"
