# Security and data boundaries

This is a personal local application and an isolated public demo, not a hosted multiuser Redmine service. The current release line is maintained on `master`; older tags are historical snapshots, without a separate security-support commitment.

## Local mode

- Keep `.env`, API keys, SQLite files and backups private. The backend reads credentials; the frontend must never receive them.
- The service binds locally and rejects non-local hosts and cross-origin writes. Do not expose it through a public proxy or remove these checks to host the demo.
- TLS verification is enabled by default. An optional explicit exception is limited to the configured HTTPS origin and visibly identified; it must never become a process-wide bypass.
- Submission uses review, explicit confirmation and protected receipts. Never remove receipts or automatically retry uncertain creation to recover from an error.

## Demo mode

The demo uses fictional browser data and no Redmine account. Its build skips `.env`, excludes server/HTTP/private modules and blocks operational network connections with CSP. Deployment uploads only the audited static artifact. Clearing site data removes demo history. Do not enter confidential work descriptions into a public portfolio demonstration.

## Reporting

Never include tokens, private hostnames, database files, real task descriptions or unredacted responses in a public issue. For a non-sensitive bug, provide a minimal fictional reproduction, version, mode and expected/observed behavior.

For a security issue, use GitHub's private **Report a vulnerability** option if it is available on this repository's Security tab. If no private channel is offered, open only a non-sensitive request for a private contact method; withhold exploit details and affected private data until a private channel is established. No response-time guarantee is implied.

If a key has been exposed, revoke/rotate it at its source; deleting a committed file does not remove the key from history or invalidate it. Keep generated artifacts and private material outside Git; the application does not provide a credential vault or a public backend.
