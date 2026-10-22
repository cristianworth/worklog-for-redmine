# Worklog for Redmine

A small local web application for organizing time-entry drafts before submitting them to Redmine. Choose any inclusive date range, scroll through stacked days, create/edit/remove rows, and save drafts locally. Each day has its own duration total.

## Run locally

Requires Node.js **24.20 or newer within the 24.x line**, and npm.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:3000. One process serves React and the local API. For the built interface:

```sh
npm run build
npm start
```

Stop the server before switching between these modes; both use port 3000.

## Use

1. Choose **De** and **Até**, or select **Até hoje** to follow the current local date. Click **Exibir período**.
2. Scroll through the days and add rows. Enter the issue, duration (`01:30`), activity and observation.
3. Click the copy icon next to an issue to copy only its code. Paste it into another row normally. Browsers may restrict clipboard access; a failed copy is reported.
4. Click **Salvar rascunhos**. It saves every changed day, including dates no longer visible after changing the period. Saves are atomic: a conflict or failure prevents a partial database update.
5. Reopen to recover saved rows. The browser remembers the period preference; **Até hoje** recalculates the end date, keeping the chosen start. A refresh of the period preserves pending edits, including invalid duration input. Closing/reloading the page warns if unsaved edits remain.

The default view covers the last seven calendar dates, including today. Weekends remain available. Range preferences are stored only in that browser; drafts stay in SQLite. The current schema is unchanged, preserving previously saved days. **Modelo do dia**, **Configurações** and **Enviar ao Redmine…** are unavailable actions marked **Em breve**.

Incomplete rows can be saved as drafts. A blank duration contributes nothing to the total; malformed durations must be corrected or cleared before saving. Zero duration is allowed in a draft. No remote submission validation is implemented yet. Activity suggestions are editable examples, not a configured Redmine catalog or real IDs.

Data stays in `data/worklog.sqlite`, outside Git and independent of browser storage. Back up that file with the server stopped. Saved data remains after changing browsers on the same computer. Simultaneous edits in another tab are rejected instead of silently overwriting newer data; copy pending edits before reloading that tab.

## Verify

```sh
npm test
npm run build
```

Vitest checks duration arithmetic, period boundaries, dynamic end dates, preservation of pending edits, database reopening and atomic multi-day saves, including conflicts. Interface verification is manual. BDD, Cucumber and formal scenarios are not required.

## Scope and stack

React + Vite + TypeScript; Node + Express + SQLite through Node's built-in `node:sqlite` module. A single repository and process, bound to the local computer. Some Node 24 versions emit an experimental SQLite warning.

The period-based editor uses Lucide icons. Day templates and activity settings remain deferred; their buttons are disabled. See the plan for priorities.

Authentication, issue lookup, project-specific activity IDs, Redmine submission and optional issue-status changes remain future slices. Saving a draft does not send anything to Redmine. This project is independent of Redmine.

## Documentation and private reference

- [Plan](docs/development-plan.md)
- [Legacy workflow](docs/legacy-workflow.md)
- [Historical behavior examples](docs/behavior-specification.md)
- [Contributing](CONTRIBUTING.md)

The original spreadsheet and extracted VBA are private local references and must stay outside Git. Use synthetic examples; never commit credentials, databases or real work details. No GitHub remote exists yet. The license and publication destination still need confirmation; this private development package is not a public release.
