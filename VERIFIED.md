# Validation status

Tested on November 3, 2026. The user also confirmed that the trial apps worked.

## Test system

- ASUS ROG Zephyrus G14 GA401QC (2021), without a display MUX.
- AMD Ryzen 7 5800HS, 16 GB system RAM.
- NVIDIA RTX 3050 Laptop 4 GB, PCI `10de:25a2`.
- macOS 15.8.2; NullMoth 2.6.5; NootedRed 0.8.10.
- The internal display remains on AMD/NootedRed.

## Confirmed

| Check | Result |
| --- | --- |
| Native Metal default device with the shim | NVIDIA |
| Metal enumeration with the shim | NVIDIA only |
| Compute output | 256/256 correct integers |
| Texture render and readback | 4096/4096 correct pixels |
| Shim disabled or target unavailable | AMD fallback; compute and render pass |
| Test browser WebGL renderer | NVIDIA via ANGLE Metal |
| Browser pixel readback | `[128,128,64,255]`; GL error 0 |
| VS Code WebGL renderer | NVIDIA via ANGLE Metal |
| VS Code pixel readback | `[64,127,191,255]`; GL error 0 |
| Browser and VS Code GPU compositing/rasterization | Enabled |
| Browser and VS Code GPU process sandbox | Enabled |

Local reports and captured frames are under `reports/browser`, `reports/code`,
and `reports/native`. These generated files are excluded from Git.

## Remaining work

- Heavy workloads, sustained performance, and long-term stability.
- Real video decode and encode workloads; feature flags alone are not proof.
- Canvas 2D still reports software rendering.
- Safari and WindowServer have not been moved to NVIDIA.
- Other GPUs, laptops, and macOS versions have not been validated.

Run the `.command` launchers to use the trial apps. The VS Code copy has its own
settings and extensions directory; it does not import the original profile.
