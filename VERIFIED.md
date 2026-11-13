# Validation status

## November 14 resumed RTX checks

Later checks in the 02:27 boot selected RTX 3050 correctly and passed Metal
observer enumeration, 256/256 compute values and 4096/4096 rendered pixels.
IOSurface rendering passed with explicit and implicit texture usage. The Ganesh
browser passed a 60-second visible run with 6548 iterations, 219 resizes, correct
pixels, sandboxing and a captured frame. Code RTX separately selected NVIDIA and
returned `[64,127,191,255]` with GL error zero. No new relevant reports or AMD
recovery-counter increases appeared in that comparison window.

A subsequent browser run completed 7457 iterations/249 resizes with correct
pixels but failed frame capture while hidden. It remains a failed run; its
evidence is retained under `reports/continue-hidden-capture/`. Diagnostic loop
counts are not display FPS or evidence of sustained performance.

The subsequent sequential `./verify-postboot.sh --nvidia-only` run passed end to
end: 6631 iterations/222 resizes over 60059 ms, visible at start/end, correct
pixels, captured frame, GPU sandbox enabled and zero process failures. Its health
comparison found no new relevant reports or recovery-counter increases. The
success marker at `reports/postboot/verification.json` explicitly records
`scope: nvidia-only` and `amdFallbackTested: false`.

The new `--nvidia-only` verification option excludes AMD baseline/fallback
workloads and labels that scope explicitly. The complete nine-case suite has
not been revalidated on this boot. Ten ACPI interpreter scenarios passed again;
these execute synthetic firmware, not this laptop's ACPI recovery method.

The owner has no external monitor available for the required direct-output
trial, so whole-desktop rendering remains unvalidated.

## November 14 second-reset check

NVIDIA PCI visibility returned and all four installed/loaded NullMoth extensions
matched version 2.6.6. This establishes device discovery and driver loading only.
The AMD baseline compute command timed out, and new AMD GPU restart reports
identified the original VS Code helper. A separate NVIDIA-forced probe blocked
while Metal initialized the AMD device during enumeration, before NVIDIA
selection. Post-boot native, IOSurface and browser verification is incomplete.
See [boot investigation](docs/boot-initialization.md) for evidence and limits.

The native probe now arms a 45-second process alarm before Metal discovery,
covering setup outside its existing ten-second command wait. A kernel wait may
delay signal handling; the deadline is not a hardware reset or a driver fix.

## Historical validation

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
The AMD `recoveryCount` statistic changed from 0 to 1 and later 14, but subsequent
samples returned 1 and 0 in the same boot. Its cumulative semantics are unverified
on this driver; an increase is a review signal, not proof of a new GPU reset.
Health comparisons retain changes alongside actual crash/reset reports.
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

## C/TypeScript migration and REA investigation

The browser, inspector, driver-state check, health collector, and validation tools
are now strict TypeScript. IOKit statistics are read by a standalone C11 binary;
no authored JavaScript, Python, or Ruby remains in the repository. Emitted
JavaScript is kept under build/ and packaged into Electron. The old workspace JXA
probe was backed up locally and replaced by a TypeScript entrypoint calling the
native Metal probe with a process deadline.

The TypeScript browser passed a 60-second run: 7351 frames, 246 resizes, correct
pixels, and no context loss. The C adapter again passed all nine native scenarios.
Parser tests cover truncated streams, overflowing minidump RVAs, compositor thread
classification, and accelerator identity comparisons. Browser smoke checks now
fail on GPU/renderer process termination even if a later pixel check recovers.
The isolated termination check passed: only the test GPU child received SIGTERM,
and the browser rejected the run with exit code 1. A zero-stress startup check
also passed with a captured frame and zero process failures after bounded capture
retries were added. The TypeScript Code inspector passed actual NVIDIA readback
and closed only the selected test instance.
The final `verify-postboot.sh` run also passed end to end after migration:
7478 frames/250 resizes in 60 seconds, captured frame, zero process failures,
and no new crash/reset reports or recovery-statistic increase in that window.

REA inspected the installed Electron fuse bytes, parsed a historical Apple IPS
report, recorded a live original-Code GPU-process sample, and passively observed
the compiled diagnostic browser through CDP. Evidence and limitations are indexed
in [the investigation ledger](docs/gpu-investigation.md); full captures stay local.

Original VS Code still produced an AMD `.gpuRestart` report at 02:25 on November 4,
after the driver update. Its path names the original `/Applications` installation,
with `main0` and unpack shaders. Three 02:11–02:12 Crashpad dumps report
`VizCompositorThread`; the old health filter missed these because their thread
names lack `Gpu`. The filter and regression test now include that compositor.
The original VS Code stability issue is not resolved by the passing RTX tests.
