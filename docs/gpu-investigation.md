# GPU investigation ledger

Updated November 4, 2026. Evidence is local under `reports/rea/evidence.json`.
Raw reports, minidumps, app profiles and symbol downloads are excluded from Git.

## November 14: freezes after NVIDIA returned

The owner reports the whole original VS Code window lagging/freezing after
NVIDIA was enabled. `reports/postboot/code-live-status.txt` from the new 02:27
boot explicitly reports AMD `1002:1638` as `*ACTIVE*`, NVIDIA `10de:25a2` as the
second device, and `skia_graphite: enabled_on`. Enabling NVIDIA hardware did not
switch this original Code instance to the Momota RTX path.

The previous boot's AMD GPU reset reports at 02:23:21, 02:23:32 and 02:23:43 name
the original Code Helper and contain Dawn shader names. These precede the native
baseline probe at approximately 02:23:40. Later resets also contain that probe's
compute workload; avoid further GPU stress while the session is affected.
The WindowServer IPS at 02:24:51 has bug type 409; its presence alone does not
establish a fatal crash. The later 02:24:41 and 02:25:56 reset reports leave
application/path blank. The health parser now preserves these as null rather
than accidentally reading the following field across a newline.

REA evidence `ev_976536467445d0b30ecb2d66b05e0955487a4bbbe811f3572a89cfd30d5ba860`
records a two-second sample of the current original-Code GPU process, PID 497.
The owned sample command exited successfully; REA process-tree sampling was
partial. Its output is `reports/postboot/code-gpu-live-sample.txt`. Subsequent
five-second samples include actual AMD Metal render-encoder and IOSurface calls
in `code-gpu-freeze-sample.txt`. They establish AMD execution, not the exact
instruction responsible for the reported freeze. No new reset reports were
observed between the new boot's health snapshots during collection.

An isolated run of the signed original Code with `--disable-gpu` and extensions
disabled reported software GPU compositing/rasterization and disabled Graphite,
captured a frame and answered ten renderer heartbeats in 1–193 ms. The diagnostic
instance exited; no new crash/reset reports or recovery-statistic increases were
observed in this short window. Evidence is
`reports/code-software/1794598367632/result.json`. This is a bounded fallback
check with a fresh profile, not validation of the owner's extensions or workload.
`Launch-Code-Software.command` makes that fallback available with the existing
profile after quitting original Code. It does not change EFI or GPU power mode.

The exact reason NVIDIA presence correlates with the owner's recurrence is
unresolved: a controlled GPU-enabled/disabled comparison with matching boot,
profile and workload has not been performed. The current evidence supports an
AMD/Graphite rendering failure candidate; it does not prove a specific
NootedRed bug or exclude cross-driver effects. Microsoft CDN timeouts also
persist, but they do not explain the confirmed AMD GPU resets.

## Questions and findings

The later November 14 NVIDIA-only post-boot suite passed native/IOSurface checks
and 6631 browser iterations/222 resizes with a captured frame and no new health
signals. An intervening hidden-window capture failure remains retained under
`reports/continue-hidden-capture/`; it was not counted as a passing suite.
Code RTX separately passed NVIDIA pixel readback, including an immediate-start
check after adding a bounded workbench-readiness wait to the inspector. These
results establish the scoped RTX path, not a repair of original-Code AMD resets.

| Question | Status | Evidence and limits |
| --- | --- | --- |
| Does original VS Code execute the AMD Metal driver? | Observed | The two-second sample includes `GFX9_MtlCmdBuffer` and AMD render-encoder calls. Sampling does not observe every command or identify the exact failing instruction. |
| Did the NVIDIA update fix original Code resets? | No | A new macOS GPU Reset report at 02:25 names AMD Renoir and the original `/Applications/Visual Studio Code.app` helper path. This is separate from the isolated RTX tests. |
| Are compositor diagnostic dumps included in health checks? | Fixed | Three 02:11–02:12 original-Code dumps report `VizCompositorThread`. The old name filter excluded them. TypeScript decoding now admits that exact thread and tests its metadata. A diagnostic dump alone is not a fatal crash. |
| Does historical media analysis crash in the NVIDIA path? | Recorded | The pre-reboot IPS report names `_platform_memmove` and `nvk_UpdateDescriptorSets`. This is historical evidence, not a 2.6.6 reproduction. |
| Does `recoveryCount` count all resets cumulatively on this driver? | Unresolved | Samples in the same boot fall from 14 to 1 and 0. Preserve this statistic as an advisory signal; use actual reset reports for confirmed events. The verification gate conservatively requests review after an increase. |
| Does the C/TypeScript RTX path work? | Bounded validation | All nine native cases pass. The TypeScript browser completed 7351 frames/246 resizes in 60 seconds without pixel errors or context loss. Code RTX passes NVIDIA readback. These checks do not establish system-wide routing or long-term stability. |
| Can `argv.json` persist the renderer flags? | Unsupported in inspected startup code | The shipped `out/mainImpl.js` function `H3` whitelists a small set of persistent options; `disable-features` and `use-angle` are absent. Its CLI handling preserves existing Chromium feature switches. Launchers remain the supported route. This is static analysis, not a new original-Code launch test. |
| Can upstream Electron symbols identify the fault precisely? | Rejected mismatch | Installed framework UUID is `4C4C445B-5555-3144-A131-99E29084BBD5`; upstream 43.8.3 symbols identify `4C4C443D-5555-3144-A1E2-15C48C1A1FD4`. Different build identities prohibit assigning their function names to this dump. |
| Is global NVIDIA rendering with AMD display complete? | No | WindowServer/Safari routing and the kernel/framebuffer integration remain unimplemented. Per-app selection does not satisfy that system-wide requirement. |

