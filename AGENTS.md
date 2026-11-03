# Project conventions

- Communicate with the project owner in Vietnamese; keep software artifacts in English.
- Write all project documentation, code comments, UI text, and commit messages in English.
- Keep the README short and easy to follow, with clear credit to NullMoth.
- Prefer C for core policy and logic, with a thin Objective-C adapter for macOS/Metal APIs.
- The objective is NVIDIA-primary rendering with AMD display output. Describe the current verified app-scoped implementation separately; do not claim system-wide support before demonstrating it.
- Keep generated app copies, profiles, extensions, logs, reports, and EFI backups out of Git.
- Distinguish verified GPU execution and pixel checks from untested performance or stability claims.
