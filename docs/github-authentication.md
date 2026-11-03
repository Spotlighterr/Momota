# GitHub authentication

Git credentials and Copilot's VS Code session are separate. Signing GitHub CLI
in does not, by itself, sign the Copilot extension in.

## Copilot

The installed GitHub Authentication extension supports:

```json
"github-authentication.preferDeviceCodeFlow": true
```

Momota includes this preference in its Code RTX settings template. It prioritizes
the device-code flow over local-server and URL-handler flows. Start Copilot sign-in,
follow the URL and enter the newly displayed code on GitHub. Do not paste a token
into project settings or chat. Each authorization attempt has its own code.

This changes authentication routing, not GPU rendering. Original VS Code still
uses AMD; a recovered GPU process is not evidence that the driver issue is fixed.

## Git and repository pushes

With GitHub CLI installed:

```sh
gh auth login --hostname github.com --git-protocol https --web
gh auth status
```

Choose Git authentication when prompted and complete the browser authorization.
On this machine, the user-local executable is `~/.local/bin/gh`.
Use the operating-system credential store; do not put credentials in the remote
URL, repository, or diagnostic reports.

Reference: [GitHub CLI authentication manual](https://cli.github.com/manual/gh_auth_login).

## Lower-left Accounts / Sign in investigation

The user distinguished the lower-left Sign in control from device-code login:
device-code login appeared to work, while the lower-left UI remained problematic.
The latest ordinary logs contained Microsoft CDN/update fetch timeouts, with no
new GPU-reset report for that retry. Do not attribute this retry exclusively to
GPU failure or authentication without a matching trace.

Connection probes reproduced TLS timeouts to `main.vscode-cdn.net` and
`update.code.visualstudio.com` over IPv6 and automatic selection. IPv4 completed
TLS in about 0.2 seconds. Apple and Cloudflare IPv6 requests succeeded, so disabling
IPv6 globally is not justified by this evidence.

`Launch-Code-Network-Test.command` launches the original signed VS Code with its
normal profile and temporary, process-scoped IPv4 resolver rules for those two
hosts. Addresses are resolved afresh on each launch; the rules do not track CDN
address changes during a running session. This is a diagnostic workaround, not
a permanent DNS or driver repair. TLS verification stays enabled. Save files
and close the original VS Code first so the flags can take effect.

The launcher also opens a loopback-only diagnostic endpoint on port 9344. Quit
that instance after diagnosis to close the endpoint. It does not modify the
application, system DNS, Wi-Fi configuration, or rendering flags.

After opening the diagnostic instance, run:

```sh
./run-tool.sh tools/inspect-code-network --watch
```

This measures the same public JSON resources named in the failed requests and
records 20 seconds of renderer responsiveness and CPU profiling. Reproduce the
lower-left action during that window. Reports stay under `reports/code-network-test`;
network probes include no credentials and discard response bodies.

The isolated validation used a fresh profile on the original signed executable:
`core/stable.json`, `extensions/marketplace.json`, and `extensions/chat.json`
returned HTTP 200 in 63–173 ms; the update host returned HTTP 200 in 471 ms.
Opening the Accounts control left renderer responses at 1–3 ms during the next
20 seconds. The complete user-profile Sign in sequence has not been verified.
Automatic UI actions and automatic close are restricted to the owned isolated
test process; the user's real profile is observed without automatic actions.
