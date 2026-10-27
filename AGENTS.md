# Worklog for Redmine — agent instructions

## Read first and collaborate

- Speak Portuguese with Cristian. Use natural English for new identifiers, file names and technical comments; product text is Brazilian Portuguese. Default to personal/pair collaboration, with concise reasons for consequential choices.
- Start with `README.md`, `ROADMAP.md`, `CHANGELOG.md` and the relevant guide in `docs/README.md`. Code, reproducible checks and Cristian's current decisions prevail over historical notes.
- Follow the established `master` branch. Do not create another branch, rewrite history, move tags or force push without an explicit request.
- Cristian authorized cohesive commits and ordinary pushes. On 2026-10-25 he delegated release-version decisions for this project to the agent and requested automatic pushes as commits accumulate. Read the changelog policy, choose a proportionate version and keep manifests/footer/changelog consistent; do not ask again for routine version/commit/push decisions. This does not authorize real Redmine writes or unrelated account/security changes.
- Use small coherent changes and existing public contracts. Add dependencies/layers only for a demonstrated need. BDD/Cucumber are not required. Test meaningful behavior and plausible side effects; manually check changed UI with fictional data, keyboard and a narrow viewport.
- Completion reports state actual checks and limitations, then `Para testar` when applicable, `Workflow`, and `TL;DR`. Do not create another handoff unless asked. If explicitly resuming a handoff, read `C:/Users/crist/.codex/skills/handoff/SKILL.md` and follow its successor protocol unless Cristian has already accepted/dispensed with the milestones.

## Current product and boundaries

- Node.js 24.20+ within 24.x, React, Vite, TypeScript, Express and built-in SQLite are established. Vitest is the test runner. One repository and application are sufficient.
- Local mode stores drafts, catalog, template, batches and receipts in ignored `data/worklog.sqlite`. Preserve all usage data, especially 19, 20 and 21/10/2026. Never use that database for routine tests or demonstration.
- Demo mode selects a separate `WorklogDataAccess` at startup. It uses fictional tasks, one catalog and browser-only state. No fallback to HTTP, local API, SQLite or Redmine is allowed.
- P7-A–E were delivered in v0.5.0 (`eb89be2`), with 342 tests/25 files, both builds/audit and clean-install verification passing. Those are historical results; rerun checks for new changes.
- P8 targets GitHub Pages at `https://cristianworth.github.io/worklog-for-redmine/`, for recruiters/portfolio. Only audited `dist-demo/` is deployable. `dist/` is the local application. Current commands, CI and recovery are documented in `docs/deployment.md`; a source push alone does not prove successful deployment.
- P8 was published and checked on 2026-10-25 in v0.6.0: 346 tests/26 files, local/root-demo/Pages builds and artifact audits passed locally and in CI. Cristian authenticated the normal browser session; Pages was enabled through the UI with Actions source/HTTPS, and the failed initial deploy job was rerun successfully. The public URL passed save/reload, two-date simulated confirmation, receipt verification, reset and brand navigation with no console errors. Independent visitor feedback is next; do not invent that feedback or treat it as another implementation stage.
- Public code is `cristianworth/worklog-for-redmine`, MIT, under the verified `cristianworth` account. Publishing the Node backend or private reference material is not authorized.
- v0.7.0 adds a Windows launcher, not Electron: generated root `Worklog.exe` opens the default browser and supervises only its own `npm start` process tree. Keep the binary and launcher state/logs out of Git; source/build/smoke commands are versioned. Require the installed approved Node/npm; never silently install system runtimes or change execution/security policies. Reuse a verified matching service before install/build, and never stop a reused service. Shutdown requires the private in-memory token and must refuse active writes/batches. Tests use a new temporary project/config/SQLite, not usage data. See `docs/windows-launcher.md`.

## Catalog, days and templates

- v0.8.0 gives weekdays stable header colors, independent of receipt status. Preserve textual dates/status, today's marker and disclosure behavior. Shared brand/favicon is a passive SVG; include it in artifact auditing and launcher build fingerprints. System font fallbacks require no network. See `docs/interface.md` for tokens and visual checks.

- On 2026-10-26 Cristian requested weekday-only display (Monday–Friday), fully appropriated days initially collapsed, and names only in activity selectors. Keep calendar/storage APIs compatible with historical weekend data; never delete/migrate those rows. Explicit disclosure choices win for the current page; partial/uncertain/empty days start expanded. Preserve numeric activity IDs in configuration, receipt snapshots, review and submission; remove them only from selector labels/hints. New/restored demo examples use previous weekdays, without rewriting an existing visitor snapshot.

