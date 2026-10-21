# Worklog for Redmine

A planned local web application for organizing time entries and submitting them to Redmine, individually or in batches.

The project starts from an existing spreadsheet workflow: enter the date, issue, duration, activity and comment; review the entries; then submit the selected worklogs. The first web version will preserve that workflow while improving the interface and local persistence.

## Current status

**Planning and documentation only.** No web application, package manifest, automated tests, installation command or released version exists yet. The behavior scenarios are specifications awaiting review and implementation, not passing tests.

The intended GitHub repository has not been created. The project is intended for eventual open-source and portfolio use; the license still needs to be selected. This project is independent of Redmine.

## Intended first version

- Organize time entries by day and month.
- Enter and edit an issue number, duration, activity and comment.
- Save local drafts and display daily totals.
- Consult issue descriptions and statuses.
- Submit individual entries or selected batches, with a result for each entry.
- Maintain an editable activity catalog, with project-specific mappings where needed.
- Preserve the existing optional issue-status workflow after its behavior is characterized and reviewed.

These are planned capabilities, not implemented features.

## Technology direction

- **Chosen by Cristian:** Node.js backend; React is authorized for the frontend.
- **Recommended baseline, awaiting the initial design review:** React + Vite + TypeScript, Node.js + Express + TypeScript, SQLite, and selected shadcn/ui components.
- **Recommended verification:** Vitest for rules/integration with a simulated Redmine service, plus a few Playwright browser flows.

The application should initially run on the user's computer. A single project is enough; the Node server can serve the built frontend and handle Redmine communication. Network access to the configured Redmine instance remains necessary.

## Development approach

Use lightweight Behavior-Driven Development: discuss concrete examples, document the expected behavior, automate the relevant example, and implement the smallest matching change. Gherkin-style examples do not require introducing Cucumber immediately.

Keep the first migration close to the original workflow. Fix verified defects deliberately and record behavior changes separately from mechanical porting. Avoid adding infrastructure or abstractions without a current need.

## Documentation

- [Development plan](docs/development-plan.md): scope, stages, acceptance criteria and open decisions.
- [Behavior specification](docs/behavior-specification.md): proposed examples and test priorities.
- [Legacy workflow](docs/legacy-workflow.md): sanitized description of the existing behavior and integration boundaries.
- [Contributing](CONTRIBUTING.md): collaboration, verification and commit practices.
- [Agent instructions](AGENTS.md): repository-specific operating rules.
- [Handoffs](docs/handoffs/): dated continuity records, when present.

## Private reference and configuration

The original spreadsheet is a local reference only and is excluded from Git, along with extracted VBA, credentials, local databases and raw responses. Public examples must use synthetic issues, projects and activity IDs.

Reading a private legacy workbook does not establish permission to redistribute its source. Review provenance before publishing implementation derived from it. The public repository should contain the new application and sanitized documentation, not the original workbook or extracted modules.

## License

Not selected yet. Choose a license before describing a published repository as licensed open source. MIT is a candidate, not an approved project decision.
