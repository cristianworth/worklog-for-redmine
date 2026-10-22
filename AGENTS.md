# Worklog for Redmine — agent instructions

## Purpose and current boundary

Build a small personal web application that ports an existing spreadsheet time-logging workflow. Preserve the useful behavior first, then improve it in small reviewed increments. The context/plan and first local-drafts milestones were approved by Cristian on 2026-10-21. The first implementation is commit dd8bd4d. The period-based editing slice P1.1 was authorized by Cristian on 2026-10-22 and implemented for review. Consult the development plan for delivered behavior and deferred features; future action buttons are disabled, not implemented integrations.

Read `README.md`, `docs/development-plan.md`, `docs/behavior-specification.md`, `docs/legacy-workflow.md`, and the current handoff before making decisions. Distinguish user decisions, recommendations, observations and unverified hypotheses.

## Collaboration

- Speak Portuguese with Cristian. Use natural English for new identifiers, file names, tests and technical comments. The initial product UI is planned in Portuguese.
- Default to personal/learning collaboration. Explain unfamiliar frontend concepts and consequential design choices briefly, without treating Cristian as a programming beginner.
- Node.js, React, Vite, TypeScript, Express and SQLite are approved for the first slice. Use Vitest for totalization and persistence; check the interface manually. Additional tools remain optional.
- A single repository and a small application are sufficient. Add dependencies and abstractions only for an identified need.

## Private material

- Keep the local workbook and all extracted VBA out of Git. Do not copy them into public docs, fixtures, build output, screenshots or GitHub attachments.
- Never commit credentials, cookies, tokens, local databases, private hostnames, real work descriptions or raw Redmine responses.
- Use synthetic examples. Ignore local configuration and provide only a blank/synthetic `.env.example` when configuration is implemented.
- Keep authentication and Redmine communication in the backend. Do not expose secrets in the frontend bundle or logs.
- Do not treat the browser's existing login as authentication for the future Node application.
- Do not reproduce a global TLS-verification bypass from the legacy workbook. Certificate handling is a specific integration decision to validate, not a default to disable.

## Behavior and verification

- Cristian explicitly dispensed with BDD, Cucumber and mandatory formal scenarios on 2026-10-21. Use meaningful Vitest tests for totalization and persistence. Existing behavior examples are historical references, not an obligatory workflow.
- Verify the actual legacy flow before translating it. Do not preserve a known defect merely to claim parity, and do not silently change a business rule.
- Keep activity IDs configurable and account for project-specific mappings. The same activity label is not a globally unique identifier.
- Confirm remote writes using the service's actual success contract. Do not assume any HTTP 200 proves a successful time entry.
- Preserve partial-success information. Do not automatically retry an uncertain time-entry creation or an already confirmed entry.
- Tests and demos use a simulated Redmine service and synthetic data by default. Never create/delete real time entries or change real issue statuses merely to test without a specific authorized target.

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
