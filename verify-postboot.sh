#!/bin/bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
python3 tools/check-driver-state.py
mkdir -p reports/postboot
python3 tools/gpu-health.py --output reports/postboot/before.json
bash build.sh
bash verify-native.sh
for usage in explicit implicit; do
  if [[ "$usage" = implicit ]]; then export MOMOTA_UNKNOWN_USAGE=1; else unset MOMOTA_UNKNOWN_USAGE; fi
  env RTX_FORCE=1 MOMOTA_IOSURFACE=1 DYLD_INSERT_LIBRARIES="$PWD/build/rtx_select.dylib" \
    build/rtx-probe > "reports/postboot/iosurface-$usage.txt" 2> "reports/postboot/iosurface-$usage.log"
done
unset MOMOTA_UNKNOWN_USAGE
bash build-browser.sh
MOMOTA_PROFILE_DIR="$PWD/reports/postboot/profile" MOMOTA_BACKEND=ganesh \
  MOMOTA_STRESS_MS=60000 RTX_SMOKE_EXIT=1 RTX_REPORT_DIR="$PWD/reports/postboot/browser" \
  bash Launch-RTX-Browser.command
python3 tools/gpu-health.py --compare reports/postboot/before.json --output reports/postboot/after.json
python3 - <<'PY'
import json
health=json.load(open('reports/postboot/after.json'))
browser=json.load(open('reports/postboot/browser/browser-gpu.json'))
assert not health['newReports'], 'New GPU/crash reports appeared; inspect reports/postboot/after.json'
assert not health['recoveryCountIncreases'], 'GPU recovery counter increased; inspect reports/postboot/after.json'
assert browser['renderer']['ok'] and browser['stress']['ok']
print('Post-boot GPU checks: PASS; no new GPU/crash reports observed during this run')
PY
