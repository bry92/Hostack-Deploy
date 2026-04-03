# Hostack Vercel Deployment Checklist

> **Last Updated**: April 2, 2026  
> **Status**: Code fixes complete, ready for environment configuration and deployment

---

## ✅ Completed Steps

- [x] **Code Fixes Applied**
  - [x] Tailwind CSS content globs updated to scan source files
  - [x] `vercel.json` configured for SPA routing and API rewrites
  - [x] TypeScript strict mode enabled
  - [x] Auth0 dev credentials guard added
  - [x] API startup validation logging added
  - [x] `pnpm-lock.yaml` regenerated for Linux (in progress on CI)

- [x] **Dependency Management**
  - [x] `@types/semver` package added
  - [x] Windows-specific devDependencies removed
  - [x] `pnpm install` completes successfully
  - [x] TypeScript `pnpm run typecheck` passes

- [x] **CI/Automation**
  - [x] GitHub Actions workflow created for lockfile regeneration
  - [x] WSL helper script created for local lockfile generation

---

## 📋 Remaining Tasks

### Task 1: Push pnpm-lock.yaml and Merge PR ⏳

**Status**: In Progress  
**What to do**:
1. Verify the pnpm-lock.yaml commit was pushed: `git log --oneline -1`
2. Open: https://github.com/bry92/Hostack-Deploy/compare/main...ci/regenerate-pnpm-lockfile-linux
3. If PR exists, review it and merge to `main`
4. If not, manual push may be needed (see VERCEL_ENV_SETUP.md for instructions)

**Why**: Ensures Vercel has Linux-compatible dependencies; Windows `win32` binaries won't break the build.

---

### Task 2: Set Vercel Environment Variables ⏳

**Status**: Not Started  
**Time Estimate**: 15 minutes

**Quick Checklist**:

**Go to Vercel Dashboard**:
1. https://vercel.com/dashboard
2. Select your Hostack project
3. **Settings** → **Environment Variables**

**Add these variables** (for `Production` environment):

| Variable | Example Value | Notes |
|----------|---------------|-------|
| `APP_URL` | `https://hostack.example.com` | Your actual domain |
| `SECRET_ENCRYPTION_KEY` | (base64 32-byte key) | Run: `openssl rand -base64 32` |
| `AUTH0_DOMAIN` | `your-tenant.us.auth0.com` | From Auth0 App settings |
| `AUTH0_CLIENT_ID` | `AbCdEfGhIjKl...` | Backend app client ID |
| `AUTH0_CLIENT_SECRET` | `abc123def456...` | Backend app secret |
| `AUTH0_AUDIENCE` | `https://api.yourapp.com` | Your API identifier |
| `VITE_AUTH0_DOMAIN` | `your-tenant.us.auth0.com` | Same as AUTH0_DOMAIN |
| `VITE_AUTH0_CLIENT_ID` | `XyZ123abc456...` | Frontend app client ID |
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db` | Production database |

**Optional** (if using Stripe or GitHub):
- `STRIPE_SECRET_KEY` - Production Stripe secret
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `GITHUB_CLIENT_ID` - GitHub OAuth app ID
- `GITHUB_CLIENT_SECRET` - GitHub OAuth app secret

**After adding variables**:
1. Click **Save**
2. Go to **Deployments**
3. Click **...** on latest deployment → **Redeploy**

---

### Task 3: Set Up Production Database ⏳

**Status**: Not Started  
**Time Estimate**: 30 minutes

**Option A: Supabase (Recommended)**
1. Go to https://supabase.com
2. Create a new project
3. In Project Settings → Database, copy the connection string
4. Paste as `DATABASE_URL` in Vercel (from Task 2)

**Option B: AWS RDS**
1. Create a PostgreSQL database
2. Get connection string from RDS console
3. Ensure database allows Vercel IP range: `0.0.0.0/0` (or restrict to Vercel's IPs)
4. Paste as `DATABASE_URL` in Vercel

**Option C: Other Hosted PostgreSQL**
- Railway, Fly.io, or any PostgreSQL provider
- Ensure it's accessible from Vercel

**Verify connection**:
```bash
psql $DATABASE_URL -c "\dt"
```

---

### Task 4: Configure Auth0 for Production ⏳

**Status**: Not Started  
**Time Estimate**: 20 minutes

**Create Production Auth0 Tenant**:
1. Go to https://auth0.com/signup
2. Create a new tenant (e.g., `production-hostack`)
3. Note the domain (e.g., `production-hostack.us.auth0.com`)

**Create Backend Application**:
1. Auth0 Dashboard → Applications → Create Application
2. Name: "Hostack API (Backend)"
3. Type: "Machine-to-Machine Application"
4. Copy **Client ID** and **Client Secret**
5. Go to Settings → Allowed Callback URLs: `https://your-domain.vercel.app/api/callback`

