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

1. Choose **De** and **Até**, or select **Até hoje** to follow the current local date. Valid dates update the view automatically after a short pause. Switching off **Até hoje** keeps the displayed end date. Incomplete or reversed dates preserve the last valid view; failed requests offer **Tentar novamente**.
2. Scroll through the days and add rows. Enter the issue, duration (`01:30`), activity and observation.
3. Click the copy icon next to an issue to copy only its code. Paste it into another row normally. Browsers may restrict clipboard access; a failed copy is reported.
4. Click **Salvar rascunhos**. It saves every changed day, including dates no longer visible after changing the period. Saves are atomic: a conflict or failure prevents a partial database update.
5. Reopen to recover saved rows. The browser remembers the period preference; **Até hoje** recalculates the end date, keeping the chosen start. A refresh of the period preserves pending edits, including invalid duration input. Closing/reloading the page warns if unsaved edits remain.

The default view covers the last seven calendar dates, including today. Weekends remain available. Range preferences are stored only in that browser; drafts stay in SQLite. The current schema is unchanged, preserving previously saved days. **Modelo do dia** and **Enviar ao Redmine…** are unavailable actions marked **Em breve**. **Configurações** opens connection instructions and a read-only API access check.

Incomplete rows can be saved as drafts. A blank duration contributes nothing to the total; malformed durations must be corrected or cleared before saving. Zero duration is allowed in a draft. No remote submission validation is implemented yet. Activity suggestions are editable examples, not a configured Redmine catalog or real IDs.

Data stays in `data/worklog.sqlite`, outside Git and independent of browser storage. The Node process opens this file when the application starts, creating it only if missing. Restarting the application reuses saved data; there is no separate database service or automatic sample-data import. Loading a period reads the database, while **Salvar rascunhos** commits the changes to disk. Back up that file with the server stopped. Saved data remains after changing browsers on the same computer. Simultaneous edits in another tab are rejected instead of silently overwriting newer data; copy pending edits before reloading that tab.

## Redmine access (read-only)

Copy `.env.example` to `.env` in the repository root. Set `REDMINE_URL` to the HTTPS base URL, including an installation subpath if needed. Set `REDMINE_API_KEY` locally when authentication is needed. Restart the server after changing configuration; environment variables take precedence over `.env`. The backend reads these values; no `VITE_` variables, browser credentials, passwords or session cookies are used. The key remains in the ignored `.env` file and server memory; it is not returned to the browser or stored in drafts.

Open **Configurações → Testar acesso à API**. The backend performs only `GET /users/current.json`. Each row’s **Consultar** performs only `GET /issues/:id.json` and shows subject, status and project. These results are temporary: they do not modify the draft, its observation or its saved revision. Changing a code cancels the previous lookup; copying a code still copies only the code.

TLS verification is enabled by default. For a known private Redmine with an invalid certificate, an explicitly accepted local exception can be enabled with `REDMINE_ALLOW_INVALID_CERTIFICATE=true`. It accepts certificate errors only for that configured HTTPS origin, never changes global TLS settings, and never follows redirects. This includes chain, hostname and validity errors; encryption remains but certificate-based server authentication is lost. The interface shows when the exception is active. Certificate failures are reported separately from missing/invalid authentication and permission errors. Redirects are not followed with API credentials. No connection test creates hours or changes issue status. The legacy HTML/session transport remains a possible follow-up if this instance cannot use the query API; it is not implemented yet.

The private server returned an expired-certificate error in strict mode on 2026-10-22. After Cristian accepted a scoped exception, the exact configured login page returned HTTP 200 and the API returned HTTP 401 without credentials. The installation subpath must be preserved. Authenticated real access remains unverified. See [connection checks](docs/redmine-access.md). Never paste credentials into chat. Use an optional `PORT` environment variable to choose another local port (default 3000).

## Verify

```sh
npm test
npm run build
```

Vitest checks duration arithmetic, period boundaries, dynamic end dates, preservation of pending edits, database reopening and atomic multi-day saves, including conflicts. Read-only Redmine tests cover private configuration, JSON contracts, error classification, credential handling and isolation from draft saves. Interface verification is manual. BDD, Cucumber and formal scenarios are not required.

## Scope and stack

React + Vite + TypeScript; Node + Express + SQLite through Node's built-in `node:sqlite` module. A single repository and process, bound to the local computer. Some Node 24 versions emit an experimental SQLite warning.

The period-based editor uses Lucide icons, a highlighted daily total and a separate, unavailable Redmine action. Day templates and the project activity catalog remain deferred; their controls are disabled. **Modo local** identifies this computer’s database and expands to explain storage. **Abrir demonstração** is a disabled future shortcut, not a published demo. See the plan for priorities.

API access checks and explicit issue lookup are implemented with synthetic tests. Real authenticated compatibility remains pending an API credential. Project-specific activity IDs, Redmine submission and optional issue-status changes remain future slices. Saving a draft does not send anything to Redmine. This project is independent of Redmine.

## Planned public demonstration

A public demo is scheduled among the final project stages, after the local workflow and integration have been consolidated. It will reuse the interface with synthetic examples, isolated browser storage and explicitly simulated submission. Visitors must never access the real SQLite database, the local API or a real Redmine service. A reset action will affect only that visitor’s demo examples. No demo build, public link or deployment exists yet.

The normal local mode continues to use Node and SQLite. The public code repository and an eventual hosted demo are separate deliverables; publishing code alone does not host the Node application.

## Documentation and private reference

- [Roadmap / checklist](ROADMAP.md)
- [Plan and decisions](docs/development-plan.md)
- [Connection checks](docs/redmine-access.md)
- [Legacy workflow](docs/legacy-workflow.md)
- [Historical behavior examples](docs/behavior-specification.md)
- [Contributing](CONTRIBUTING.md)

The original spreadsheet and extracted VBA are private local references and must stay outside Git. Cristian confirmed that the historical workbook entries have already been submitted to Redmine; inspect them only as historical examples, never seed them as pending drafts or replay them for testing. Use synthetic examples; never commit credentials, databases or real work details. No GitHub remote exists yet. The license and publication destination still need confirmation; this private development package is not a public release.
