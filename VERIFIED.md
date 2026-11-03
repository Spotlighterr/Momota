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

NullMoth 2.6.6 was installed using its official installer, with backup and
rollback prepared. After the November 4 restart, all four loaded extensions
match the installed 2.6.6 versions. Momota refuses GPU launch/tests when
installed and loaded driver versions differ.

GPU policy parsing and PCI matching have been extracted to C11 and their boundary
tests pass. After restart, the C adapter passed all nine native hardware scenarios
and both explicit/implicit IOSurface usage checks. The browser completed a
60-second loop with correct pixels and no new relevant crash/reset reports;
Code RTX also selected NVIDIA and returned correct pixels with sandboxing enabled.
Initial diagnostic loop throughput varied substantially between runs (9 and 50
iterations/second). Automated browser checks now disable background throttling
and record document visibility so window scheduling does not silently limit the
timer-driven loop. The resulting 60-second run completed 7425 frames and 248
resizes with no pixel errors or context loss (124 iterations/second).
This is diagnostic throughput, not display FPS or proof of general performance.
System-wide NVIDIA-primary rendering,
Safari routing, login-flow stability, and long-term validation remain unfinished.

### Recurring original VS Code stalls

GPU diagnostic dumps at 01:46, 01:52, and 01:55 came from `CrGpuMain`. A later
`GpuWatchdog` dump and an AMD GPU reset at 01:57 identify continued GPU instability
in the original VS Code session. The later reset includes `main0` and unpack shaders,
so disabling Graphite alone must not be presented as a complete AMD driver fix.
At inspection, AMD had roughly 500 MB of free VRAM and system swap usage was zero.

The health collector now includes Chromium Crashpad GPU diagnostics in addition
to macOS reports. A diagnostic dump is reported as such, not automatically labeled
as a fatal exception. Raw minidumps remain local and are not included in Git.
