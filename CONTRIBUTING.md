# Contributing

Thanks for helping improve Worklog for Redmine. Start with the [README](README.md), [architecture](docs/architecture.md) and [roadmap](ROADMAP.md). The product interface is in Brazilian Portuguese; new identifiers and technical comments use English. Follow existing conventions and keep changes focused.

## Set up and verify

Use Node.js 24.20 or newer within 24.x and `npm ci`. No API key or private database is required to run the tests or demo. For UI work, prefer `npm run build:demo` and `npm run preview:demo` with the fictional examples.

Run the checks from the README before a pull request. The Pages build has a different base path; check it even if the root demo preview works. Manually verify changed interactions, including keyboard use and a narrow viewport. The test suite uses Vitest; BDD/Cucumber and tests that only mirror implementation are not required.

## Issues and pull requests

For a bug, include the application version, browser/Node version, mode (demo/local), reproduction steps, expected and observed behavior. Use fictional task IDs, observations and screenshots. For a feature, describe the workflow problem before proposing a new dependency or layer.

Keep each pull request cohesive. Explain the resulting behavior, relevant trade-offs, checks actually run and known limitations. Preserve public contracts and avoid unrelated renames or formatting churn. Update current guides when behavior changes; record delivered changes in the changelog after the release/version decision. Historical release entries and tags must not be rewritten.

## Invariants worth preserving

- Saving drafts never submits hours. Submission requires saved data, review and explicit confirmation.
- Activities come from one catalog per configured Redmine instance; project context does not duplicate catalog rows.
- Confirmed/existing/started/uncertain receipts stay protected. Reconciliation reads; it never repeats creation.
- Batch preflight covers the whole selection before the first write. Later failure preserves partial results. No automatic resume.
- A template never overwrites an existing day, including a saved empty day. Issue status changes are outside scope.
- Demo code cannot call the local API or include server modules, credentials, databases or private references.

Never create/delete real Redmine entries or modify issue statuses for routine tests. Do not open or rewrite another person's usage database. Use temporary SQLite stores and simulated services. Never commit `.env`, keys, databases, backups, spreadsheet/VBA material or real task descriptions. See [SECURITY.md](SECURITY.md) before reporting a sensitive issue.

## Publishing

Pull requests only verify. The established `master` workflow publishes the audited demo after all checks pass; no npm package or local backend is published. Forks must configure their own destination before enabling deployment. [Deployment instructions](docs/deployment.md) cover paths, permissions and rollback.
