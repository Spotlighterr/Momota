#!/bin/bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
app="$PWD/build/Code RTX.app"
if pgrep -f "^$app/Contents/MacOS/Code([[:space:]]|$)" >/dev/null; then
  echo 'Close Code RTX before rebuilding its signed application bundle.' >&2
  exit 1
fi
if [[ ! -d "$app" ]]; then
  mkdir -p build
  cp -cR '/Applications/Visual Studio Code.app' "$app"
fi
cp build/rtx_select.dylib "$app/Contents/Frameworks/rtx_select.dylib"
mkdir -p code-profile/User
if [[ ! -f code-profile/User/settings.json ]]; then
  cp profiles/code-settings.json code-profile/User/settings.json
fi
# Keep the original application intact; this copied runtime permits the scoped shim.
codesign --force --deep --sign - --options 0 --preserve-metadata=entitlements "$app"
