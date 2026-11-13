#!/bin/bash
# Stage a local trial from an explicit EFI snapshot; never install or reboot.
set -euo pipefail
cd -- "$(dirname -- "$0")"
if [[ $# -ne 2 ]]; then
  echo 'Usage: bash prepare-primebridge-trial.sh <snapshot EFI directory> <snapshot config.plist>' >&2
  exit 2
fi
source_efi="$1"
source_config="$2"
upstream="$PWD/build/system-rendering/PrimeBridge"
nullmoth="$PWD/build/system-rendering/nullmoth-2.6.6"
out="$PWD/build/system-rendering/trial-$(date +%Y%m%d-%H%M%S)"
buddy=/usr/libexec/PlistBuddy
[[ -d "$source_efi/OC" && -f "$source_config" ]]
[[ "$(git -C "$upstream" rev-parse HEAD)" = 9edabe2dde67a81e0cb2aa378bd6fc5601914473 ]]
[[ "$(git -C "$nullmoth" rev-parse HEAD)" = 470e391e8cf8d7e499cdabfa7f2daadb6e14bcfd ]]
[[ "$("$buddy" -c 'Print :Misc:Security:Vault' "$source_config")" = Optional ]]
for name in NVRMFB NVAccel; do
  for kext in "$nullmoth/patched/$name.kext" "/Library/Extensions/$name.kext"; do
    [[ "$("$buddy" -c 'Print :CFBundleVersion' "$kext/Contents/Info.plist")" = 2.6.6 ]]
  done
done
[[ -f "$upstream/PrimeBridge-source/build/PrimeBridge.kext/Contents/MacOS/PrimeBridge" ]]
mkdir "$out"
mkdir "$out/original" "$out/payload"
ditto "$source_efi" "$out/original/EFI"
cp "$source_config" "$out/original/EFI/OC/config.plist"
ditto "$out/original/EFI" "$out/EFI"
config="$out/EFI/OC/config.plist"
changes="$out/config-changes.txt"
index=0
found=0
while bundle=$("$buddy" -c "Print :Kernel:Add:$index:BundlePath" "$config" 2>/dev/null); do
  case "$bundle" in
    NootedRed.kext)
      "$buddy" -c "Set :Kernel:Add:$index:Enabled false" "$config"
      echo "Disable Kernel/Add/$index: $bundle" >> "$changes"
      found=1 ;;
    PrimeBridge.kext|NVAccel.kext|NVRMFB.kext)
      echo "Unexpected existing $bundle EFI entry; inspect this snapshot manually." >&2
      exit 1 ;;
  esac
  index=$((index + 1))
done
[[ "$found" = 1 ]]
entry=":Kernel:Add:$index"
"$buddy" -c "Add $entry dict" \
  -c "Add $entry:Arch string x86_64" \
  -c "Add $entry:BundlePath string PrimeBridge.kext" \
  -c "Add $entry:Comment string PrimeBridge trial" \
  -c "Add $entry:Enabled bool true" \
  -c "Add $entry:ExecutablePath string Contents/MacOS/PrimeBridge" \
  -c "Add $entry:MaxKernel string" -c "Add $entry:MinKernel string 19.0.0" \
  -c "Add $entry:PlistPath string Contents/Info.plist" "$config"
echo "Add Kernel/Add/$index: PrimeBridge.kext" >> "$changes"
index=0
while comment=$("$buddy" -c "Print :Kernel:Patch:$index:Comment" "$config" 2>/dev/null); do
  case "$comment" in
    *'Fix PAT'*)
      "$buddy" -c "Set :Kernel:Patch:$index:Enabled false" "$config"
      echo "Disable Kernel/Patch/$index: $comment" >> "$changes" ;;
  esac
  index=$((index + 1))
done
nv='7C436110-AB2A-4BBB-A880-FE41995C9F82'
args=$("$buddy" -c "Print :NVRAM:Add:$nv:boot-args" "$config")
for token in $args; do
  case "$token" in
    nvfbforce=*|nvcursor=*)
      case "$token" in nvfbforce=1|nvcursor=0) ;; *)
        echo "Conflicting trial argument: $token" >&2; exit 1 ;;
      esac ;;
  esac
done
for arg in nvfbforce=1 nvcursor=0 -nvrmnoflip; do
  case " $args " in *" $arg "*) ;; *) args="$args $arg" ;; esac
done
case " $args " in *' nvfb=1 '*) ;; *) exit 1 ;; esac
case " $args " in *' nvaccel=1 '*) ;; *) exit 1 ;; esac
case " $args " in *' -primeoff '*) echo 'Remove -primeoff from the trial snapshot first.' >&2; exit 1 ;; esac
"$buddy" -c "Set :NVRAM:Add:$nv:boot-args $args" "$config"
echo "Trial boot-args: $args" >> "$changes"
# Force OpenCore to apply the trial arguments rather than stale NVRAM values.
delete=$("$buddy" -c "Print :NVRAM:Delete:$nv" "$config")
if [[ "$delete" != *boot-args* ]]; then
  "$buddy" -c "Add :NVRAM:Delete:$nv: string boot-args" "$config"
fi
ditto "$upstream/PrimeBridge-source/build/PrimeBridge.kext" "$out/EFI/OC/Kexts/PrimeBridge.kext"
for name in NVRMFB NVAccel; do
  ditto "$nullmoth/patched/$name.kext" "$out/payload/$name.kext"
  ditto "/Library/Extensions/$name.kext" "$out/original/$name.kext"
done
plutil -lint "$config"
{
  echo "PrimeBridge commit: $(git -C "$upstream" rev-parse HEAD)"
  echo "NullMoth commit: $(git -C "$nullmoth" rev-parse HEAD)"
  echo 'Panel: 1920x1080, 144 Hz; generated forced HDMI mode: 72 Hz'
  echo 'Status: staged only; no installed kext, EFI, NVRAM or kernel collection changed'
  echo 'Not boot-ready: patched payload must be installed and the auxiliary collection rebuilt.'
  echo 'Live EFI identity, NVIDIA-wired HDMI desktop and USB recovery remain unverified.'
  shasum -a 256 "$source_config" "$config"
  for name in NVRMFB NVAccel; do
    shasum -a 256 "$out/payload/$name.kext/Contents/MacOS/$name" "/Library/Extensions/$name.kext/Contents/MacOS/$name"
  done
  shasum -a 256 "$out/EFI/OC/Kexts/PrimeBridge.kext/Contents/MacOS/PrimeBridge"
} > "$out/manifest.txt"
echo "Staged trial: $out"
