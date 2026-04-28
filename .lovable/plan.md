## Goal

Add a single command that wipes Vite/TanStack caches, performs a clean dependency install, then starts the dev server and waits until it responds with HTTP 200 — so we can confirm in one step that the preview is healthy.

## Changes

### 1. New script: `scripts/fresh-dev.sh`

A bash script that does, in order:

1. Stop on any error (`set -e`).
2. Remove cache directories:
   - `node_modules/.vite`
   - `node_modules/.cache`
   - `.tanstack`
   - `dist`
3. Remove `node_modules` and `bun.lockb` for a fully clean install.
4. Run `bun install`.
5. Start `bun run dev` in the background, capture its PID.
6. Poll `http://localhost:5173` (Vite's default) up to ~30s. On first 200, print "Dev server healthy ✅" and leave it running. On timeout, print logs and exit 1.

### 2. `package.json` — add npm script

Add one entry under `scripts`:

```json
"fresh": "bash scripts/fresh-dev.sh"
```

So the user runs:

```bash
bun run fresh
```

## Technical notes

- The script uses `bun` (already the project's package manager per `bunfig.toml`).
- Health check uses `curl -sf` in a `for i in $(seq 1 30); do … sleep 1; done` loop — no blind sleeps.
- Cache paths chosen specifically target the symptoms seen earlier (TanStack virtual modules `#tanstack-router-entry`, `tanstack-start-manifest:v` getting stuck in Vite's optimizer cache).
- Lockfile is removed because `saveTextLockfile = false` in `bunfig.toml` means `bun.lockb` is binary and has been a recurring source of phantom diffs in this project.
- No source code is modified — this is purely a tooling/devops addition, so it cannot break the app.

## Out of scope

- Not changing `vite.config.ts`, dependencies, or any route/source files.
- Not addressing the security findings shown in the security panel — those are separate from the dev-server health issue and would each warrant their own focused change.