# Contributing

This is a small personal project. Read `AGENTS.md` and the development plan, consult the actual VBA before porting a rule, and discuss only consequential ambiguity with Cristian. Keep changes small and preserve the useful spreadsheet workflow.

Use English identifiers and technical comments; the interface and collaboration are in Portuguese. Add dependencies and abstractions only for a current need. BDD, Cucumber and formal behavior scenarios are not required (Cristian's decision, 2026-10-21).

## Verification

Run `npm test` for meaningful arithmetic and persistence checks, and `npm run build` for TypeScript/build verification. Manually check the interface using synthetic data. Browser automation can be added later if useful. Never write to the real Redmine service as part of routine tests.

Keep dates as calendar dates and durations as integer minutes. Draft persistence is separate from future submission validation and remote results. Incomplete drafts are allowed. Compact HHMM input is normalized through `parseDurationInput`; invalid minutes/seconds are rejected. Keep the strict HH:MM transport parser unchanged. Activities use one name/code catalog per configured Redmine instance. Preserve historical labels and immutable receipt codes; validate project availability before sending when the remote API supplies it. Never silently consolidate conflicting legacy IDs. Keep interface, persistence and time arithmetic sufficiently separate to test their actual boundaries.

## Commits and publication

Use cohesive commits with short English messages. Remain on the established branch. Read `CHANGELOG.md` before committing and follow Cristian's version approval rule. Keep the current manifest, lockfile and displayed version aligned; record only delivered changes in released versions. Planned work belongs in the roadmap. Routine cohesive commits and ordinary pushes are authorized. Do not fabricate activity or rewrite history.

Review the staged diff for private material. The workbook, extracted VBA, local databases, secrets, raw responses and real work details must remain outside Git. The public source is licensed under MIT. Keep private references and session handoffs outside the distribution; describe behavior with synthetic examples. Review provenance and privacy before publishing any additional material. No real Redmine writes or cross-chat messages are implied by Git authorization.
