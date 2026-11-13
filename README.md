# Momota

Experimental NVIDIA render offload for macOS Hackintosh.
Selected apps render on NVIDIA while AMD drives the laptop display.
The long-term objective is NVIDIA-primary rendering with AMD used for display
output. System-wide routing is not implemented yet.

## Current status

Working on an ASUS GA401QC (2021) with RTX 3050 Laptop 4 GB, macOS 15.8.2,
NullMoth 2.6.6, and NootedRed 0.8.10:

- NVIDIA rendering in the test browser and a separate copy of VS Code.
- Correct Metal compute and rendered pixel results.
- Chromium GPU sandbox stays enabled.

Safari and desktop composition still use AMD. Long-term stability and heavy
workloads have not been validated. See [test results](VERIFIED.md).
The [system rendering investigation](docs/system-rendering.md) tracks newer
upstream hybrid paths and the prerequisites for a full desktop trial.
PrimeBridge trial artifacts have been built locally; whole-desktop boot testing
is still pending.
See [boot initialization](docs/boot-initialization.md) for experimental ASUS GPU
recovery and the ALC285 audio investigation.

## Build and run

Requires working GPU drivers, Apple Command Line Tools, Node.js 24, and x86_64 VS Code at
`/Applications/Visual Studio Code.app`.

```sh
git clone https://github.com/Spotlighterr/Momota.git
cd Momota
./build.sh
./build-typescript.sh
./verify-native.sh
./build-browser.sh
./prepare-code.sh
./Launch-RTX-Browser.command
```

Use `./Launch-Code-RTX.command` for VS Code. Both launchers use separate profiles.
The default renderer uses Ganesh over ANGLE Metal to avoid the Graphite path involved
in observed AMD GPU resets. `Launch-Code-Compatible.command` starts the original,
signed VS Code with Graphite disabled; close its existing instance first.
For recurring freezes, `Launch-Code-Software.command` starts original VS Code
with GPU acceleration disabled as a temporary workaround.
The test app copies are signed ad hoc to load the shim. Read [usage and limits](docs/usage.md)
before using them beyond testing.

For a local GPU health report, run `./run-tool.sh tools/gpu-health`.
After a driver update and restart, run `./verify-postboot.sh`.
Use `./verify-postboot.sh --nvidia-only` to check RTX while avoiding the AMD
baseline/fallback workloads involved in the current freeze investigation.

The GPU selection policy is C11; a thin Objective-C adapter calls Metal and IOKit.
TypeScript supplies the diagnostic browser and tools; generated JavaScript stays
in the build directory. GPU statistics and selection policy use C.

## Credits

- **[NullMoth](https://github.com/nullmoth/nvidia-macos-driver)** provides the NVIDIA
  driver and headless rendering path. Momota selects the GPU; it is not a GPU driver.
- [NootedRed](https://github.com/ChefKissInc/NootedRed) enables the AMD integrated GPU.
- [macos-discrete-gpu](https://github.com/sid-ravikumar/macos-discrete-gpu) inspired
  the Metal interposition approach.
- The local test apps reuse the Electron runtime installed with VS Code.
