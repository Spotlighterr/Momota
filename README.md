# Momota

Experimental NVIDIA render offload for macOS Hackintosh.
Selected apps render on NVIDIA while AMD drives the laptop display.
The long-term objective is NVIDIA-primary rendering with AMD used for display
output. System-wide routing is not implemented yet.

## Current status

Working on an ASUS GA401QC (2021) with RTX 3050 Laptop 4 GB, macOS 15.8.2,
NullMoth 2.6.5, and NootedRed 0.8.10:

- NVIDIA rendering in the test browser and a separate copy of VS Code.
- Correct Metal compute and rendered pixel results.
- Chromium GPU sandbox stays enabled.

Safari and desktop composition still use AMD. Long-term stability and heavy
workloads have not been validated. See [test results](VERIFIED.md).

## Build and run

Requires working GPU drivers, Apple Command Line Tools, and x86_64 VS Code at
`/Applications/Visual Studio Code.app`.

```sh
git clone https://github.com/Spotlighterr/Momota.git
cd Momota
./build.sh
./verify-native.sh
./build-browser.sh
./prepare-code.sh
./Launch-RTX-Browser.command
```

Use `./Launch-Code-RTX.command` for VS Code. Both launchers use separate profiles.
The default renderer uses Ganesh over ANGLE Metal to avoid the Graphite path involved
in observed AMD GPU resets. `Launch-Code-Compatible.command` starts the original,
signed VS Code with Graphite disabled; close its existing instance first.
The test app copies are signed ad hoc to load the shim. Read [usage and limits](docs/usage.md)
before using them beyond testing.

For a local GPU health report, run `python3 tools/gpu-health.py`.
After a driver update and restart, run `./verify-postboot.sh`.

The GPU selection policy is C11; a thin Objective-C adapter calls Metal and IOKit.
JavaScript is used for the diagnostic browser, not the native selection policy.

## Credits

- **[NullMoth](https://github.com/nullmoth/nvidia-macos-driver)** provides the NVIDIA
  driver and headless rendering path. Momota selects the GPU; it is not a GPU driver.
- [NootedRed](https://github.com/ChefKissInc/NootedRed) enables the AMD integrated GPU.
- [macos-discrete-gpu](https://github.com/sid-ravikumar/macos-discrete-gpu) inspired
  the Metal interposition approach.
- The local test apps reuse the Electron runtime installed with VS Code.
