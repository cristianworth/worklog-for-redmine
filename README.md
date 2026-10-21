# Worklog for Redmine

A small local web application for organizing time-entry drafts before submitting them to Redmine. The current slice supports one working day at a time: create, edit and remove rows, total durations, and save/reopen drafts on the same computer.

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

1. Choose the work date and add a row, or load the synthetic example into an empty day.
2. Enter the issue, duration (`01:30`), activity and observation. The example totals `02:15`.
3. Click **Salvar rascunhos**. Closing/reopening preserves saved rows; edits are not autosaved.
4. Edit or remove rows and save again. Changing dates or leaving with pending edits prompts before discarding them.

Incomplete rows can be saved as drafts. A blank duration contributes nothing to the total; malformed durations must be corrected or cleared before saving. Zero duration is allowed in a draft. No remote submission validation is implemented yet. Activity suggestions are editable examples, not a configured Redmine catalog or real IDs.

Data stays in `data/worklog.sqlite`, outside Git and independent of browser storage. Back up that file with the server stopped. Saved data remains after changing browsers on the same computer. Simultaneous edits in another tab are rejected instead of silently overwriting newer data; copy pending edits before reloading that tab.

## Verify

```sh
npm test
npm run build
```

Vitest checks duration arithmetic and persistence, including database reopening, edits, deletion, separate dates and conflicting saves. Interface verification is manual for this first slice. BDD, Cucumber and formal scenarios are not required.

## Scope and stack

React + Vite + TypeScript; Node + Express + SQLite through Node's built-in `node:sqlite` module. A single repository and process, bound to the local computer. Some Node 24 versions emit an experimental SQLite warning.

The next planned slice shows a free date range as stacked days, with a fixed end date or an “until today” mode and a quick issue-code copy action. Day templates and activity settings remain deferred; their planned buttons will be marked unavailable until implemented. See the plan for priorities.

Authentication, issue lookup, project-specific activity IDs, Redmine submission and optional issue-status changes remain future slices. Saving a draft does not send anything to Redmine. This project is independent of Redmine.

## Documentation and private reference

- [Plan](docs/development-plan.md)
- [Legacy workflow](docs/legacy-workflow.md)
- [Historical behavior examples](docs/behavior-specification.md)
- [Contributing](CONTRIBUTING.md)

The original spreadsheet and extracted VBA are private local references and must stay outside Git. Use synthetic examples; never commit credentials, databases or real work details. No GitHub remote exists yet. The license and publication destination still need confirmation; this private development package is not a public release.
