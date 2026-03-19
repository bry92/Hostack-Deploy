# Hostack

Hostack is a PNPM workspace for a deployment platform UI, its API server, shared typed API clients, and the database package that backs the app.

The repo is organized as a monorepo so the frontend, backend, database schema, and generated API contracts stay in sync.

## What is in this repo

- `artifacts/hostack`: React 19 + Vite frontend for the Hostack app
- `artifacts/api-server`: Express 5 API server
- `artifacts/mockup-sandbox`: additional artifact app in the workspace
- `lib/api-spec`: OpenAPI source and Orval codegen config
- `lib/api-client-react`: generated React Query client and API schemas
- `lib/api-zod`: generated Zod validators and shared API types
- `lib/auth-web`: frontend auth provider/hooks built on the generated client
- `lib/db`: Drizzle database package and schema exports
- `scripts`: local development proxy and smoke checks
- `examples`: fixture repos used for deployment/runtime testing

## Product surface

The frontend includes pages for:

- dashboard
- projects and project detail
- deployments and deployment detail
- integrations
- logs
- metrics
- settings
- auth callback handling

The API exposes routes for:

- health
- auth
- projects
- deployments
- environment variables
- dashboard data
- profile
- GitHub
- integrations
- observability
- SSH keys
- custom domains
- copilot
- notifications
- build rules

## Requirements

- Node.js with `corepack`
- `corepack` enabled so the pinned PNPM version is used
- PostgreSQL
- Auth0 or another OIDC provider
- optional OpenAI-compatible API key for AI integrations

## Quick start

1. Enable Corepack if you have not already:

   ```bash
   corepack enable
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Create a local env file from the example:

   ```bash
   cp .env.example .env
   ```

   On PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

4. Fill in at least:

   - `DATABASE_URL`
   - `SECRET_ENCRYPTION_KEY`
   - `AUTH0_DOMAIN`
   - `AUTH0_CLIENT_ID`
   - `AUTH0_CLIENT_SECRET`

5. Start the full local stack:

   ```bash
   pnpm dev
   ```

6. Open `http://localhost:3000`.

## Important auth and origin note

This app expects the frontend and `/api` auth routes to share the same public origin.

For local development, `pnpm dev` starts:

- a public proxy on `APP_PORT` (default `3000`)
- the API on `API_PORT` (default `3001`)
- the Vite frontend on `FRONTEND_PORT` (default `5173`)

The proxy keeps auth redirects and API calls on the same origin, which is required for the current auth flow.

If you run the frontend separately with `pnpm dev:frontend`, you will usually still need a reverse proxy in front of the frontend and API so they appear under one public origin.

## Environment variables

The main variables are documented in [.env.example](./.env.example).

Common ones:

- `APP_URL`: public origin used in auth callbacks and generated links
- `APP_PORT`: public proxy port used by `pnpm dev`
- `API_PORT`: internal API port used by `pnpm dev`
- `FRONTEND_PORT`: internal Vite port used by `pnpm dev`
- `PORT`: API port when running the API directly
- `DATABASE_URL`: PostgreSQL connection string
- `SECRET_ENCRYPTION_KEY`: 32-byte secret, encoded as base64 or 64 hex chars
- `BASE_PATH`: frontend base path
- `CORS_ALLOWED_ORIGINS`: allowed browser origins for the API
- `AI_INTEGRATIONS_OPENAI_API_KEY`: optional OpenAI-compatible API key

## Workspace commands

From the repo root:

```bash
pnpm dev
pnpm dev:frontend
pnpm dev:api
pnpm build
pnpm lint
pnpm typecheck
pnpm smoke
```

What they do:

- `pnpm dev`: starts the public proxy plus frontend and API together
- `pnpm dev:frontend`: runs the Vite app directly
- `pnpm dev:api`: runs the API directly
- `pnpm build`: typechecks then builds all packages with build scripts
- `pnpm lint`: runs package-level ESLint where available
- `pnpm typecheck`: builds TypeScript project references and app-level typechecks
- `pnpm smoke`: probes the frontend shell and `/api/auth/user`

## API codegen

The OpenAPI source lives in [`lib/api-spec/openapi.yaml`](./lib/api-spec/openapi.yaml).

Orval generates:

- React Query client code into [`lib/api-client-react/src/generated`](./lib/api-client-react/src/generated)
- Zod validators and API types into [`lib/api-zod/src/generated`](./lib/api-zod/src/generated)

Regenerate both with:

```bash
pnpm --filter @workspace/api-spec codegen
```

## Database

The database package uses Drizzle with PostgreSQL.

Useful commands:

```bash
pnpm --filter @workspace/db push
pnpm --filter @workspace/db push-force
```

Schema config lives in [`lib/db/drizzle.config.ts`](./lib/db/drizzle.config.ts), and the package exports both the `db` instance and schema types.

## Build outputs

- frontend build output: [`artifacts/hostack/dist/public`](./artifacts/hostack/dist/public)
- API bundle output: [`artifacts/api-server/dist/index.cjs`](./artifacts/api-server/dist/index.cjs)

## Examples

The fixture repos under [`examples`](./examples) are used to validate runtime and deployment behavior.

- [`examples/static-test-repo`](./examples/static-test-repo): should serve `STATIC TEST OK`
- [`examples/node-test-repo`](./examples/node-test-repo): should serve `NODE TEST OK`

See [`examples/README.md`](./examples/README.md) for the expected build/install behavior.

## Suggested reading order

If you are new to the repo, start with:

1. [`package.json`](./package.json)
2. [`pnpm-workspace.yaml`](./pnpm-workspace.yaml)
3. [`.env.example`](./.env.example)
4. [`scripts/src/dev.ts`](./scripts/src/dev.ts)
5. [`artifacts/hostack/src/App.tsx`](./artifacts/hostack/src/App.tsx)
6. [`artifacts/api-server/src/app.ts`](./artifacts/api-server/src/app.ts)
7. [`artifacts/api-server/src/routes/index.ts`](./artifacts/api-server/src/routes/index.ts)
8. [`lib/api-spec/orval.config.ts`](./lib/api-spec/orval.config.ts)
9. [`lib/db/drizzle.config.ts`](./lib/db/drizzle.config.ts)

## License

MIT
