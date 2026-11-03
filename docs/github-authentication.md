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
