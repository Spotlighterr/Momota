# Usage and limits

Momota selects a Metal GPU per application. NullMoth handles NVIDIA execution and
headless frame transfer; AMD/NootedRed drives the internal display and WindowServer.

## Selection

The shim walks from each Metal accelerator to its PCI parent and selects NVIDIA
vendor `10de`, device `25a2`. This currently targets the tested RTX 3050 Laptop.
Both GPUs report `lowPower=false`, so that property cannot distinguish them.

- `RTX_FORCE=1` enables selection in the target process.
- `RTX_REGISTRY_ID` optionally selects a current-boot registry ID.
- An unavailable or ambiguous target preserves the original selection.
- Selection applies on battery and AC power.
- Invalid, zero, negative, empty, or overflowing registry IDs preserve normal selection.
- Observer enumeration and callbacks expose the same selected device.

Variables are scoped to the launched app and its children. Closing it stops using
the shim. No background service, global injection, or startup item is installed.

## Apps

Use the `.command` launchers rather than opening the copied app bundles directly.

- The browser uses `RTX Browser Test` under the user's Application Support folder.
  Its GPU button returns to the WebGL check.
- VS Code uses the project's `code-profile` and `code-extensions` directories.
  Original settings and extensions are not imported.
- `Launch-Code-Compatible.command` keeps the original signed VS Code and profile,
  but disables Skia Graphite. The original app must be closed before launching it.

The default browser and Code RTX use Ganesh over ANGLE Metal. The test browser also
accepts `MOMOTA_BACKEND=graphite` for controlled comparison. This is a mitigation
for the observed Graphite/Dawn hangs, not proof that every AMD shader issue is fixed.

## Security and maintenance

The copied apps and helpers are signed ad hoc without hardened runtime so the
shim can load. Chromium content and GPU sandboxes remain enabled in validated runs.
Removing hardened runtime is a security tradeoff limited to these local copies.
These experimental apps are not official browser releases. Use a maintained,
normally signed browser for sensitive browsing.

The VS Code copy does not update with the original. Recreate and verify it after
updating the original installation. Momota does not change EFI, drivers, UMA, or
SIP. Safari and WindowServer still use AMD; NVIDIA VRAM stays a separate pool.

## Verification

`./verify-native.sh` checks the AMD baseline, forced NVIDIA selection, disabled
selection, and a missing target. Each case checks 256 computed integers and 4096
rendered pixels. Browser reports and a captured frame are under `reports/browser`.

For a controlled VS Code run, launch with
`--remote-debugging-port=9339 --disable-extensions --new-window`, then run
`inspect-code.mjs` with Node.js 24. `RTX_CLOSE_TEST=1` closes that test instance after
inspection. Restart normally afterward to close the debugging endpoint.

Small passing tests do not establish sustained performance or compatibility with
every application.

## Stress and crash checks

Set `MOMOTA_STRESS_MS=60000 RTX_SMOKE_EXIT=1` when launching the browser for a
60-second resize and pixel-readback check. `MOMOTA_PROFILE_DIR` and `RTX_REPORT_DIR`
can select isolated profile and report paths. The test exits nonzero on failure,
and GPU/context failures are shown in the UI instead of an unconditional RTX badge.

`python3 tools/gpu-health.py --output reports/health/before.json` records a baseline.
After testing, use `--compare reports/health/before.json --output reports/health/after.json`
to identify new local GPU reset or relevant crash reports. This tool does not upload
logs or read authentication tokens.

The native probe has a ten-second command timeout. `MOMOTA_IOSURFACE=1` enables the
shared-texture path; `MOMOTA_UNKNOWN_USAGE=1` tests implicit texture usage.

## Driver updates

The launchers and native verification compare installed and running NullMoth
versions. A pending update blocks GPU tests until a restart prevents mixing the
new user-space libraries with the previous running kernel components.

After restarting, run `./verify-postboot.sh`. It rebuilds the native adapter, checks
device selection and IOSurface paths, runs a 60-second browser stress test, and
compares system crash reports. It does not restart the machine itself.
