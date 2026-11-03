#!/bin/bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
python3 tools/check-driver-state.py
unset ELECTRON_RUN_AS_NODE
for key in ${!VSCODE_@}; do unset "$key"; done
export RTX_FORCE=1
export NVMTL_ANGLE_METAL=1
export RTX_REPORT_DIR="${RTX_REPORT_DIR:-$PWD/reports/browser}"
mkdir -p "$RTX_REPORT_DIR"
export DYLD_INSERT_LIBRARIES="$PWD/build/RTX Browser.app/Contents/Frameworks/rtx_select.dylib"
exec "$PWD/build/RTX Browser.app/Contents/MacOS/Code" "$@" 2>> "$RTX_REPORT_DIR/driver.log"
