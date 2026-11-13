# macOS hardware initialization after Windows

Investigated November 14, 2026 on the GA401QC. Goal: macOS establishes its required
GPU and audio state on entry, independently of the previous Windows session.
This is separate from the NVIDIA compositor experiment.

## Boot design

Firmware/EC and codec state can survive a warm reboot. OpenCore configuration
alone does not constitute a complete hardware reset. Initialization belongs in
the component that owns each device: early ACPI for the ASUS GPU power request,
and the audio driver for codec routing/processing. Windows should continue to
initialize its own devices when selected; a macOS initialization pass is not
required before Windows boots.

The prototype checks `_OSI("Darwin")` and does nothing on the simulated Windows
path. The existing `_OSI` to `XOSI` rename must remain understood when reviewing
the final ACPI namespace. This SSDT introduces no additional rename, replaces
no firmware method, and has no shutdown or sleep hooks. The Darwin check controls
when the request is made; firmware state changed by that request may still
persist into the next OS. Windows must continue to apply its own policy.

## GPU: firmware-level Eco recovery

The local G-Helper log proves an Eco transition before NVIDIA disappeared.
[G-Helper's implementation](https://github.com/seerge/g-helper/blob/main/app/AsusACPI.cs)
uses device `0x00090020`: `DSTS` reads the state, `DEVS(..., 0)` requests Standard.
[Linux's ASUS WMI driver](https://github.com/torvalds/linux/blob/master/drivers/platform/x86/asus-wmi.c)
uses the same control and notes that PCI rescan and another request can be needed.
[AsusSMC](https://github.com/hieplpvip/AsusSMC/blob/master/AsusSMC/AsusSMC.cpp)
demonstrates WMI evaluation through `IOACPIPlatformDevice` on macOS. This does not
establish a stock user-space interface for running arbitrary ACPI methods.

The [public GA401 2021 reference DSDT](https://github.com/PIut02/ROG-Zephyrus-G14-GA401-Hackintosh/blob/46bfce7e7e8b3487d45504f6309554a0de2c570e/2021/DSDT.aml)
contains `\_SB.ATKD.WMNB` with three arguments. It unconditionally creates DWORD
fields through offset 0x10, so the prototype supplies 20 initialized bytes rather
than the short eight-byte payload used by some other callers. Its Standard branch
calls `FGON`, sets a transition flag, sends a bus-check notification and waits for
the PCI function before clearing the Eco flag. The firmware wait can take about
20 seconds; the prototype cannot impose a timeout inside that firmware call.

The public reference is not a dump of the installed BIOS. Current IORegistry confirms
ATKD and the PEGP namespace, but does not establish the installed WMNB method's
signature or body. The current ACPI expert does not expose the `ACPI Tables`
property used by MaciASL. Do not substitute the reference DSDT for the real one.

### Post-reset investigation

After the owner's November 14 hard reset, NVIDIA remained absent from PCI and
NVRM, NVAccel and NVRMFB remained unloaded. AMD's recovery counter was zero in
`reports/health/post-hard-reset.json`. This reset did not restore GPU visibility.
The ACPI PEGP namespace still exists; that alone does not establish PCI presence.

A local November 1 EFI archive on the Windows data volume contains original
DSDT/SSDT binaries and hardware reports identifying GA401QC BIOS 415. Copies and
SHA-256 identities are retained in `reports/asus-dgpu/local-acpi/manifest.json`.
All 14 archived tables have matching declared lengths and valid checksums.
Fresh iASL disassembly confirms the three-argument WMNB method, its five DWORD
payload fields, the Eco status responses and the Standard branch's FGON,
notification and WAT2 sequence used by the prototype. iASL reported a conflicting
`\\_GPE` declaration during external resolution; the output is static evidence,
not successful execution of this firmware. These archived tables reduce reliance
on the public reference but are not yet proven identical to the current boot.

No MRTG device is present in the current ACPI tree, so neither prototype ran on
this boot. Mounting OCBOOT read-only failed and noninteractive sudo requires a
password; the active EFI was not inspected again or modified in this pass.
The immediate recovery trial remains an applied Standard mode in Windows, then
PCI and driver verification in macOS. A macOS-only boot trial still needs a
verified test EFI and audit readback before enabling the write variant.

### Second reset: PCI visibility recovered, execution still blocked

After the owner's next reset on November 14, NVIDIA appeared again in the PCI
listing and NVRM, NVAccel, NVRMFB and NVRMAGDC all loaded at version 2.6.6. No
MRTG device was present, so this is not evidence that either prototype ran or
that its Standard request restored the GPU. The exact reset procedure and any
intervening Windows mode change have not been established.

The post-boot verification stopped at the unmodified AMD baseline: its compute
command exceeded the ten-second wait. Two new AMD GPU restart reports at 02:23:43
and 02:23:54 identify the original VS Code helper. A separate NVIDIA-forced probe
blocked during Metal device enumeration; a live sample shows
`MTLCopyAllDevices` opening `AMDRadeonX5000MTLDriver` through `IOServiceOpen`,
before the shim selected an NVIDIA device. This does not establish a failure of
NVIDIA command execution. The browser and IOSurface stages were not reached.
Evidence is under `reports/postboot/`, including `failed-after.json` and
`nvidia-probe-sample.txt`. Older successful native/browser files are historical.

The second-reset audio snapshot captured all 142 coefficients and restored index
zero. Speaker pins were inactive and the DAC stream channels were zero, unlike
the earlier muffled speaker snapshot. Coefficients 0x30, 0x77 and 0x78 differ,
but playback state and sound quality are not matched; this is not a verified
`cold-good` comparison. See `reports/audio/post-second-reset-comparison.json`.

### Built artifacts

- Source: `acpi/SSDT-Momota-DGPU.dsl`.
- `build/acpi/SSDT-Momota-DGPU-Audit.aml`: reads the Eco response only.
- `build/acpi/SSDT-Momota-DGPU-Enable.aml`: requests Standard only for the exact
  supported-and-Eco response `0x00010001`, then retains the actual readback.
- Both expose before/after/result/step fields as properties on `MRTG`; neither
  claims PCI presence or rendering success from a successful firmware return.
- Only one variant belongs in a test EFI at a time. Neither is installed.

Build with `bash build-acpi.sh`, setting `IASL` if needed. The local compiler was
extracted from the official MaciASL 1.6.5 release and is ACPICA iASL 20200925.
Generated AML and downloaded tools remain under ignored build/reports folders.

The actual AML passed ten synthetic interpreter scenarios: audit mode, Eco
recovery, already Standard, unsupported, absent, unknown status, Windows,
missing WMI provider, firmware refusal and false success. Every scenario invokes
initialization twice and checks call counts, payload and readback. These tests
execute synthetic firmware only. They do not test Apple's initialization order,
the embedded controller or PCI discovery on this laptop.

Run with `./run-tool.sh tests/asus-wmi.test`; `ACPIEXEC` can override the local
interpreter. The locally built interpreter uses ACPICA commit
`e85aa3bebaae81ed1e6d163511ac7e1eafe732cf` (20260930). Its debugger reports cache
allocation cleanup diagnostics in these runs; retain the complete logs under
`reports/asus-dgpu/tests/`. The assertions verify method behavior, not a leak-free
interpreter build. Both SSDTs compile with zero errors and warnings.

Before installing the enable variant: obtain this machine's ACPI table dump
through an OpenCore diagnostic boot, compare WMNB and its power dependencies,
and prepare a separate test EFI plus the unchanged original. Start with the audit
variant. Confirm its response, then trial the enable variant and verify actual
NVIDIA PCI presence plus all four loaded drivers. If the OS still cannot discover
the device, investigate earlier initialization or a subsequent macOS boot; do not
add repeated power toggles or direct GPIO writes speculatively.

## Audio: muffled sound is the observed symptom

The owner confirms the current speakers sound muffled. A hardware power reset
has previously restored their quality. There is no measured frequency-response
or verified codec reset yet.

Current observations:

- AMD HDA controller `1022:15e3`, subsystem `1043:1f11`.
- Realtek ALC285 `10ec:0285`, codec address 0.
- AppleALC 1.9.8; `alc-layout-id` is 33. The internal AppleHDA layout is 7, which
  is distinct from AppleALC's selected layout and does not itself show a mismatch.
- The selected resource names the PIut02 Zephyrus G14 layout.
- Internal Speakers is the default output at 48 kHz; this does not prove all
  physical speakers or amplifier paths are working.
- The codec reports 142 processing coefficients. A snapshot labeled
  `muffled-user-confirmed` is under `reports/audio/`, with pin state and coefficients.
  The original coefficient index is restored and checked after collection.

[Issue #46 in the GA401 EFI project](https://github.com/PIut02/ROG-Zephyrus-G14-GA401-Hackintosh/issues/46)
reports ALC285 quality below Windows/Linux. The author supplied a custom layout-33
build and discussed all four speakers and Windows Dolby processing. This is
related evidence, not proof of the same warm-reboot defect or a universal fix.
The repository README also lists headphone audio failing after a Windows reboot
and recovering after forced shutdown, a different symptom from muffled speakers.

[AppleALC's processing-coefficient guide](https://github.com/acidanthera/AppleALC/wiki/Dumping-processing-coefficients)
specifically recommends comparing working cold-boot and affected warm-boot codec
state. [Linux's Realtek driver](https://github.com/torvalds/linux/blob/master/sound/hda/codecs/realtek/alc269.c)
matches this exact subsystem to its GA401 fixup, pairing speaker nodes 0x14 and
0x17 with DAC 0x02 and headphone node 0x21 with DAC 0x03. It notes that DAC 0x06
lacks bass-speaker volume control. This is a routing lead, not a measured fault
in the current AppleALC resource.

The current codec connection lists and selectors show 0x14 using DAC 0x02 and
0x17 using DAC 0x03. The upstream AppleALC `Platforms33.xml` explicitly specifies
those two different DACs. That differs from Linux's shared-DAC preference and is
another candidate to compare, not evidence of a stale Windows selector by itself.
The enhanced snapshot also records DAC amp gains, stream channels and formats.

The frequently suggested `alctcsel=1` is guarded by an Intel-controller check in
[AppleALC's code](https://github.com/acidanthera/AppleALC/blob/master/AppleALC/kern_alc.cpp).
Do not treat it as an AMD fix. Likewise, the neighboring Linux hardcoded coefficient
0x1b fix targets a different quirk chain; do not copy it onto this codec just
because it mentions rebooting from Windows.

### Comparison and eventual startup fix

Run `./run-tool.sh tools/audio-snapshot <label>` after each controlled boot.
`ALC_VERB` selects an upstream alc-verb executable; the current local copy comes
from the official AppleALC 1.9.8 release. The collector refuses other codecs,
queries pins and processing capabilities, selects each coefficient for reading,
then restores its original index in `finally`. It never sends processing-value,
amp, EAPD, pin-control or reset writes. Index selection is a hardware latch write,
so this is diagnostic access rather than a claim of completely passive sampling.
No other codec utility should run concurrently; driver access can also race reads.

The next required observation is a `cold-good` snapshot immediately after the
owner confirms the improved sound following their known recovery procedure.
Compare it with `muffled-user-confirmed`, plus pin/amp/routing state if coefficient
values are unchanged. Reproduce across Windows-to-macOS and macOS-to-macOS boots,
keeping volume, source material and sample rate fixed. A difference is a candidate,
not permission to replay every codec register. Only demonstrated necessary values
should become an AppleALC initialization/wake fix, scoped to this codec/subsystem.

No codec value fix, EC reset, GPU/audio EFI change, Windows configuration edit or automatic
reboot was performed. Reliable automatic initialization remains unverified until
the boot trials and the good/bad audio comparison are complete.

## Normal loading screen

At the owner's request on November 14, the OCBOOT configuration was changed to
hide routine boot text. Both its boot arguments and live NVRAM contained `-v`.
Only that exact token was removed. `Misc/Debug/Target` changed from 67 (`0x43`)
to 65 (`0x41`), disabling OpenCore's onscreen logging while retaining file logs.
These meanings follow the [OpenCore reference manual](https://github.com/acidanthera/OpenCorePkg/blob/master/Docs/Configuration.tex).
All other boot arguments, GPU/audio settings, ACPI entries and the boot picker
were preserved. This presentation change does not automate hardware recovery.

The entire EFI directory was backed up under
`reports/boot-ui/20261114-024702/EFI-before/`. The prepared plist passed syntax
validation, and a normalized before/after diff showed only those two changes.
The live configuration and NVRAM were read back after the administrator write;
the configuration SHA-256 is
`24ae0097f72eab98e3f43fa54635d300892fbf6ca2ae697e2c916a43fa6248a9`.
The EFI was unmounted afterward. No NVRAM reset or automatic reboot was performed.

Use `reports/boot-ui/20261114-024702/Restore-Verbose.command` to restore the
previous config and arguments with administrator access. It checks the expected
volume identity and config hashes before writing and refuses intervening changes.
The new loading presentation still requires visual confirmation on the next
normal boot. The running kernel was started in verbose mode, so changing NVRAM
does not guarantee quiet shutdown text in this already-running session.
