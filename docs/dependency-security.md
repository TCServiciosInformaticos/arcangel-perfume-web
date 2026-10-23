# Dependency security maintenance

The October 2026 patch refreshes the Bun lockfile within the existing dependency ranges, updates Vite 8 and Sentry 10, and pins the MCP wrapper to 3.2.2. The wrapper still declares old MCP versions, so root overrides select SDK 1.32.0 and server 2.3.0. Keep these overrides until the wrapper declares patched versions itself.

The esbuild override selects 0.28.1 for both build tooling and its older transitive copies. The uuid override selects 11.1.1 (which retains CommonJS exports); ExcelJS uses its compatible `v4()` API. Excel workbook export/edit/import round-trip tests validate this usage. Do not move uuid to an ESM-only major without checking ExcelJS.

MCP routes are now application-owned, using the same SDK handlers and OAuth configuration. The route generator is removed because it refuses to preserve the guarded route. The checked-in OAuth metadata route remains available. The wrapper creates a new MCP server through a factory per request; tests exercise simultaneous clients under both supported protocol eras. POST input is streamed with a 64 KiB cap, then checked iteratively for at most 1000 object keys/array elements and depth 32 before reaching SDK validation. This also bounds inputs when Content-Length is absent. The wrapper does not expose SDK `maxToolInputElements`; the application enforces a stricter whole-request element bound instead.

Validation: `bun audit`, TypeScript, application tests, Node server build, and desktop/mobile browser checks. CI now runs `bun audit` on the locked graph. A clean audit only means no known advisories in the registry response at that time; it is not a full application security audit. Hostinger must deploy the new lockfile and rescan before its dashboard can reflect the change. A withdrawn esbuild advisory may persist in another scanner's database and should be reviewed separately rather than treated as proof that an old package remains deployed.

References:
- https://github.com/advisories/GHSA-46jr-4wx8-v453
- https://github.com/advisories/GHSA-jm63-cq47-j5jp
- https://github.com/advisories/GHSA-gv7w-rqvm-qjhr
