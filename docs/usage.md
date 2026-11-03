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

Variables are scoped to the launched app and its children. Closing it stops using
the shim. No background service, global injection, or startup item is installed.

## Apps

Use the `.command` launchers rather than opening the copied app bundles directly.

- The browser uses `RTX Browser Test` under the user's Application Support folder.
  Its GPU button returns to the WebGL check.
- VS Code uses the project's `code-profile` and `code-extensions` directories.
  Original settings and extensions are not imported.

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
