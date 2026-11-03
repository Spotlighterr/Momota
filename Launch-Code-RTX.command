#!/bin/bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
python3 tools/check-driver-state.py
unset ELECTRON_RUN_AS_NODE
for key in ${!VSCODE_@}; do unset "$key"; done
mkdir -p reports/code
export RTX_FORCE=1
export NVMTL_ANGLE_METAL=1
export DYLD_INSERT_LIBRARIES="$PWD/build/Code RTX.app/Contents/Frameworks/rtx_select.dylib"
exec "$PWD/build/Code RTX.app/Contents/MacOS/Code" \
  --user-data-dir "$PWD/code-profile" --extensions-dir "$PWD/code-extensions" \
  --use-angle=metal --force-high-performance-gpu --disable-features=SkiaGraphite "$@" \
  2>> "$PWD/reports/code/driver.log"
