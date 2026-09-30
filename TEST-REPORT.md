# Prism Playground verification

Date: 2026-09-30. Environment: Windows, Node 24.19.0, isolated Chromium 1234, Playwright 1.62.1. All test databases and browser profiles are separate from user data. No authenticated personal browser session was accessed.

## Automated rules and persistence — PASSED

`node --test tests/*.test.mjs`: 28 tests passed, zero failed.

- 360 configurations per game across calm, normal, and expert: 5,760 generated configurations in total. Eight finite-state puzzle generators are solver-verified, with solution replay, deterministic generation, optimal move targets, and nonmutating hints. Seven other games have constructive completion witnesses. Lumen's 360 boards are checked for fair spacing, with separate scoring and lifecycle tests.
- Server-owned scores, action validation, run ownership, persisted history, database reopening, unique reward transactions, concurrent action revisions, duplicate retries, purchase idempotence, hints, and undo.
- D1 adapter tested with the generated migrations against actual SQLite through a D1-shaped API. This verifies SQL and transaction behavior locally; it is not a deployed Cloudflare test.
- Production Node mode denies game source and APIs when identity is unconfigured.

## Security review regressions — PASSED

The five independently reported findings were fixed in the applicable Node and Worker paths. `tests/review.test.mjs` adds ten regression tests:

1. Stored OIDC sessions recheck the current issuer and subject allowlist; removed identities are denied and invalid sessions removed.
2. Resume requires a paused run, and pause requires an active run. A new action UUID cannot reset elapsed time. Duplicate requests retain their original revision.
3. Empty or invalid replay seeds and conflicting daily/restart/replay requests are rejected. Completed runs cannot restart for fresh standard rewards. Assistance and practice survive restart; hidden-answer restarts are assisted. Daily seed provenance is verified, and repeat daily attempts are assisted.
4. Active Cipher, Orbit, and Recall responses omit both run and state generation seeds. Cipher's secret is omitted. Daily seeds are random server-owned records rather than predictable date-derived values. Finished seed replays receive reduced rewards.
5. Recall enforces its authoritative viewing deadline on GET/list serialization and direct actions. A read after 600,000 ms does not reveal the arrangement in standard mode. Explicit practice remains untimed; replay is assisted.

A synchronized concurrent-start regression first reproduced two unassisted daily starts. Daily eligibility now runs inside the INSERT statement in the D1 transaction. Two requests are held until both finish their pre-insert reads; only the first insertion remains unassisted. The abandoned run can reveal its seed, but using that seed to answer the second run receives 25 XP and no daily bonus. No schema change was needed.

The Sites Worker trusts identity headers only behind the documented private Sites dispatcher. Direct public deployment of that adapter is unsupported. A browser memory game can expose an intentionally displayed sequence to its player; these checks do not claim competitive anti-cheat protection.

## Actual browser play

Final completion rerun: **PASSED — 32/32** (16 desktop at 1440×1000 and 16 touch at 390×844), zero failures. See `artifacts/browser-report.json` for the latest exact game/device results. Tests use real pointer/touch events and keyboard input, with server-confirmed completion and rewards; they do not mark runs complete through test-only game APIs.

`tests/browser-edges.mjs` — PASSED:

- Tutorial entry/exit, start, pause, resume, same-seed restart, and exit for all sixteen games on desktop. The original suite did not make a gameplay move inside every tutorial; the expanded flow suite below covers that separately.
- Relay read-only hint and undo in the browser; automatic blur pause and refresh recovery. Broader hint/undo coverage is in the expanded flow suite below.
- Actual touch cancellation, multiple-pointer isolation, and cancellation on resize while drawing in Lumen.
- A saved finish whose network response is deliberately lost: retry and refresh award no duplicate reward.
- History filters and JSON export; cosmetic purchase and equipped state survive reload.
- Layout checks at 320, 768, and 1440 pixels; reduced-motion and optional-sound settings; no page exceptions.

`tests/browser-timing.mjs` — PASSED:

- Failure/result screens for Lumen, Orbit, Cipher, Signal, Tempo, and Recall.
- Orbit incorrect-answer reveal and two-mistake limit.
- Comet and Lumen deadlines after a large frame/time jump.
- Complete timed rhythm run with keyboard: 18/18 beats. Mirror Harbor also completed with keyboard focus and Enter in the final desktop suite.
- Complete expert Orbit run with keyboard, including taught reflections: six stages, no mistakes.

Earlier completion attempts exposed a test-wait race and Chrome suppressing a compatibility click after an SVG drawing gesture. The touch path now activates a deliberate release immediately and suppresses only its duplicate trusted touch click. Keyboard and mouse retain native click activation. The final harness explicitly waits for a saved revision and cleared pending action. Only the final rerun is accepted as completion evidence. A later display-only correction removed the paused panel behind completed results; eight representative desktop/touch completion reruns also passed (`browser-focused-report.json`).

## Expanded tutorial and control flows

`tests/browser-flows.mjs`: **PASSED - 48/48**, zero failures. The 32 tutorial/lifecycle checks performed a real taught action in every tutorial on desktop and touch, then verified tutorial restart/pause/resume/exit and real-run start/pause/resume/restart/exit. Another 16 checks verified each of the eight puzzle games' hint/move/undo/assisted-restart/exit paths on both devices. Tutorials left persisted runs and currency unchanged. This is hands-on teaching-step coverage; full game completions are evidenced by the separate 32-run completion suite above. Reports checkpoint after every successful flow; an executor interruption was recovered from those checkpoints.

Tutorial restart now restarts the tutorial board. Tutorial pause preserves elapsed time, and paused tutorial input cannot advance the game. Gravity Ferry hints now check remaining fuel and do not propose a route that cannot be completed; a regression verifies exhausted and insufficient fuel without mutating the state.

Terminal failure is supported by seven games: Lumen, Orbit, Cipher, Signal, Tempo, Comet, and Recall. The eight planning/spatial puzzles and Stillwater use recoverable states rather than terminal failure; empty fuel/cards or an awkward layout are recovered using undo/restart, while Stillwater collisions retry the segment.

## Build and artifacts

`node scripts/build.mjs` — PASSED. It produces the deployment bundle in `dist/`. The public repository includes source, required migrations, game rules, setup instructions, and text reports. Screenshot evidence is retained in the separate source/QA archive; generated dist output is omitted. Runtime browser downloads, dependencies, databases, credentials, and unsuccessful diagnostic screenshots are excluded.

## Blocked / unverified

- **BLOCKED:** Hostinger deployment: parent observed the provider's security verification restriction; no retry or workaround attempted.
- **PENDING APPROVAL:** A new private ChatGPT Site as an alternative. No alternative site has been created or deployed.
- **SOURCE VISIBILITY:** The owner explicitly approved public source upload to `jigyasu2004/DOT-game`. Private hosted identity and progress remain deployment requirements.
- **UNVERIFIED:** Real OIDC provider login, Sites dispatcher routing, managed D1 runtime, private hosted access, and cross-device authenticated retrieval. The corresponding implementations and local isolation tests are present.
- **UNVERIFIED:** Physical iOS/Android devices, Safari/Firefox, formal screen-reader/WCAG audit, production latency/load, hosting backups, and actual disk-full recovery. Touch emulation is Chromium, not a physical device test.
- **UNAVAILABLE:** Original Lumen Loom source. The supplied Site returned `project_not_found`, so this is the authorized clean rebuild. No original or ScopeReady files were edited.

No glitch-free guarantee is made.