- Use one activity catalog per configured Redmine instance: `Activity` is name + activityId, without projectId. Names and codes are unique. Days/templates allow activity selection before issue lookup. Project context remains in task/permission validation and immutable receipts.
- The v0.4.0 migration backs up a legacy catalog and consolidates only identical name/code pairs, increasing its revision once. Conflicts/concurrent writes abort. Do not replay migration/population manually or rewrite old drafts, templates or receipt IDs to fit a catalog.
- The private usage catalog has 15 activities; that is neither a public default nor a product limit. Prior catalog migration/population/correction completed with backups. Journals are ignored under `private/global-catalog-*.json` and `private/activity-catalog-population.json`; do not replay them.
- Period reads never save, apply templates or replace pending edits. Save changed days atomically, including days outside the visible range, with revision conflicts preserving edits. Catalog/model saves are independent.
- A template copies once into an untouched new day, never over existing/edited days, including saved empty days. Changing the template does not alter old copies. Default local template/catalog start empty.
- Editor duration parsing accepts compact input; preserve the strict HH:MM transport parser and integer minutes. Collapse keeps row content mounted and unsaved state intact; Add row expands and focuses the new task.

## Submission and recovery

- Save is separate from submission. Require saved-row review and explicit confirmation. Reviews expire in 15 minutes and carry day/catalog/context revisions.
- Cached task lookup is for filling only. Validate the whole selection with current task/account/project information before the first creation; check project activity availability when the API supplies it. A missing list does not establish permission or prohibition. Keep per-row final guards.
- Persist `sending` before the remote POST. Only HTTP 201 plus a matching result/readback confirms creation. A 200, redirect or lost response is not success or safe failure.
- Confirmed/existing/sending/uncertain receipts remain locked. Reconciliation is read-only; missing, divergent or unavailable remote data does not unlock another creation. Preserve original creation/confirmation dates separately from later checks.
- Batches run sequentially and stop at the first failure, preserving partial results. Closing the review does not cancel accepted work. Never automatically resume after restart/reload or retry uncertain creation.
- Issue-status changes were canceled by Cristian (P5.1). Never reintroduce them from old VBA/scenarios.
- Demo schema 2 accepts schema 1 without losing edits. Invalid/future state is preserved until explicit restore. Web Locks serialize mutations, simulation and reset when available; fallback warns to use one tab. Reset must not let an old worker repopulate examples. All demo receipts/results are marked simulated.

## Private data and consumed authorizations

- Never commit keys, cookies, tokens, private hostnames, real task descriptions/responses, workbook/VBA, databases, backups or session handoffs. Use synthetic examples and blank/synthetic `.env.example`. Public guides cannot depend on ignored private files.
- The workbook contains already-submitted hours. Never import its rows as pending drafts or replay them. Original VBA/reference files remain private.
- All previous real submission tests are completed and their authorization is consumed: `private/authorized-time-entry-test.json`, `private/authorized-batch-tests.json` and `private/authorized-global-activity-tests.json` (and their isolated databases). Never replay, extend or delete their remote entries. Cristian handles remote deletion manually; do not infer that deletion has occurred.
- P4.1 incorporated nine confirmed receipts with a consistent backup and read-only checks; unrelated drafts were preserved. Do not repeat that import or seed the catalog from it. Details are in ignored `private/p41-confirmed-history-import.json`.
- Routine tests use temporary SQLite and simulated services. New real creation/deletion/status changes require a distinct explicit target and authorized fields; commit/push/hosting permission does not provide that.

## Configuration and verification

- Credentials and Redmine communication belong in Node. Never expose secrets through VITE variables, the browser or logs; browser login is not Node authentication.
- TLS verification stays enabled by default. The previously authorized private-server exception is opt-in via `REDMINE_ALLOW_INVALID_CERTIFICATE=true`, limited to the configured HTTPS origin (chain/name/dates), visibly identified and never global. Never follow redirects with credentials.
- Run `npm test`, local build, root demo build/audit, and Pages build/audit for changes affecting delivery. CI repeats them. Do not open the usage database to run checks. See CONTRIBUTING.md and SECURITY.md.
- Before publishing, review staged files and the static artifact for private material. Keep the Pages build path and app/demo links consistent. PRs/forks must not deploy to the original destination. Confirm remote CI/deploy and public URL before claiming the site is live.
