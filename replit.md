# Hostack

## Overview

Hostack is a Netlify-style developer hosting and deployment platform. Users can create projects, trigger deployments, manage environment variables, view simulated deployment logs, monitor runtime logs, and track performance metrics from a dashboard.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (`artifacts/hostack`)
- **API framework**: Express 5 (`artifacts/api-server`)
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: OIDC with explicit provider-neutral environment configuration
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)

## Structure

```text
artifacts-monorepo/
|-- artifacts/
|   |-- api-server/         # Express API server
|   |   `-- src/
|   |       |-- lib/auth.ts
|   |       |-- middlewares/authMiddleware.ts
|   |       |-- routes/
|   |       `-- services/
|   `-- hostack/            # React + Vite frontend
|       `-- src/
|           |-- pages/
|           `-- components/
|-- lib/
|   |-- api-spec/           # OpenAPI spec + Orval config
|   |-- api-client-react/   # Generated React Query hooks
|   |-- api-zod/            # Generated Zod schemas
|   |-- auth-web/           # Shared browser auth package
|   `-- db/                 # Shared DB schema and access layer
```

## Database Schema

- **users**: Auth user profiles synced from the configured OIDC provider
- **sessions**: Session storage for auth
- **projects**: User projects with framework, repo URL, status
- **deployments**: Deployment records
- **deployment_logs**: Step-by-step build logs per deployment
- **environment_variables**: Project env vars
- **integrations**: Account-level third-party service connections
- **project_integrations**: Links between projects and account integrations
- **runtime_logs**: Application runtime log entries
- **deployment_metrics**: Time-series performance metrics
- **ssh_keys**: Project SSH deploy key pairs
- **custom_domains**: Custom domain attachments per project

## Key Features

- **Auth**: OIDC with session cookies and PKCE
- **Projects CRUD**: Create, view, update, delete projects
- **Deployment simulation**: Multi-step build log simulation with random failure
- **Deployment rollbacks**: Roll back to previous successful deployments
- **Live log streaming**: SSE-based log tail during deployment
- **Env variables**: Add and delete environment variables with masked values
- **Dashboard stats**: Total projects, deployments, latest status
- **Protected routes**: All dashboard routes require authentication
- **Integrations**: GitHub, Cloudflare, Slack, Sentry, Supabase, S3/R2, Discord, PostHog
- **Runtime logs**: Per-project ingestion, search/filter, SSE live tail, simulate, clear
- **Metrics**: Requests/min, error rate, latency, sessions, uptime, cold starts, bandwidth
- **AI Deploy Copilot**: Per-project AI chat assistant
- **SSH deploy keys**: Per-project ED25519 key generation and management
- **Custom domains**: Add, verify, and remove custom domains

## Environment

Required auth environment variables:

- `OIDC_ISSUER_URL`
- `OIDC_CLIENT_ID`

Optional auth environment variables:

- `OIDC_CLIENT_SECRET`
- `OIDC_CLIENT_AUTH_METHOD` (`client_secret_basic` by default, or `client_secret_post`)
- `OIDC_SCOPE` (defaults to `openid profile email offline_access`)
- `OIDC_AUDIENCE`
- `OIDC_PROMPT`

Auth0-compatible aliases are also supported:

- `AUTH0_DOMAIN`
- `AUTH0_CLIENT_ID`
- `AUTH0_CLIENT_SECRET`
- `AUTH0_SCOPE`
- `AUTH0_AUDIENCE`
- `AUTH0_PROMPT`

Exact auth URLs this app expects:

- Callback URL: `<APP_URL>/api/callback`
- Logout return URL: `<APP_URL>`
- Web origin: `<APP_URL>`
- Allowed CORS origins: `CORS_ALLOWED_ORIGINS` comma-separated, defaults to `APP_URL`

Localhost example when `APP_URL=http://localhost:3000`:

- Callback URL: `http://localhost:3000/api/callback`
- Logout return URL: `http://localhost:3000`
- Web origin: `http://localhost:3000`

Optional secrets hardening:

- `SECRET_ENCRYPTION_KEY`: 32-byte key encoded as base64 or 64 hex characters

When configured, new GitHub tokens, integration secret metadata, and generated SSH private keys are encrypted at rest. Existing plaintext rows remain readable for backward compatibility.

## Development

```bash
# Push DB schema
pnpm --filter @workspace/db run push

# Start local dev with one public origin for frontend + /api auth
pnpm run dev

# Smoke-check the running stack
pnpm run smoke
```

## Architecture Notes

- Frontend uses generated React Query hooks from the OpenAPI spec
- Auth uses `@workspace/auth-web` for authentication state and login/logout redirects
- Deployment simulation runs async in the Express server
- Data access enforces ownership checks by user
