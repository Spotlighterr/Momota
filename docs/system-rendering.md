# System rendering: upstream review and next experiment

Reviewed November 14, 2026. Upstream claims below are distinct from Momota's
hardware validation. No driver, boot argument, or EFI change was made in this review.

## Upstream updates

| Project | Latest published release | Latest default-branch commit checked | Relevance |
| --- | --- | --- | --- |
| [NullMoth](https://github.com/nullmoth/nvidia-macos-driver/releases/tag/v2.9) | 2.9, November 10 | `7412cdde`, November 10 | Experimental hybrid desktop rendering; WindowServer sleep/device-loss/cache fixes; Ampere video updates. |
| [PrimeBridge](https://github.com/myvoow/PrimeBridge/releases/tag/v0.7.1) | 0.7.1, November 9 | `9edabe2d`, November 10 | NVIDIA WindowServer output through the AMD firmware framebuffer; Vega IDs included. |
| [NootedRed](https://github.com/ChefKissInc/NootedRed/releases/tag/v0.8.10) | 0.8.10, May 15 | `9ff85a66`, October 10 | No new release since the project's previous verification. [Blend issue #158](https://github.com/ChefKissInc/NootedRed/issues/158) remains open. |
| [macos-discrete-gpu](https://github.com/sid-ravikumar/macos-discrete-gpu) | No published release returned by GitHub's latest-release endpoint | `cff1d3a6`, March 10 | Still an application Metal-selection shim; no newly demonstrated hybrid compositor path. |
| [Lilu](https://github.com/acidanthera/Lilu/releases/tag/1.7.2) | 1.7.2, March 20 | `0249c3a9`, October 26 | Published fix targets AMDSupport on macOS 26, not proof of a Sequoia routing fix. Local loaded version is 1.7.3. |
| [WhateverGreen](https://github.com/acidanthera/WhateverGreen/releases/tag/1.7.1) | 1.7.1, September 27 | `093e76fe`, September 27 | IORegistry property-routing support; no demonstrated NVIDIA-to-Vega desktop solution. |

NullMoth also has open, unmerged November 13 PRs #573–580 covering GL uniforms,
sampler bindings, buffer bounds, imported-storage lifetime and copy paths.
They are not part of the 2.9 release merely because the PRs exist.

## Two candidate paths

### NullMoth 2.9 native hybrid

The [pinned hybrid guide](https://github.com/nullmoth/nvidia-macos-driver/blob/7412cdde81447f78da0ebb64216dc258d8beaedb/docs/HYBRID-LAPTOPS.md)
describes WindowServer composing on NVIDIA, with an iGPU panel provider registered
as head 4. `nmhybrid=1` copies changed pixels into the panel framebuffer. Higher
import/owned/copy-engine levels target specific Intel display generations; they
are not an AMD Vega optimization path.

The guide explicitly says this implementation has only offline tests and no
hybrid-laptop run. The optional NMGopFB component is not in the standard package.
Its [selection code](https://github.com/nullmoth/nvidia-macos-driver/blob/7412cdde81447f78da0ebb64216dc258d8beaedb/kexts/NMGopFB/nm_gopfb.h)
declines Vega by default. The tester override `nmgopid` exists, but does not prove
safe coexistence with NootedRed or correct scanout on this laptop. Simply updating
to 2.9 and adding `nmhybrid=1` is therefore not a demonstrated GA401QC solution.

### PrimeBridge 0.7.1

The [pinned compatibility table](https://github.com/myvoow/PrimeBridge/blob/9edabe2dde67a81e0cb2aa378bd6fc5601914473/docs/compatibility.md)
includes Vega `1002:1638`, which matches the local IORegistry. Upstream reports two
working laptops using `1002:1681`, including a Ryzen 7 6800H with RTX 3050. These
are upstream reports, not Momota reproductions; Vega remains untested.

PrimeBridge requires an NVIDIA-wired HDMI port and an accelerated desktop working
on that output. Its supported NullMoth range is 2.6.3–2.8.1; its patches do not
apply to 2.9. PrimeBridge and NootedRed cannot own the Vega GPU together, and the
installer stops when NootedRed is loaded. The [installer guide](https://github.com/myvoow/PrimeBridge/blob/9edabe2dde67a81e0cb2aa378bd6fc5601914473/docs/install.md)
describes patched NVAccel/NVRMFB, EFI edits, Fix PAT changes and rollback.

This is the first candidate to inspect for this machine because it explicitly
matches Vega and the installed NullMoth 2.6.6 falls within its documented range.
That is an engineering inference, not a compatibility verdict. Do not combine
PrimeBridge with a simultaneous upgrade to NullMoth 2.9.

## Current machine observations

Read-only checks during this review found:

- macOS 15.8.2, build 24H232.
- NootedRed 0.8.10 and Lilu 1.7.3 loaded.
- NVAccel installed version 2.6.6; NVRMAGDC 2.6.6 loaded.
- NVRM, NVAccel and NVRMFB absent from the loaded-kext listing.
- Only the AMD accelerator in the IOAccelerator listing; no NVIDIA vendor
  `10de` device in the IOPCIDevice listing captured for this review.
- Existing boot arguments include `nvfb=1 nvaccel=1 nvfbheads=4`; no `nmhybrid`.

The missing NVIDIA path is a prerequisite failure. These observations do not
identify whether firmware, ACPI, power state or driver startup is responsible.
Historical successful RTX tests must not be presented as current readiness.

### Follow-up: firmware Eco state identified

The mounted Windows volume contains a G-Helper log recording, on November 13
at 10:26, `Running eco command 1`, `GPUEco = 1 : OK` and `Eco flag : 1`.
Later entries continue to report Eco enabled and include `dGPU not found` at
12:48. These are the log's own timestamps. This is direct evidence of an Eco
transition before the current macOS session, consistent with the absent NVIDIA
PCI function. It does not prove recovery until the device returns after a mode
change.

The OCBOOT partition was mounted read-only. Its configuration passes plist
validation and still disables `SSDT-GA401QC-DGPU.aml`; its ACPI Add/Patch entries
match the previous backup. The active ACPI tree has no `GQDG` helper from that
SSDT. No EFI write was needed for this diagnosis. Read-only evidence is saved
locally in `reports/current-machine/`, including the relevant G-Helper excerpt.

The existing recovery route is booting Windows, selecting Standard in G-Helper (or the
equivalent non-Eco hybrid mode in Armoury Crate), and confirming the RTX appears
there. Keep AC power connected and avoid automatic Optimized/Eco switching during
the trial. Then return to macOS and run `./run-tool.sh tools/check-driver-state`.
If the device and all four matching drivers return, run `./verify-postboot.sh`.
Do not infer that editing G-Helper's offline JSON switches the firmware mode;
the mode must be applied through the running GPU-control software.

The driver guard now distinguishes absent PCI hardware, a loaded-version mismatch,
and visible hardware with missing drivers. The next owner reset restored NVIDIA
PCI visibility and all four matching 2.6.6 drivers. Full post-boot verification
remains blocked by AMD compute timeouts and AMD initialization during Metal
enumeration; see the second-reset findings in
[boot initialization](boot-initialization.md). This does not establish which
firmware action restored visibility. The experimental macOS-only alternative
is now tracked in [boot initialization](boot-initialization.md); it is not yet a
validated replacement for the Windows route.

## Experiment sequence

The owner confirmed on November 14 that no external monitor is currently
available. Direct NVIDIA output and PrimeBridge's external-desktop prerequisite
therefore remain unverified. Do not proceed to the compositor/EFI trial based
only on the successful per-app RTX checks.

Later checks in the current boot passed NVIDIA compute, rendered pixels, both
IOSurface usage modes and a 60-second Ganesh browser run; Code RTX pixel readback
also passed. These restore a bounded per-app baseline, while AMD fallback and
the original-Code freeze remain separate unresolved work. Use
`./verify-postboot.sh --nvidia-only` to repeat the scoped test.

See [macOS hardware initialization](boot-initialization.md) for the experimental
Darwin-only Eco recovery SSDT and the separate ALC285 warm-boot investigation.
The prepared SSDT is not installed or validated on this machine's firmware.

1. Diagnose the missing NVIDIA PCI device and loaded-driver state. Restore and
   verify the existing 2.6.6 baseline before changing the display architecture.
2. Verify the physical port routing and NVIDIA-driven external desktop. Stop
   the PrimeBridge route if the required NVIDIA HDMI output is unavailable.
3. Inspect PrimeBridge's pinned installer and patches; prepare a separate USB
   EFI with a complete original configuration and kext backup. Plan exclusive
   panel ownership with NootedRed disabled only in the trial configuration.
   Preserve a bootable AMD configuration and account for the upstream Fix PAT
   requirement. Upstream uninstall alone does not restore a separately disabled
   NootedRed entry.
4. Build and validate the trial artifacts against the exact NullMoth/macOS
   versions before installing. First trial is a compositor-to-panel copy check,
   with the original configuration available for recovery.
5. Require correct internal-panel output, evidence that WindowServer uses NVIDIA,
   original signed app/Safari rendering checks, and crash/reset comparison.
   A visible desktop alone does not prove every app uses NVIDIA.
6. Measure sustained load, tearing, refresh, video, sleep/wake, brightness and
   battery behavior separately. Both upstream routes have unresolved limits.

Removing AMD render workloads could avoid the AMD rendering path implicated in
earlier resets. It cannot yet be called a fix, and does not address the separately
observed IPv6/CDN sign-in timeout.
