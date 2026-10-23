# Worklog for Redmine

A small local web application for organizing time-entry drafts and explicitly submitting saved lines to Redmine. Choose any inclusive date range, scroll through stacked days, create/edit/remove rows, and save drafts locally. Each day has its own duration total.

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
2. Scroll through the days and add rows. Enter the issue and leave its field to identify the project, select an activity by name/code, then enter the duration (`30`/`030` for 30 minutes, `130` for 1h30, or `01:30`) and observation.
3. Click the copy icon next to an issue to copy only its code. Paste it into another row normally. Browsers may restrict clipboard access; a failed copy is reported.
4. Click **Salvar rascunhos**. It saves every changed day, including dates no longer visible after changing the period. Saves are atomic: a conflict or failure prevents a partial database update.
5. Reopen to recover saved rows. The browser remembers the period preference; **Até hoje** recalculates the end date, keeping the chosen start. A refresh of the period preserves pending edits, including invalid duration input. Closing/reloading the page warns if unsaved edits remain.

The default view covers the last seven calendar dates, including today. Weekends remain available. Range preferences are stored only in that browser; drafts stay in SQLite. The draft-day format is preserved; the activity catalog adds a separate table in the same database. **Modelo do dia** configures recurring rows for untouched new days. **Enviar dia** reviews the saved pending rows of one day. Check rows or day headers and use **Enviar selecionados** to review several dates together; neither action sends immediately. **Configurações** opens connection instructions and a read-only API access check.

Incomplete rows can be saved as drafts. A blank duration contributes nothing to the total; malformed durations must be corrected or cleared before saving. Zero duration is allowed in a draft. Preparing submission validates required fields, resolves the activity inside the issue project and checks for equivalent existing entries; server-specific limits are enforced by Redmine. Activity text remains editable; project-specific suggestions come from the local catalog after looking up an issue. Incomplete or unmapped drafts can still be saved.

Data stays in `data/worklog.sqlite`, outside Git and independent of browser storage. The Node process opens this file when the application starts, creating it only if missing. Restarting the application reuses saved data; there is no separate database service or automatic sample-data import. Loading a period reads the database, while **Salvar rascunhos** commits the changes to disk. Back up that file with the server stopped. Saved data remains after changing browsers on the same computer. Simultaneous edits in another tab are rejected instead of silently overwriting newer data; copy pending edits before reloading that tab.

## Redmine access (read-only)

Copy `.env.example` to `.env` in the repository root. Set `REDMINE_URL` to the HTTPS base URL, including an installation subpath if needed. Set `REDMINE_API_KEY` locally when authentication is needed. Restart the server after changing configuration; environment variables take precedence over `.env`. The backend reads these values; no `VITE_` variables, browser credentials, passwords or session cookies are used. The key remains in the ignored `.env` file and server memory; it is not returned to the browser or stored in drafts.

Open **Configurações → Testar acesso à API**. The backend performs only `GET /users/current.json`. Leaving a row’s issue-code field automatically looks up its subject, status and project. **Consultar / Atualizar tarefa** allows an explicit retry or refresh. Successful lookups are shared in backend memory for 10 minutes (up to 500 tasks per configured client), including simultaneous requests; failures are not cached. No lookup metadata is persisted in SQLite. Only `GET /issues/:id.json` is used. These results are temporary: they do not modify the draft, its observation or its saved revision. Changing a code cancels the previous lookup; copying a code still copies only the code.

TLS verification is enabled by default. For a known private Redmine with an invalid certificate, an explicitly accepted local exception can be enabled with `REDMINE_ALLOW_INVALID_CERTIFICATE=true`. It accepts certificate errors only for that configured HTTPS origin, never changes global TLS settings, and never follows redirects. This includes chain, hostname and validity errors; encryption remains but certificate-based server authentication is lost. The interface shows when the exception is active. Certificate failures are reported separately from missing/invalid authentication and permission errors. Redirects are not followed with API credentials. The connection test and issue lookup never create hours or change issue status. Creation requires the separate reviewed confirmation. Creation uses `POST time_entries.json` with the same private API key. No HTML/session transport is implemented.

The private server returned an expired-certificate error in strict mode on 2026-10-22. After Cristian accepted a scoped exception, the exact configured login page returned HTTP 200 and the API returned HTTP 401 without credentials. The installation subpath must be preserved. Authenticated account and issue reads were subsequently verified using the locally configured key. A running process with an older empty key returned 401 until restarted; changing `.env` requires restarting the application. See [connection checks](docs/redmine-access.md). Never paste credentials into chat. Use an optional `PORT` environment variable to choose another local port (default 3000).

