# Prism Playground

A server-backed browser arcade with sixteen complete games. Source is public in this repository by the owner’s explicit approval; hosted gameplay supports public guest access, with separate progress for each browser. No external artwork, analytics, advertising, public leaderboards, or gameplay purchases.

## Run locally

Requires Node.js 24 or newer. Runtime has no third-party dependencies.

```
node server/index.mjs --local
```

Open `http://127.0.0.1:4317`. This explicitly local mode binds only to loopback and uses a local-owner development identity. It saves authoritative progress in `data/prism.sqlite`, a server-side SQLite database. It is not cross-device production authentication. Never use local mode on an internet listener.

## Production Node hosting

Hostinger uses Node.js 24 and entry file `server/hostinger.mjs`. Set `PUBLIC_ACCESS=true`, `APP_ORIGIN` to the HTTPS site URL, and `DB_PATH` to the server database path. Public mode issues an unguessable, secure HttpOnly guest session and keeps each visitor's progress separate. Guest mode does not provide cross-device sign-in. The current Hostinger database uses temporary storage; progress can reset on hosting restarts or redeployments.

Without `PUBLIC_ACCESS=true`, production remains private and requires `OIDC_ISSUER`, `OIDC_CLIENT_ID`, and `OIDC_ALLOWED_SUBJECTS`. Existing private identities are not accessible through public guest sessions.

Browser modules load through `/assets/` so the Node server supplies their JavaScript content type even when the hosting proxy serves `.mjs` files as plain text.

## Optional private ChatGPT Sites adapter

`cloud/worker.mjs` uses the Sites dispatcher's authenticated user ID and platform-managed D1. It does not need database credentials. It must run only behind the private Sites dispatcher, which strips and supplies trusted identity headers. Never deploy it as a public standalone Worker that accepts spoofable identity headers.

The Node and Worker routes share all pure rules, generators, solvers, and reward formulas. The Worker uses D1 atomic batches, optimistic run revisions, unique action IDs/revisions, unique run reward transactions, atomic daily-start eligibility, and schema triggers for wallet/challenge/achievement atomicity. A local SQLite adapter tests this behavior; real D1 deployment and platform identity are not yet verified.

Install development tools using the checked-in `pnpm-lock.yaml`. `node scripts/build.mjs` produces `dist/server/index.js` (ESM default `fetch`) and `dist/client/`. The schema is in `db/schema.ts`; generated migrations are in `drizzle/`, including a schema-only custom trigger migration. Treat applied migrations and their metadata as immutable. The raw `cloud/schema.sql` is the equivalent test schema, not runtime initialization. No schema DDL runs in the Worker.

A Sites owner must register one new private project only after hosting approval, add its actual project ID and logical `DB` binding to `.openai/hosting.json`, use the current Sites packaging/build helper, and confirm owner-only access and deployment success. No project ID is fabricated in this checkout.

## Architecture

- `public/games/`: one isolated pure rules module per game; no DOM or database dependencies.
- `public/core.mjs`: deterministic seeded RNG, geometry, assertions, finite-state BFS.
- `public/games/puzzle.mjs`: common undo and efficiency scoring.
- `public/views*.mjs`: game-specific SVG/HTML rendering, pointer/touch/keyboard bindings.
- `public/touch-input.mjs`: immediate deliberate button taps after drawing, with duplicate touch-click suppression.
- `public/app.mjs`: shell, tutorials, navigation, pause, recovery drafts, history, challenges, cosmetics.
- `server/index.mjs`: authenticated run creation/actions/export, server clock, optimistic revisions, SQLite transactions.
- `server/store.mjs`: Node persistence, achievements and reward transactions.
- `server/auth.mjs`: Node OIDC PKCE and secure sessions; fail-closed production gate.
- `server/economy.mjs`: published catalog and server reward formula.
- `cloud/worker.mjs`: optional Sites/D1 deployment adapter.

The browser never submits XP, rewards, completion state, score, or run timestamps as authority. It submits actions. The server reconstructs a seeded board, validates each action and timing, and stores the resulting state and trace. Run UUID, rules version, difficulty, mode, seed, start/end time, elapsed duration, status, assisted/practice labels, metrics, and reward breakdown are persisted. Finished-run exports contain the input trace and seed. Cipher, Orbit, and Recall withhold generation seeds during active play. Daily seeds are randomly generated and stored by the server, not derived from a public calendar date. Recall viewing deadlines are enforced on both reads and actions. Displayed memory sequences can still be recorded by a player; this is a private arcade, not a tamper-proof competitive platform.

Browser storage contains only preferences, the current run ID, and a pending recovery action. On a failed or lost save response, the same action UUID is retried. Success is shown after server confirmation. Starting or restarting a run abandons the prior active run without a reward. Refresh pauses a recovered active run. Hints do not mutate puzzle boards; assistance persists through restarts. Completed runs can only be replayed as reduced-reward practice. Hidden-answer restarts and repeat daily attempts are assisted. Invalid repeated pause/resume transitions are rejected; elapsed time cannot be reset with another resume. Undo counts as a move, so it cannot erase efficiency costs.

## Rewards

Qualifying completion: `round((20 + 80 × performance) × multiplier)` XP and `max(1, round((3 + 7 × performance) × multiplier))` crystals. Performance is capped to [0,1]. Multiplier is 1 for unassisted standard runs and 0.25 for practice, seed replays, or assisted runs. Failed/abandoned runs award zero. Puzzle performance is verified target moves / total moves (capped at 1); each action game publishes its ratio through its rule module.

Daily seed and difficulty reset at 00:00 UTC. The first unassisted daily completion adds 25 XP and 5 crystals. Two different games in a day and one unassisted puzzle each add 15 XP and 3 crystals once. Achievements award once. There are no punitive streaks. Cosmetics are readable palettes, a dotted trail, a glass finish, and an emblem; all games remain unlocked.

## Verification

```
node --test tests/*.test.mjs
node tests/browser.mjs
node tests/browser-edges.mjs
node tests/browser-timing.mjs
node tests/browser-flows.mjs
```

Browser tests use an isolated Chromium profile and loopback-only test server. Install browser QA dependencies with `npm install --no-save playwright@1.62.1` and `npx playwright install chromium`. Run `node tests/browser.mjs` with port 4317 free; set `PLAYWRIGHT_MODULE` to its package location and `CHROMIUM_PATH` to the browser executable when running outside this workspace. Test databases and runtime downloads are ignored by Git and excluded from deliverable archives. See `TEST-REPORT.md` and `artifacts/` for exact passed/unverified coverage.

## Source release

This upload is based on tested source commit `f8f5358fada5ed378355c281cebcd83447a8c0e7`. Runtime and game rules are unchanged. Browser harness imports and executable selection were made portable, and local delivery metadata, screenshots, diagnostic scripts, and generated `dist/` output were excluded. Text test reports describe the completed local QA; production deployment remains unverified. See `UPLOAD-MANIFEST.json` for exact byte hashes.