## REA evidence index

- `ev_0de38b6a54335dc5b576af2f168709fcec9d70ccee4ae6d5c2a0df31f927303d`:
  installed Electron fuse inspection. Inspector and RunAsNode fuse bytes are
  enabled; this does not prove Inspector is currently active.
- `ev_977925277c17e101b7814fe310838f6d1aea1b445f6cf1d6ca468da86022d030`:
  complete historical mediaanalysisd IPS decoding, eight threads/39 frames.
  Recorded symbols are not independently symbolicated by REA.
- `ev_06e6e29def544da1de3f1e575f105f504021a9ae8266717b902ef2e504eadcd7`:
  owned `sample` command against the selected original-Code GPU process. Command
  exited zero. Process-tree sampling was incomplete; target sample text is kept
  locally in `original-code-gpu-sample.txt`.
- `ev_a6938911f7dc65ba268413fcadb3f7a97213be88a65e5269a506afec1036a25f`:
  LLDB decoded a selected original-Code Crashpad dump, exit zero, owned process
  cleanup verified. Its synthetic exception code is `0x43507378`. Framework
  symbols remain unnamed; module mapping warnings and process-sampling limits
  remain explicit. An earlier noisy attempt timed out and yielded no stack.
- `ev_37b816b80a6749f6d1fc50a105afb7fa68c5eadaea2401c00511bc404d4fbf09`:
  passive CDP observation of the compiled GPU test page, one-second window. This
  observed DOM/resources; it did not evaluate JavaScript or perform GPU tests.
  NVIDIA/pixel claims come from the separate native and browser reports.
- `ev_e63b2f1886414de8583c67192e28693a889276b75d5b62a10f3b7fc625dff792`:
  shipped VS Code application inventory with `out/main.js` selected for static
  analysis. Semantic retention was partial at the configured node ceiling;
  unselected sources remain unknown. Startup whitelist details above were read
  separately from the shipped `out/mainImpl.js`, not inferred from this graph.

## Repairs made from observations

- TypeScript replaces authored JavaScript/Python/Ruby helpers; IOKit collection
  uses C and emits exact registry IDs as strings, avoiding duplicate `ioreg` rows.
- Minidump parsing bounds every stream and 64-bit name RVA before reading.
- GPU/renderer process termination cannot be hidden by a recovered pixel check.
- Immediate frame capture can race the first published display surface. It now
  retries within a bounded deadline, keeps pixel evidence on failure, and removes
  stale screenshots. Capture failure remains a verification failure.
- The inspector has bounded requests and refuses workbenches outside Code RTX.

The final post-boot suite passed after these changes: native/IOSurface checks,
7478 browser iterations and 250 resizes in 60 seconds, captured frame, no process
failures, and no new reports or counter increases during its own comparison
window. This does not erase the earlier original-Code reset at 02:25.

## Remaining work

The lower-left Sign in retry also exposes a separate verified network defect:
Microsoft CDN/update TLS connections time out over IPv6 but work over IPv4.
Process-scoped mappings removed those timeouts in an isolated run of the signed
original VS Code. See [the authentication investigation](github-authentication.md).
Opening Accounts stayed responsive in that isolated profile; the actual user's
full Sign in action still needs a matching renderer trace before claiming a fix.

The upstream [NootedRed blend-shader issue #158](https://github.com/ChefKissInc/NootedRed/issues/158)
remains open. A separate [Sequoia VS Code/Edge freeze report #363](https://github.com/ChefKissInc/NootedRed/issues/363)
was closed as its duplicate. This is a relevant candidate for the AMD resets,
not a demonstrated match to this machine's exact failing instruction. Upstream
also distinguishes ANGLE/WebGL selection from Chromium's own drawing path;
forcing ANGLE Metal must not be described as a complete compositor fix.

Original-Code AMD reset root cause, verified GitHub login stability, heavy
workloads, and global routing remain unresolved. Migrating the diagnostic source
language does not repair the AMD or NVIDIA driver by itself. No global injection,
EFI changes, system app patching, or automatic reboot was performed in this pass.