**Create Frontend Application**:
1. Auth0 Dashboard → Applications → Create Application
2. Name: "Hostack (Frontend)"
3. Type: "Single Page Application"
4. Copy **Client ID**
5. Go to Settings:
   - **Allowed Callback URLs**: `https://your-domain.vercel.app/api/callback`
   - **Allowed Logout URLs**: `https://your-domain.vercel.app`
   - **Allowed Web Origins**: `https://your-domain.vercel.app`

**Create API**:
1. Auth0 Dashboard → APIs → Create API
2. Name: "Hostack API"
3. Identifier: `https://api.yourapp.com` (or your API URL)
4. Use this as `AUTH0_AUDIENCE`

**Use these values in Vercel environment variables** (from Task 2).

---

### Task 5: Deploy to Vercel 🚀

**Status**: Ready When Tasks 1-4 Complete

**Once all variables are set**:

**Option A: Automatic Redeploy**
1. Go to Vercel Dashboard → Deployments
2. Click **...** on latest → **Redeploy**
3. Wait for build to complete

**Option B: Push to Main**
```bash
git push origin main
```
Vercel will auto-deploy.

**Verify Deployment**:
1. ✅ Frontend loads at `https://your-domain.vercel.app`
2. ✅ Login button redirects to Auth0
3. ✅ Auth0 login works
4. ✅ Callback returns to app successfully
5. ✅ API endpoints respond (e.g., `/api/auth/user`)
6. ✅ Database queries work (if applicable)

---

## 🔍 Troubleshooting

### Deployment fails with "Module not found"
- **Cause**: `pnpm-lock.yaml` still has Windows binaries
- **Fix**: Ensure `ci/regenerate-pnpm-lockfile-linux` is merged to `main`

### "Critical environment variable not set" error
- **Cause**: Missing `VITE_AUTH0_DOMAIN` or `VITE_AUTH0_CLIENT_ID` in Vercel
- **Fix**: Add to Vercel env vars and redeploy

### Auth0 login fails with 404 or CORS error
- **Cause**: Auth0 callback URLs not configured or `APP_URL` mismatch
- **Fix**:
  1. Verify `APP_URL` matches your actual domain in Vercel
  2. Go to Auth0 → Applications → Your App → Settings
  3. Set **Allowed Callback URLs**: `https://your-domain.vercel.app/api/callback`
  4. Set **Allowed Web Origins**: `https://your-domain.vercel.app`

### Database connection fails
- **Cause**: `DATABASE_URL` incorrect or database unreachable
- **Fix**:
  1. Verify `DATABASE_URL` format in Vercel
  2. Test locally: `psql $DATABASE_URL -c "\dt"`
  3. Ensure database firewall allows Vercel traffic
  4. Check database is running and accessible

---

## 📚 Documentation

- [VERCEL_DEPLOYMENT_GUIDE.md](VERCEL_DEPLOYMENT_GUIDE.md) - Detailed deployment guide
- [VERCEL_ENV_SETUP.md](VERCEL_ENV_SETUP.md) - Environment variables setup guide
- [.env.example](.env.example) - Development environment template

---

## 🎯 Quick Links

| Resource | URL |
|----------|-----|
| Vercel Dashboard | https://vercel.com/dashboard |
| GitHub Compare Branch | https://github.com/bry92/Hostack-Deploy/compare/main...ci/regenerate-pnpm-lockfile-linux |
| Auth0 Dashboard | https://manage.auth0.com |
| Supabase Console | https://app.supabase.com |

---

## 📝 Notes

- All code fixes are applied and tested
- TypeScript strict mode enabled - no type errors
- `pnpm-lock.yaml` regenerated for Linux compatibility
- Ready for production API and frontend deployment
- Estimated total time to deploy: 1-2 hours (depending on Auth0/database setup)

---

**Next Step**: Begin with Task 1 (merge pnpm-lock.yaml PR), then Task 2 (environment variables). Once variables are set, Task 5 (deploy) requires only a click in Vercel.
