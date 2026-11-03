#!/bin/bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
bash run-tool.sh tools/check-driver-state
mkdir -p reports/native
env -u RTX_FORCE -u RTX_REGISTRY_ID -u DYLD_INSERT_LIBRARIES \
  ./build/rtx-probe > reports/native/baseline.txt 2> reports/native/baseline.log
env -u RTX_REGISTRY_ID RTX_FORCE=1 DYLD_INSERT_LIBRARIES="$PWD/build/rtx_select.dylib" \
  ./build/rtx-probe > reports/native/forced.txt 2> reports/native/forced.log
env -u RTX_REGISTRY_ID RTX_FORCE=0 DYLD_INSERT_LIBRARIES="$PWD/build/rtx_select.dylib" \
  ./build/rtx-probe > reports/native/disabled.txt 2> reports/native/disabled.log
env RTX_FORCE=1 RTX_REGISTRY_ID=1 DYLD_INSERT_LIBRARIES="$PWD/build/rtx_select.dylib" \
  ./build/rtx-probe > reports/native/missing-target.txt 2> reports/native/missing-target.log
for value in invalid 0 -1 18446744073709551616 ''; do
  name="invalid-${value:-empty}"
  env RTX_FORCE=1 RTX_REGISTRY_ID="$value" DYLD_INSERT_LIBRARIES="$PWD/build/rtx_select.dylib" \
    ./build/rtx-probe > "reports/native/$name.txt" 2> "reports/native/$name.log"
done
bash run-tool.sh tools/verify-native-results