## Activity catalog

Open **Configurações → Atividades por projeto**. Add the project ID, Redmine activity ID and name, then use **Salvar catálogo**. Look up an issue to see its project ID. Check activity IDs against the actual Redmine project; the catalog starts empty, with no workbook import or automatic discovery. The same name can have a different ID in another project, while duplicate names/IDs inside one project are rejected.

After looking up a row (automatically on blur or explicitly), its closed activity selector offers only catalog entries for that issue’s project, showing each name and code. Historical unconfigured names remain visible as preserved, unavailable choices until corrected. The draft can still be saved incomplete; submission requires a valid mapping. Changing the issue code invalidates the previous project. Lookup metadata is temporary; leave the code field or use Consultar after reopening. The original activity string remains the persisted draft field, with no destructive data migration or silent rewrite after catalog changes. Submission must revalidate the issue/project/activity before a future remote write.

Catalog settings live in `activity_catalog` in the same ignored SQLite database. Their save/revision is independent of day saves. Conflicting changes preserve the editor; copy pending changes, discard/reload the catalog, and reapply them deliberately. Closing Configurações keeps unsaved catalog edits in the current page; the header marks them **Não salvo**, and leaving the page warns. **Descartar alterações** resets catalog edits only. **Salvar rascunhos** does not save the catalog, and vice versa.

## Submit saved rows or days

1. Save the affected days. **Salvar rascunhos** only updates local drafts.
2. Use **Enviar dia** to review all pending rows in one day, or select row/day checkboxes and choose **Enviar selecionados**. One selected row also works. Unsaved days and locked results cannot be selected. A batch accepts 1–100 rows and follows selection order.
3. Review the exact dates, tasks, projects, observations, durations and activity codes. Resolve every preparation error before confirming. **Voltar sem enviar** creates no remote entries.
4. Confirm the batch. Execution is sequential and stops at the first failure. Each result is persisted; later rows are identified as **Não enviado**. Existing equivalents are not created again. Issue statuses stay unchanged.
5. Closing the dialog does not cancel an accepted batch. Use **Envios recentes neste período → Ver lote** after reopening the page. Refreshing results only reads local receipts; it never starts another worker. A server restart does not resume remaining rows.
6. Use **Ver resultado → Conferir resultado** on an uncertain row to query Redmine without sending again. Confirmed/existing/started/uncertain rows remain protected. Other rows can be corrected, selected and reviewed in a new batch.

Reviews expire after 15 minutes and are invalidated by saved day/catalog or remote account/project/activity changes. All selected local revisions are checked before the first creation. Preserve the SQLite file and receipts. [Batch details](docs/batch-submission.md) and [individual submission contract](docs/individual-submission.md) describe the limits and recovery behavior.

## Appropriation status and real local data

Confirmed rows show a green check, **Apropriado**, the remote ID and an original date. The day header distinguishes complete days from mixed or uncertain results. The daily total still includes pending drafts. Remote creation, first local confirmation and latest check are separate dates; unavailable creation dates are labeled as confirmation/check dates.

**Ver resultado → Conferir no Redmine** performs reads only. Missing/hidden, divergent or unavailable remote records show a warning while preserving the original receipt and resend lock. The status does not silently follow external changes; request a check explicitly.

The three specifically authorized P4 days have been incorporated into the normal local SQLite with nine confirmed receipts. Two preexisting drafts were preserved. A consistent backup preceded the atomic import, and every remote ID was checked without creating hours. Local history is now real usage data: keep the SQLite and receipts, and never commit the database or backups. The private import journal identifies the backup path. This controlled operation does not add a general upload/import interface or populate the manual activity catalog. [Status and import details](docs/appropriation-status-plan.md).

Before any batch creation, the backend validates every selected pending row with current Redmine data, independently of the editor cache. An invalid/inaccessible task or other validation failure blocks all dates in that selection, with date, row and code in the error. Repeated tasks share reads only within that preflight. Each row retains its final individual guard. Redmine has no transaction across creations: failures after writes begin may still produce a preserved partial result.

## Duration input

`30` or `030` means `00:30`; `130` means `01:30`; `800` means `08:00`. Compact input uses its last two digits as minutes. `HH:MM` remains valid, and fields normalize on blur. Totals and saves use the same conversion even before blur; storage remains integer minutes. Invalid minutes (`90`, `160`, `1:60`), decimals, signs and seconds are rejected rather than silently repaired. Empty durations stay incomplete. The same rules apply in the day template.

