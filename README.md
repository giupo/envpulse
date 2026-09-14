# EnvPulse

A self-hosted secrets manager, built from scratch (not a wrapper around Doppler or any
third-party service). Projects → environments → secrets, versioned and rollback-able,
encrypted at rest, accessed through an API-first backend with a CLI as the first client.

```
packages/
  core/     @envpulse/core   -- domain logic, DB (SQLite via Drizzle), crypto
  server/   @envpulse/server -- Fastify HTTP API
  cli/      @envpulse/cli    -- `envpulse` command-line client
```

A web UI is an explicit future phase, not built yet -- the CLI talks to the server over
the same HTTP API a browser-based UI would use, so adding one later needs no backend
changes.

## Quickstart

Requires Node.js 22+ and [pnpm](https://pnpm.io).

```sh
pnpm install
pnpm build
```

### 1. Configure and start the server

```sh
cd packages/server
cp .env.example .env
```

Generate a master encryption key and put it in `.env` as `ENVPULSE_MASTER_KEY`:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**This key encrypts every secret at rest. Losing it makes all stored secrets permanently
unrecoverable.** Back it up somewhere separate from the database file.

Start the server (from the repo root, or `pnpm dev` inside `packages/server`):

```sh
pnpm dev
```

On first run it prints a root token once -- save it, it is never shown again:

```
================================================================
 EnvPulse first-run: root token generated.
 Save this now -- it will not be shown again:

 envp_root_...

 Run: envpulse login --host http://localhost:8787 --token envp_root_...
================================================================
```

### 2. Use the CLI

From `packages/cli`, either run against source with `pnpm dev -- <args>`, or build once
and use the compiled binary directly (`node dist/index.js <args>`, or link it as
`envpulse` via `npm link` / adding `packages/cli/bin` to your `PATH`).

```sh
envpulse login --host http://localhost:8787 --token envp_root_...

envpulse projects create demo
envpulse env create dev --project demo

envpulse secrets set DATABASE_URL postgres://localhost/demo --project demo --env dev
envpulse secrets get DATABASE_URL --project demo --env dev

# Inject secrets into a process without ever writing them to disk:
envpulse run --project demo --env dev -- node server.js

# Or materialize them into a .env file:
envpulse pull --project demo --env dev -o .env

# Bulk-import from a .env-style file:
envpulse push .env --project demo --env dev
```

`--project`/`-p` and `--env`/`-e` can be omitted once set as defaults via `envpulse login`'s
config file (`~/.envpulse/config.json`).

### 3. Scoped tokens for CI/services

The root token can do anything. For CI or a running service, mint a token scoped to just
one project or one environment:

```sh
envpulse tokens create --name ci-deploy --scope environment --project demo --env dev
```

The raw token is shown once at creation time and cannot be retrieved again.

## Commands

| Command | Purpose |
|---|---|
| `login` / `whoami` | Authenticate and inspect the current token |
| `projects create\|list\|delete` | Manage projects |
| `env create\|list\|delete` | Manage environments within a project |
| `secrets set\|get\|list\|delete\|history\|rollback` | Manage secrets and their version history |
| `run -- <command>` | Inject secrets as env vars into a spawned process |
| `pull` / `push` | Sync secrets with a `.env`-style file |
| `tokens create\|list\|revoke` | Manage scoped API tokens (root only) |
| `audit` | View recent audit log entries (root only) |

Add `--json` to any `list`/`history`/`audit` command for machine-readable output.

## Development

```sh
pnpm build   # build all packages
pnpm test    # run all test suites (unit + integration)
pnpm dev     # start the server against packages/server/.env
```

`packages/core/src/db/schema.ts` is the source of truth for the data model; after
changing it, regenerate the migration with `pnpm --filter @envpulse/core exec drizzle-kit generate`.
