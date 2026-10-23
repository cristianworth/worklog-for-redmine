# Worklog for Redmine — agent instructions

## Purpose and current boundary

Build a small personal web application that ports an existing spreadsheet time-logging workflow. Preserve the useful behavior first, then improve it in small reviewed increments. The context/plan and first local-drafts milestones were approved by Cristian on 2026-10-21. The first implementation is commit dd8bd4d. The period-based editing slice P1.1 was authorized by Cristian on 2026-10-22 and implemented for review. Consult the development plan for delivered behavior and deferred features; P1.2 chunks A–D were authorized and implemented on 2026-10-22 for review; individual submission is implemented with saved-row selection, review and explicit confirmation; P4 implements day/period selection, batch review, sequential execution and persistent partial results; template actions remain deferred. P2 begins with private API-key configuration and read-only JSON lookup; HTML/session authentication is not implemented; P3 uses the confirmed API-key transport for time-entry creation. Cristian authorized a certificate-validation exception for the known private Redmine on 2026-10-22. It is opt-in, limited to the configured HTTPS origin, visibly identified, and never a process-wide setting. Authenticated account and issue reads were verified with the local key on 2026-10-22 without exporting real issue details. P2.1 adds a local activity catalog keyed by project and label; draft activity strings remain compatible. The public demo belongs among the final stages (P7/P8); current demo labels and shortcuts must not imply a deployed or functional demo.

P4.1 was delivered on 2026-10-23 before P5: appropriation badges/dates, complete/partial day summaries, read-only verification and controlled incorporation of the three P4 days with their confirmed receipts. Read `docs/appropriation-status-plan.md`. Nine confirmed records now exist in ignored `data/worklog.sqlite`; the two unrelated drafts were preserved. A consistent backup and private journal exist under `backups/` and `private/p41-confirmed-history-import.json`. Import performed only GET requests; all prior real-write test authorizations remain consumed. Do not replay them. The activity catalog was not seeded by the import. P5 is next.

Read `ROADMAP.md`, `README.md`, `docs/development-plan.md`, `docs/behavior-specification.md`, `docs/legacy-workflow.md`, and the current handoff before making decisions. Distinguish user decisions, recommendations, observations and unverified hypotheses.

## Collaboration

- Speak Portuguese with Cristian. Use natural English for new identifiers, file names, tests and technical comments. The initial product UI is planned in Portuguese.
- Default to personal/learning collaboration. Explain unfamiliar frontend concepts and consequential design choices briefly, without treating Cristian as a programming beginner.
- Node.js, React, Vite, TypeScript, Express and SQLite are approved for the first slice. Use Vitest for totalization and persistence; check the interface manually. Additional tools remain optional.
- A single repository and a small application are sufficient. Add dependencies and abstractions only for an identified need.

## Private material

- Keep the local workbook and all extracted VBA out of Git. Do not copy them into public docs, fixtures, build output, screenshots or GitHub attachments.
- Cristian confirmed on 2026-10-22 that the workbook contains real, already-submitted entries. Use it only as private historical reference; never import its rows as pending drafts or replay them for tests.
- Never commit credentials, cookies, tokens, local databases, private hostnames, real work descriptions or raw Redmine responses.
- Use synthetic examples. Ignore local configuration and provide only a blank/synthetic `.env.example` when configuration is implemented.
- Keep authentication and Redmine communication in the backend. Do not expose secrets in the frontend bundle or logs.
- Do not treat the browser's existing login as authentication for the future Node application.
- Keep certificate validation enabled by default. The explicitly authorized private-server exception uses REDMINE_ALLOW_INVALID_CERTIFICATE=true only for requests to the configured HTTPS origin. Never change global TLS settings or follow redirects with credentials; preserve the UI warning. It accepts invalid chain/name/dates, not only expiry.

## Behavior and verification

- Cristian explicitly dispensed with BDD, Cucumber and mandatory formal scenarios on 2026-10-21. Use meaningful Vitest tests for totalization and persistence. Existing behavior examples are historical references, not an obligatory workflow.
- Verify the actual legacy flow before translating it. Do not preserve a known defect merely to claim parity, and do not silently change a business rule.
- Keep activity IDs configurable and account for project-specific mappings. The same activity label is not a globally unique identifier.
- Confirm remote writes using the service's actual success contract. Do not assume any HTTP 200 proves a successful time entry.
- Persist a submission as sending before the remote POST. Only HTTP 201 plus a matching remote result/readback confirms creation. Never equate a 200/redirect or lost response with success or safe failure. Confirmed, existing, sending and uncertain rows are locked; reconciliation is read-only.
- P4 batches stop at the first failure. Persist the selected review and started state before work; use the individual service per row. Never resume a batch automatically after restart. Closing the dialog does not cancel accepted work.
- Keep original confirmation/remote creation dates separate from later read-only checks. Missing, divergent or unavailable remote data must not unlock a confirmed receipt for creation. Import confirmed history atomically with a consistent backup, preserving unrelated drafts and original IDs/dates.
- Preserve partial-success information. Do not automatically retry an uncertain time-entry creation or an already confirmed entry.
- Tests and demos use a simulated Redmine service and synthetic data by default. Never create/delete real time entries or change real issue statuses merely to test without a specific authorized target.
- Cristian authorized one specific future real submission test on 2026-10-22. Its exact target and fields are stored only in ignored `private/authorized-time-entry-test.json`. This is not a draft seed or a general write permission. The authorized test was executed and confirmed on 2026-10-22, with readback and unchanged issue status. Its authorization is consumed: never repeat it. Read the private state before any related work. New real tests require a distinct authorized target; routine tests remain simulated.

Cristian provided a new, separate P4 real-test authorization on 2026-10-22: one day first, then two days together, with unchanged issue statuses. Original test inputs and results remain in ignored `private/authorized-batch-tests.json` and `private/authorized-batch-tests.sqlite`; P4.1 incorporated their confirmed history into the ignored production SQLite without new remote writes. He reports deleting the prior individual test. Preserve its old consumed journal; this new authorization does not permit generalized retries, receipt deletion, other dates/fields or status changes. Both P4 batches completed: nine entries were confirmed with matching readback and unchanged issue status. This authorization is consumed; never replay these batches. Read the new journal before any related real operation.

## Git, versions and publishing

- Cristian explicitly authorized cohesive commits and ordinary pushes for this project. Do not ask again for each routine commit/push within that scope.
- Follow the established branch. Do not invent a new branch without an explicit request.
- Before any commit/merge, check whether a changelog exists and read its rules. If it exists, propose the appropriate version and ask whether Cristian wants the changelog/version updated unless already authorized for that delivery. Keep versions consistent; do not bump once per commit.
- Commit real completed work; do not create empty commits or split work artificially for contribution counts. Do not rewrite dates or author identity to affect GitHub activity.
- The successor is authorized to create the GitHub repository `worklog-for-redmine` for Cristian. Verify the destination account and intended visibility; do not invent an owner or remote. No remote exists in the initial snapshot.
- Public release requires selecting the license and reviewing the staged content for private/reference material. Publishing the legacy workbook or extracted source is not authorized.
- Ordinary push authorization does not cover force-push, history rewriting, destructive remote changes, branch protection changes, real Redmine writes or messages to other chats.

## Completion reports

Explain what changed, why, actual verification and limitations. Include practical testing when executable behavior exists. Follow Cristian's closing order: `Para testar` when applicable, `Workflow`, then `TL;DR`. While the handoff's learning milestones are open, include `Validação para o main` before those closing blocks.
