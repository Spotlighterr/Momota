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

## November 4 stability follow-up

- The current AMD allocation reports 1 GB; earlier captures reported 512 MB.
- Original VS Code generated AMD reset reports containing Dawn/Graphite shaders.
- Restarting only its GPU child restored interaction, confirmed by the user.
- Historical AMD resets also identify `mediaanalysisd` and `VTMTSComputeFunction`.
- A new `mediaanalysisd` crash occurred inside NVK descriptor updates.
- Registry-filter failures, observer enumeration, compute, and pixel checks passed
  all nine native scenarios before the C extraction.
- IOSurface textures passed 4096-pixel checks with explicit and implicit usage.
- The Ganesh NVIDIA browser passed 7394 frames and 247 canvas resizes in 60 seconds,
  with no incorrect sampled pixels or context loss. No new relevant system crash
  or GPU reset reports were observed during the comparison window.
- Code RTX selected NVIDIA with GaneshGL, correct pixel readback, and GPU sandboxing.

These frame counts are diagnostic loop throughput, not display FPS or a benchmark.

NullMoth 2.6.6 has been installed using its official installer, with backup and
rollback prepared. Running kernel extensions still report 2.6.5 until restart.
Post-update hardware validation is pending. Momota now refuses GPU launch/tests
when installed and loaded driver versions differ.

GPU policy parsing and PCI matching have been extracted to C11 and their boundary
tests pass. The new adapter build succeeds; hardware regression must be rerun
after restart with matching driver versions. System-wide NVIDIA-primary rendering,
Safari routing, login-flow stability, and long-term validation remain unfinished.
