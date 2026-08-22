# Deployment Configuration

## Managed runtime

The project is designed for the managed autoscale web runtime. The build command is:

```bash
pnpm build
```

The build produces the Vite client under `dist/public` and bundles the Express entry point to `dist/index.js`. The application does not require a custom Dockerfile, a fixed port, or a persistent background process. The server obtains its port from the managed environment rather than hardcoding it.

## Required managed variables

The managed platform supplies the database connection, JWT signing, OAuth, and built-in service variables. Do not commit their values. The active runtime depends on the following categories:

| Category | Variables supplied by the managed environment |
|---|---|
| Data and auth | `DATABASE_URL`, `JWT_SECRET`, `OAUTH_SERVER_URL` |
| Owner bootstrap | `OWNER_OPEN_ID`, `OWNER_NAME` |
| Client application | `VITE_APP_ID`, `VITE_APP_TITLE`, `VITE_APP_LOGO`, `VITE_OAUTH_PORTAL_URL` |
| Managed service access | `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY`, and client-safe Forge variables |

If a new third-party integration requires a secret, add it through the managed secret workflow rather than source code or a checked-in `.env` file.

## Release checklist

| Step | Required outcome |
|---|---|
| Schema review | `drizzle/schema.ts` and the applied SQL migration agree |
| Type check | `pnpm check` exits successfully |
| Regression suite | `pnpm test` exits successfully |
| Production build | `pnpm build` exits successfully without a chunk-size warning |
| Runtime audit | Restart the development service and inspect recent logs for new errors |
| Checkpoint | Save a managed project checkpoint before publication |
| Publication | Use the platform Publish control after a checkpoint exists |

## Production considerations

The application is route-code-split and vendor-code-split to keep the initial client chunk below the build warning threshold. The database is the system of record for transactional data, while static or uploaded files should use managed object storage rather than project-local folders. The current product does not schedule background tasks or require always-on hosting.

Authenticated browser acceptance checks remain a release prerequisite whenever staff or member credentials are available. They cover staff login, checkout and receipts, manager inventory/transfers/reports, Admin staff changes, and member portal login/logout.
