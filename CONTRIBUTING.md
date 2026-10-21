# Contributing

This is initially a personal portfolio project. The contribution process should stay small and useful.

## Working agreement

1. Identify one user-visible behavior and discuss examples with Cristian.
2. Record the expected outcome and any open question in the behavior specification.
3. Automate the relevant example at the simplest useful level.
4. Implement a small coherent change, preserving the established workflow.
5. Verify it and update only the documentation affected by the change.

## Programming conventions

- Use English identifiers and technical comments; explain a non-obvious decision instead of narrating code mechanics.
- Keep time calculations, storage and Redmine transport independent enough to test their real boundaries.
- Use integer minutes for the proposed duration model and explicit local calendar dates for work dates; verify the legacy conversions before adopting that model.
- Validate external input at runtime; TypeScript types alone do not validate HTTP responses.
- Treat local draft persistence and remote submission as separate actions with distinct results.
- Use explicit error handling and actionable messages. Preserve confirmed and uncertain outcomes independently in a batch.
- Prefer a straightforward implementation over extra layers, generic frameworks or duplicated state.

These are implementation recommendations until the initial design review approves the first slice.

## Verification

Automate meaningful examples: duration totals, required fields, project-specific activity mapping, persistence across reopening, confirmed submissions, partial batch failure and uncertain outcomes. Most integration checks should use a simulated Redmine service.

Add a small number of browser tests for the complete user workflow. Do not aim for an arbitrary coverage percentage or test implementation details that merely mirror the code.

The repository currently has no application or test runner. Add real setup/run/test instructions when the first executable slice exists; do not document nonexistent commands as working.

## Commits and versions

- Use cohesive commits with short English messages, such as `docs: define time logging behavior` or `feat: persist local worklog drafts`.
- Inspect the staged diff and ensure private material is excluded before committing or pushing.
- Check for changelog/version rules before each commit. When a changelog exists, follow Cristian's project instructions about proposing and confirming a version update.
- Record completion accurately. Do not claim a feature, passing test, release or remote push that has not happened.
- Do not create commits just to affect the GitHub contribution graph. Contribution display is a GitHub concern and is not a project acceptance criterion.

## Publication boundaries

The legacy spreadsheet, its extracted source and real service data are private references. Use synthetic fixtures and redact credentials and private infrastructure details from screenshots and error reports. The initial public license is still undecided.
