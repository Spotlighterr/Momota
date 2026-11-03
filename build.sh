#!/bin/bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
mkdir -p build
xcrun clang -std=c11 -O2 -Wall -Wextra -Werror -Inative native/gpu_policy.c \
  tests/gpu_policy_test.c -o build/gpu-policy-test
./build/gpu-policy-test
xcrun clang -arch x86_64 -mmacosx-version-min=15.0 -dynamiclib -fno-objc-arc \
  -O2 -Wall -Wextra -framework Foundation -framework Metal -framework IOKit \
  -framework CoreGraphics rtx_select.m native/gpu_policy.c -o build/rtx_select.dylib
codesign --force --sign - build/rtx_select.dylib
xcrun clang -arch x86_64 -mmacosx-version-min=15.0 -fno-objc-arc \
  -O2 -Wall -Wextra -framework Foundation -framework Metal -framework AppKit \
  -framework CoreGraphics -framework IOSurface probe.m -o build/rtx-probe
codesign --force --sign - build/rtx-probe
