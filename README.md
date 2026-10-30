# Worklog for Redmine

Prepare several days of time-entry drafts, check daily totals and review what will be sent to Redmine. Built for a personal workflow where hours are reconstructed together and submitted later.

## Try the live demo

[![Try the live demo](docs/assets/try-demo.svg)](https://cristianworth.github.io/worklog-for-redmine/)

**[Open the demo in your browser](https://cristianworth.github.io/worklog-for-redmine/)** — no account, installation or Redmine key. Edit fictional entries, simulate submission and inspect the saved results. The interface is in Brazilian Portuguese; submissions never reach a real Redmine.

![Worklog with weekday colors, fictional drafts and per-day totals](docs/images/demo.png)

[Local usage](docs/local-usage.md) · [Architecture](docs/architecture.md) · [Documentation](docs/README.md)

## Try it in a few minutes

1. Edit one of the three example days. Fictional task IDs: **9001**, **9004**, **9007**.
2. Use **Salvar rascunhos** to persist your changes in this browser.
3. Choose **Simular dia** below that day's tasks, or use **Selecionar todos** for saved pending rows in the visible period and **Simular selecionados**.
4. Review and confirm. Results are labeled **Simulado**; **Ver resultado** lets you check a saved receipt without creating another.
5. Reload to recover saved work. **Restaurar exemplos** asks before discarding the demo's saved data and open edits.

## What it does

- A free date range showing Monday–Friday, with stacked days and a duration total per day. Historical weekend data stays stored.
- The Azulejos cool weekday palette, clear row separation and a shared vector brand/favicon. Dates and receipt states remain readable without relying on color. [Interface decisions](docs/interface.md).
- Compact task rows, with lookup details spanning the editor width. Comments start with one line and remain resizable; longer text stays editable and scrollable.
- Fully appropriated days start collapsed; pending or uncertain days stay expanded. Click a day's header or use its disclosure button to expand/collapse it.
- Compact duration input: `30` → `00:30`, `130` → `01:30`; integer minutes internally. The green **+** on the right adds time to an existing duration, with a preview and Enter to apply.
- Missing required fields have a subtle red outline immediately; leaving them empty adds explanatory messages. Incomplete drafts remain saveable; submission requires valid saved rows.
- One activity catalog, available before looking up a task; selectors show alphabetically ordered names only. IDs remain available in settings and submission review.
- A reusable day template, copied explicitly into untouched dates.
- Saved-row selection, review, confirmation and sequential batches with visible progress, partial results and explicit completion feedback.
- Protected receipts, conservative duplicate checks and read-only recovery after uncertain results.

Saving and submitting are separate actions. Issue statuses stay unchanged. This project is independent of Redmine.

## Two modes, one interface

|             | Public demo                                | Local application                          |
| ----------- | ------------------------------------------ | ------------------------------------------ |
| Runs on     | GitHub Pages, static files                 | Node.js on your computer                   |
| Data        | Fictional examples; this browser's storage | Your drafts and receipts in SQLite         |
| Submission  | Simulated; no operational network access   | Redmine API after review and confirmation  |
| Credentials | None                                       | Optional private `.env`, read only by Node |
| Recovery    | Reload saved data or restore examples      | Preserve receipts and back up SQLite       |

Clearing site data loses demo history. Browsers without Web Locks show a one-tab-at-a-time notice. Reloading never resumes an interrupted batch automatically. The demo illustrates the workflow; it does not validate real Redmine permissions or availability.

## Run locally

Requires **Node.js 24.20 or newer within 24.x**, and npm.

```sh
git clone https://github.com/cristianworth/worklog-for-redmine.git
cd worklog-for-redmine
npm ci
npm run dev
```

Open **http://127.0.0.1:3000**. A fresh installation starts with an empty local catalog and no imported examples. Draft editing works without Redmine configuration. Follow the [local usage guide](docs/local-usage.md) to configure the API, register activities, back up data and submit hours deliberately.

To run the built local interface, stop the development server, then run `npm run build` and `npm start`. Both use port 3000; `PORT` can override it. Do not expose this personal local server to the public Internet.

On Windows, **Worklog.exe** starts the service and opens your default browser when it is ready. Keep it in the project root. Generate it with `npm run launcher:build` (Node and Windows .NET Framework required). It installs missing/incomplete dependencies, rebuilds changed sources, handles occupied ports and reuses this folder's existing service. The status window can be hidden to the tray; **Encerrar e sair** stops only a service it owns. [Usage, troubleshooting and verification](docs/windows-launcher.md). The generated binary stays outside Git.

For a backend-free demo preview:

```sh
npm run build:demo
npm run check:demo
npm run preview:demo
```

Open **http://127.0.0.1:4173/**. To reproduce the deployed subdirectory, use `npm run build:pages`, `npm run check:demo -- /worklog-for-redmine/` and `npm run preview:pages`, then open **http://127.0.0.1:4174/worklog-for-redmine/**. Both demo builds use `dist-demo/`; the latest build replaces the previous one. The local build uses `dist/`.

## Engineering choices

React, TypeScript and Vite provide the editor; Express and Node's built-in SQLite module keep the local service small. A typed data-access contract selects HTTP or the browser simulation at startup. Shared validators preserve duration, catalog and review rules across both modes.

Explicit saves and revision checks protect pending edits. Submission first persists a started receipt, then accepts only the service's verified creation contract. A batch validates the whole selection before its first write, runs sequentially and preserves partial successes. Uncertain creation is reconciled by reading, never by automatic retry.

The demo build skips `.env`, excludes server/HTTP/private modules and includes a CSP blocking operational network connections. Deployment uploads only the audited static artifact. No shared backend, authentication system or telemetry was added for the portfolio. See [architecture and trade-offs](docs/architecture.md).

## Verify and contribute

```sh
npm test
npm run build
npm run build:demo
npm run check:demo
npm run build:pages
npm run check:demo -- /worklog-for-redmine/
```

CI repeats these checks; only verified `master` builds from this repository deploy. Pull requests run checks without publishing. Tests use temporary stores and fictional services. Never send real hours as a routine test. See [contributing](CONTRIBUTING.md), [security boundaries](SECURITY.md) and [deployment/recovery](docs/deployment.md).

## Documentation and status

- [Documentation map](docs/README.md): current guides and historical references.
- [Changelog](CHANGELOG.md): delivered releases; the footer reads the version from `package.json`.
- [Roadmap](ROADMAP.md): priorities, completed milestones and remaining visitor feedback.

The legacy spreadsheet, VBA, keys, local databases, backups and session handoffs are excluded from this repository. Public examples are created from scratch. Repository history is preserved; older project-specific activity mappings are superseded by the single catalog introduced in v0.4.0.

## License

[MIT](LICENSE), copyright 2026 Cristian Weissmantel. Dependencies retain their own licenses. The private spreadsheet, VBA and local data are not distributed.
