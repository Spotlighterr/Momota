# NVIDIA-primary rendering objective

The target is NVIDIA doing the rendering while AMD provides the internal display
output on the muxless GA401QC. Current app-scoped offload is a verified milestone,
not completion of that system-wide objective.

## Native core

- `native/gpu_policy.c`: C11 registry-filter parsing and PCI identity matching.
- `rtx_select.m`: the Objective-C adapter for Metal device objects and IOKit.
- `probe.m`: native Metal compute, texture, and IOSurface regression checks.
- `browser/`: JavaScript diagnostic UI and WebGL stress checks.

The policy has no interpreted runtime, heap allocation, or third-party dependency.
Objective-C remains at the platform boundary because Metal exposes Objective-C
objects. A TypeScript rewrite would not accelerate GPU execution or fix the
driver's cross-GPU display path.

## Unresolved system-wide path

NullMoth's headless path exposes NVIDIA to applications and copies completed
IOSurfaces to the display GPU. Its plugin deliberately keeps WindowServer on the
GPU that owns the display. Momota's per-process interposition does not override
that kernel/framebuffer integration or protected system process behavior.

`NVPrimarySelector` is not an Optimus routing switch. It selects the NVIDIA card
owning the firmware console on multi-NVIDIA systems; its documented qualification
does not establish NVIDIA rendering through an AMD-owned internal panel. Enabling
that match on this laptop is not an established solution.

References: [headless implementation](https://github.com/nullmoth/nvidia-macos-driver/commit/f41eee3),
[primary selector scope](https://github.com/nullmoth/nvidia-macos-driver/blob/main/docs/AUTO-PRIMARY-GPU.md).

System-wide support requires demonstrating a compatible compositor/render-device
and framebuffer-sharing path. Disabling AMD acceleration or removing the driver's
WindowServer guard alone is not evidence that this path works.

## Post-update hardware validation

The November 4 restart loaded all four NullMoth 2.6.6 kernel extensions. The C
adapter passed all nine native scenarios and both IOSurface usage variants;
the browser and Code RTX selected NVIDIA and returned correct pixels.
Run `./verify-postboot.sh` after future driver updates. Inspect new system GPU
resets and application crashes before expanding the routing scope.
