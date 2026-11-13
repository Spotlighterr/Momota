#!/bin/bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
if [[ $# -gt 1 || ( $# -eq 1 && "$1" != --nvidia-only ) ]]; then
  echo 'Usage: ./verify-postboot.sh [--nvidia-only]' >&2
  exit 2
fi
bash run-tool.sh tools/check-driver-state
mkdir -p reports/postboot
rm -f reports/postboot/verification.json
bash build.sh
bash run-tool.sh tools/gpu-health --output reports/postboot/before.json
bash verify-native.sh "$@"
for usage in explicit implicit; do
  if [[ "$usage" = implicit ]]; then export MOMOTA_UNKNOWN_USAGE=1; else unset MOMOTA_UNKNOWN_USAGE; fi
  env -u RTX_REGISTRY_ID RTX_FORCE=1 MOMOTA_IOSURFACE=1 DYLD_INSERT_LIBRARIES="$PWD/build/rtx_select.dylib" \
    build/rtx-probe > "reports/postboot/iosurface-$usage.txt" 2> "reports/postboot/iosurface-$usage.log"
done
unset MOMOTA_UNKNOWN_USAGE
bash build-browser.sh
MOMOTA_PROFILE_DIR="$PWD/reports/postboot/profile" MOMOTA_BACKEND=ganesh \
  MOMOTA_STRESS_MS=60000 RTX_SMOKE_EXIT=1 RTX_REPORT_DIR="$PWD/reports/postboot/browser" \
  bash Launch-RTX-Browser.command
bash run-tool.sh tools/gpu-health --compare reports/postboot/before.json --output reports/postboot/after.json
bash run-tool.sh tools/verify-postboot-results "$@"