## Verify

```sh
npm test
npm run build
```

Vitest checks duration arithmetic, period boundaries, dynamic end dates, preservation of pending edits, database reopening and atomic multi-day saves, including conflicts. Activity tests cover project isolation, duplicate mappings, catalog reopening, conflicts and opening an older draft database without rewriting its rows. Submission tests cover explicit confirmation, duplicate/concurrent sends, immutable receipts, rejection, uncertainty and read-only recovery across database reopening. Batch tests cover one day, multiple days, preparation errors, obsolete reviews, complete backend preflight before the first write (including a newly invalid task in the second day), partial failures, duplicate confirmation and interrupted execution. Lookup tests cover shared requests, expiry, refresh, bounded memory, failed requests and client isolation. Read-only Redmine tests cover private configuration, JSON contracts, error classification, credential handling and isolation from draft saves. Interface verification is manual. BDD, Cucumber and formal scenarios are not required.

## Scope and stack

React + Vite + TypeScript; Node + Express + SQLite through Node's built-in `node:sqlite` module. A single repository and process, bound to the local computer. Some Node 24 versions emit an experimental SQLite warning.

The period-based editor uses Lucide icons, a highlighted daily total and separate save/review/confirm actions. **Modelo do dia** configures local recurring rows. On an untouched new date, **Criar dia com modelo** copies them once into an unsaved draft. Existing/edited dates, including saved empty days, are preserved; changing the model affects only future copies. **Adicionar linha** remains a blank row. The model starts empty, accepts incomplete defaults and saves separately from drafts; closing its panel preserves unsaved edits while the page remains open. [Usage and limits](docs/day-template.md). The project activity catalog is available in Configurações. **Modo local** identifies this computer’s database and expands to explain storage. **Abrir demonstração** is a disabled future shortcut, not a published demo. See the plan for priorities.

API access checks and automatic issue lookup are implemented with synthetic tests. Real account and issue reads have been verified with the local API key; one specifically authorized real time-entry test was created and verified, with issue status unchanged. Its private record is excluded from Git and must never be replayed. Two separately authorized batch tests were subsequently completed and verified, covering nine entries with unchanged issue statuses; those authorizations are also consumed. A local project-specific activity catalog, individual submission and period batches are implemented; issue-status changes were explicitly removed from scope; submission always preserves the card status. Saving a draft does not send anything to Redmine. This project is independent of Redmine.

## Planned public demonstration

A public demo is scheduled among the final project stages, after the local workflow and integration have been consolidated. It will reuse the interface with synthetic examples, isolated browser storage and explicitly simulated submission. Visitors must never access the real SQLite database, the local API or a real Redmine service. A reset action will affect only that visitor’s demo examples. No demo build, public link or deployment exists yet.

The normal local mode continues to use Node and SQLite. The public code repository and an eventual hosted demo are separate deliverables; publishing code alone does not host the Node application.

## Versions

Current version: **v0.2.0**, with closed project-specific activity selection and compact duration input in days and templates. The day template (P5) was delivered in **v0.1.0**. The earlier P0–P4.2 implementation is documented retrospectively as **v0.0.0**; historical manifests are preserved. The footer reads the current version from `package.json` during the build. See [CHANGELOG.md](CHANGELOG.md) for delivered changes and [ROADMAP.md](ROADMAP.md) for planned work. The next stages prepare an isolated public demo and then publication (P7/P8). Versions/tags are local until publication is explicitly completed.

## Documentation and private reference

- [Changelog / versions](CHANGELOG.md)
- [Roadmap / checklist](ROADMAP.md)
- [Day template](docs/day-template.md)
- [Plan and decisions](docs/development-plan.md)
- [Connection checks](docs/redmine-access.md)
- [Individual submission](docs/individual-submission.md)
- [Batch submission](docs/batch-submission.md)
- [Appropriation status and confirmed-history incorporation](docs/appropriation-status-plan.md)
- [Legacy workflow](docs/legacy-workflow.md)
- [Historical behavior examples](docs/behavior-specification.md)
- [Contributing](CONTRIBUTING.md)

The original spreadsheet and extracted VBA are private local references and must stay outside Git. Cristian confirmed that the historical workbook entries have already been submitted to Redmine; inspect them only as historical examples, never seed them as pending drafts or replay them for testing. Use synthetic examples; never commit credentials, databases or real work details. No GitHub remote exists yet. The license and publication destination still need confirmation; this private development package is not a public release.
