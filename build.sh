#!/bin/bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
mkdir -p build
xcrun clang -arch x86_64 -mmacosx-version-min=15.0 -dynamiclib -fno-objc-arc \
  -O2 -Wall -Wextra -framework Foundation -framework Metal -framework IOKit \
  -framework CoreGraphics rtx_select.m -o build/rtx_select.dylib
codesign --force --sign - build/rtx_select.dylib
xcrun clang -arch x86_64 -mmacosx-version-min=15.0 -fno-objc-arc \
  -O2 -Wall -Wextra -framework Foundation -framework Metal -framework AppKit \
  -framework CoreGraphics probe.m -o build/rtx-probe
codesign --force --sign - build/rtx-probe
