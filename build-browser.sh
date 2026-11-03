#!/bin/bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
base="$PWD"
app="$base/build/RTX Browser.app"
source_app='/Applications/Visual Studio Code.app'
if pgrep -f "^$app/Contents/MacOS/Code([[:space:]]|$)" >/dev/null; then
  echo 'Close RTX Browser before rebuilding its signed application bundle.' >&2
  exit 1
fi
bash build-typescript.sh
if [[ ! -d "$app" ]]; then
  mkdir -p "$app/Contents/Resources" "$app/Contents/MacOS"
  cp -cR "$source_app/Contents/Frameworks" "$app/Contents/Frameworks"
  cp "$source_app/Contents/MacOS/Code" "$app/Contents/MacOS/Code"
  cp "$source_app/Contents/Resources/Code.icns" "$app/Contents/Resources/Code.icns"
  cp "$source_app/Contents/Resources/LICENSES.chromium.html" "$app/Contents/Resources/LICENSES.chromium.html"
fi
mkdir -p "$app/Contents/Resources/app"
cp browser/*.html browser/package.json "$app/Contents/Resources/app/"
cp build/js/browser/*.js "$app/Contents/Resources/app/"
cp build/rtx_select.dylib "$app/Contents/Frameworks/rtx_select.dylib"
cat > "$app/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleName</key><string>Code</string>
<key>CFBundleDisplayName</key><string>RTX Browser</string>
<key>CFBundleIdentifier</key><string>local.ga401qc.rtx-browser</string>
<key>CFBundleExecutable</key><string>Code</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleVersion</key><string>0.1.0</string>
<key>CFBundleShortVersionString</key><string>0.1.0</string>
<key>CFBundleIconFile</key><string>Code.icns</string>
<key>LSMinimumSystemVersion</key><string>15.0</string>
<key>NSPrincipalClass</key><string>AtomApplication</string>
<key>NSHighResolutionCapable</key><true/>
<key>NSSupportsAutomaticGraphicsSwitching</key><true/>
</dict></plist>
PLIST
codesign --force --deep --sign - --options 0 --preserve-metadata=entitlements "$app"
