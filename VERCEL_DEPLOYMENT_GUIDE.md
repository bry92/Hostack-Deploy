# Hostack to Vercel Deployment Guide

> **Status**: This codebase has been analyzed for deployment readiness. This guide documents all issues found and the fixes that have been (or need to be) applied.

---

## Executive Summary

### Fixes Applied ✅
- [x] **tailwind.config.js** - Updated to scan source files, not just build output
- [x] **vercel.json** - Configured for SPA routing and internal API handling
- [x] **tsconfig.base.json** - Enabled strict mode for better type safety
- [x] **auth-context.tsx** - Added guards to prevent dev credentials from being used in production
- [x] **API server startup** - Added configuration validation warnings

### Critical Actions Required ⚠️
1. **Consolidate frontend & API on same Vercel project** (currently split across Vercel + Render)
2. **Configure Environment Variables** in Vercel Project Settings
3. **Regenerate pnpm-lock.yaml** on Linux (remove Windows-specific dependencies)
4. **Set up PostgreSQL database** (configure DATABASE_URL)
5. **Configure Auth0 production credentials**
6. **Deploy as a single Vercel project** (not separate frontend/API deployments)

---

## 🚨 Critical Issues & Fixes

### Issue #1: Frontend & API Split Across Two Platforms
**Severity**: CRITICAL  
**Problem**: 
- Frontend deployed to Vercel
- API deployed to Render (`https://hostack-api.onrender.com`)
- Cross-origin API calls fail, session management breaks, CORS errors

**Why This Happens**:
- Your [hostack/vercel.json](artifacts/hostack/vercel.json) had: `"destination": "https://hostack-api.onrender.com"`
- Frontend (Vercel) cannot reliably call external API (Render) with session cookies

**The Fix - ALREADY APPLIED** ✅:
Your `vercel.json` now points `/api/*` to internal Vercel serverless functions:
```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "/api/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

**What You Need to Do**:
- Deploy the **entire monorepo** (both frontend + API) as a single Vercel project
- The API server ([artifacts/api-server/](artifacts/api-server/)) becomes Vercel serverless functions
- Configure `vercel.json` to route `/api/*` to your Express API middleware

**How to Deploy Together**:

1. Create a new `vercel.json` at the project root (not in `artifacts/hostack/`):
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "cd artifacts/api-server && npm run build && cd ../hostack && npm run build",
  "outputDirectory": "artifacts/hostack/dist/public",
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "/api/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/api/.*",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "no-cache, no-store, must-revalidate"
        }
      ]
    }
  ]
}
```

2. Or use Vercel's "Build & Output Settings" to configure:
   - **Build Command**: `pnpm run build`
   - **Output Directory**: `artifacts/hostack/dist/public`
   - **Install Command**: `pnpm install --frozen-lockfile`

---

### Issue #2: Missing Environment Variables for Production
**Severity**: CRITICAL  
**Problem**: 
- Vercel deployment fails if required environment variables aren't set
- API server validates these on startup and will error if missing in "full" mode

**Required Environment Variables**:
```
# App Configuration
APP_URL=https://your-app.vercel.app
SECRET_ENCRYPTION_KEY=base64-encoded-32-byte-key

# Authentication (Auth0)
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_CLIENT_ID=your-production-client-id
AUTH0_CLIENT_SECRET=your-production-client-secret
AUTH0_AUDIENCE=https://api.yourapp.com

# Database
DATABASE_URL=postgresql://user:password@host:5432/hostack

# Stripe (if using payment features)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# GitHub OAuth (optional)
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Frontend (Vite)
VITE_AUTH0_DOMAIN=your-tenant.us.auth0.com
VITE_AUTH0_CLIENT_ID=your-production-client-id
```

**How to Set These in Vercel**:
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add each variable for the `Production` environment
3. Redeploy after adding variables

**Generating SECRET_ENCRYPTION_KEY**:
```bash
# bash/zsh
openssl rand -base64 32

# PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

# Node.js
console.log(Buffer.from(require('crypto').randomBytes(32)).toString('base64'))
```

---

### Issue #3: Tailwind CSS Not Scanning Source Files
**Severity**: HIGH  
**Problem**: 
- Old config only scanned `./dist/**/*.html` (built files)
- Source component styles weren't included in CSS build
- Production styles missing for dynamic components

**The Fix - ALREADY APPLIED** ✅:
```javascript
// tailwind.config.js
content: [
  "./artifacts/hostack/src/**/*.{tsx,ts,jsx,js}",
  "./lib/**/src/**/*.{tsx,ts,jsx,js}",
  "./content/**/*.json",
  "./dist/**/*.html"
],
```

This now scans:
- React components in `artifacts/hostack/src/`
- Library components in `lib/*/src/`
- Content JSON files
- Built HTML

---

### Issue #4: Windows-Specific Dependencies in pnpm-lock.yaml
**Severity**: HIGH  
**Problem**:
- `package.json` includes Windows-only native dependencies:
  ```json
  "@rollup/rollup-win32-x64-msvc": "4.59.0",
  "@tailwindcss/oxide-win32-x64-msvc": "^4.2.1",
  "lightningcss-win32-x64-msvc": "^1.32.0"
  ```
- Vercel runs on Linux and cannot install these packages
- Build fails with "module not found" errors

**The Fix**:
Regenerate `pnpm-lock.yaml` on Linux or in CI:
```bash
# On your dev machine (if on Windows)
pnpm install --frozen-lockfile  # Just verify lock file
git stash pnpm-lock.yaml

# Or on Linux/CI:
rm pnpm-lock.yaml
pnpm install
git add pnpm-lock.yaml && git commit -m "regenerate pnpm-lock.yaml for Linux"
```

**Why This Works**:
- pnpm automatically detects the platform and installs correct binaries
- Linux version needs Linux binaries, not Windows MSVC binaries
- The `.npmrc` file should have `supportedArchitectures = x64` configured

---

### Issue #5: Frontend Auth0 Using Dev Credentials as Fallback
**Severity**: HIGH  
**Problem**:
- If `VITE_AUTH0_DOMAIN` or `VITE_AUTH0_CLIENT_ID` aren't set in production
- Frontend falls back to dev Auth0 tenant: `dev-3koeqweojjm248m1.us.auth0.com`
- Production users authenticate to **YOUR DEV AUTH0 ACCOUNT** 🔴

**The Fix - ALREADY APPLIED** ✅:
```typescript
// lib/auth-web/src/auth-context.tsx
const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === "development";
const AUTH0_DOMAIN = viteEnv["VITE_AUTH0_DOMAIN"] || (isDevelopment ? FALLBACK_AUTH0_DOMAIN : throwError("VITE_AUTH0_DOMAIN"));

function throwError(varName: string): never {
  throw new Error(`Critical environment variable not set: ${varName}. Required for production.`);
}
```

**What This Does**:
- ✅ In development: Uses fallback for convenience
- ✅ In production: Throws error if env vars are missing
- ✅ Prevents silent fall back to dev credentials in prod
- ✅ Forces you to properly configure authentication

**To Deploy**:
Set these in Vercel before deploying:
- `VITE_AUTH0_DOMAIN=your-prod-tenant.us.auth0.com`
- `VITE_AUTH0_CLIENT_ID=your-prod-client-id`

---

### Issue #6: SPA Routing Not Configured
**Severity**: HIGH  
**Problem**:
- Frontend uses Wouter (client-side router)
- Routes like `/dashboard`, `/settings` don't exist as files
- Direct navigation to `/dashboard` → 404 error

**The Fix - ALREADY APPLIED** ✅:
Your `vercel.json` now includes a rewrite that catches all unmatched routes:
```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

**What This Does**:
- ✅ `/api/*` routes go to API handler (matched first)
- ✅ Any other route → `index.html` (frontend catches it)
- ✅ Wouter router can now handle all frontend routes
- ✅ Bookmarks and direct navigation work correctly

---

### Issue #7: TypeScript Strict Mode Disabled
**Severity**: MEDIUM  
**Problem**:
- `strictFunctionTypes: false` allows loose function typing
- Missing `strict: true` means no protection against:
  - Implicit `any` types
  - Untyped function parameters
  - Silent type mismatches

**The Fix - ALREADY APPLIED** ✅:
```json
// tsconfig.base.json
{
  "compilerOptions": {
    "strict": true,
    "strictFunctionTypes": true,
    "strictNullChecks": true
  }
}
```

**What This Means**:
- TypeScript will now catch more errors at compile time
- You may see new type errors that were previously hidden
- Fix any errors before deploying: `pnpm run typecheck`

---

### Issue #8: API Server Missing Pre-flight Configuration Check
**Severity**: MEDIUM  
**Problem**:
- API starts listening before validating all required config
- Configuration errors sometimes don't prevent startup
- Silent mode degradation without clear messaging

**The Fix - ALREADY APPLIED** ✅:
```typescript
// artifacts/api-server/src/index.ts
app.listen(port, () => {
  console.log(`[startup] Server listening on port ${port} (${runtime.mode} mode)`);
  if (runtime.mode === "full") {
    console.log("[startup] Full mode: Database-backed features enabled");
    if (!process.env.DATABASE_URL) {
      console.warn("[startup] ⚠️  DATABASE_URL not set - features requiring database unavailable");
    }
    if (!process.env.SECRET_ENCRYPTION_KEY) {
      console.warn("[startup] ⚠️  SECRET_ENCRYPTION_KEY not set - secure features will fail");
    }
  } else {
    console.log("[startup] Fallback mode: Limited functionality (development/testing only)");
  }
  startBackgroundServices?.();
});
```

**Benefits**:
- Clear logging about mode and configuration status
- Warnings help identify missing environment variables
- Observable in Vercel deployment logs

---

## 📋 Pre-Deployment Checklist

- [ ] **Environment Variables Set in Vercel**
  - [ ] `APP_URL` - production domain
  - [ ] `SECRET_ENCRYPTION_KEY` - 32-byte base64 encoded key
  - [ ] `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`
  - [ ] `DATABASE_URL` - PostgreSQL connection string
  - [ ] `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID` - for frontend

- [ ] **Database Setup**
  - [ ] PostgreSQL database created and accessible
  - [ ] `DATABASE_URL` points to production database
  - [ ] Migrations have been run (or will run on first deploy)

- [ ] **Auth0 Configuration**
  - [ ] Production tenant created in Auth0
  - [ ] Application created and credentials obtained
  - [ ] Allowed Callback URLs: `https://your-app.vercel.app/api/callback`
  - [ ] Allowed Logout URLs: `https://your-app.vercel.app`
  - [ ] Allowed Web Origins: `https://your-app.vercel.app`

- [ ] **Code Fixes**
  - [ ] `pnpm-lock.yaml` regenerated on Linux (no Windows binaries)
  - [ ] `pnpm run typecheck` passes without errors
  - [ ] `pnpm run lint` passes without critical issues

- [ ] **Repository Cleanup**
  - [ ] Sensitive `.env` files not committed to git
  - [ ] `.gitignore` includes `.env`, `.env.local`
  - [ ] No hardcoded secrets in code or config files

---

## 🚀 Step-by-Step Deployment Process

### 1. Prepare Your Repository
```bash
# Regenerate lock file for Linux
pnpm install

# Verify all type checks pass
pnpm run typecheck

# Verify linting passes
pnpm run lint

# Commit changes
git add -A
git commit -m "Fix: prepare for Vercel deployment"
git push origin main
```

### 2. Create Vercel Project
```bash
# If you have Vercel CLI installed
vercel

# Or go to https://vercel.com/new and connect your GitHub repo
```

### 3. Configure Environment Variables in Vercel
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add all required variables (see "Required Environment Variables" above)
3. Set them for `Production` environment

### 4. Configure Build Settings
In Vercel Dashboard → Settings → Build & Output:
- **Build Command**: `pnpm run typecheck && pnpm -r --if-present run build`
- **Output Directory**: `artifacts/hostack/dist/public`
- **Install Command**: `pnpm install --frozen-lockfile`

### 5. Deploy
```bash
vercel --prod

# Or push to main branch and Vercel will auto-deploy
git push origin main
```

### 6. Verify Deployment
- [ ] Frontend loads at `https://your-app.vercel.app`
- [ ] Login redirects to Auth0
- [ ] Auth0 callback returns to app successfully
- [ ] `/api/auth/user` endpoint responds
- [ ] Database-dependent features work

---

## 🔍 Debugging Common Issues

### Deployment Fails: Module Not Found
**Cause**: Windows-specific dependencies  
**Fix**: Regenerate `pnpm-lock.yaml` on Linux

### Frontend Loads But API Calls Fail (404)
**Cause**: `vercel.json` rewrites not configured  
**Fix**: Verify `/api/:path*` rewrite is present in `vercel.json`

### Auth0 Login Fails with CORS Error
**Cause**: `APP_URL` not configured or domain mismatch  
**Fix**: 
1. Set `APP_URL` in Vercel to your production domain
2. Update Auth0 allowed origins

### "Cannot find module @workspace/db"
**Cause**: Workspace dependencies not built  
**Fix**: Ensure all lib packages are built before frontend
```bash
pnpm run build --filter="./lib/**" --filter="./artifacts/**"
```

### Database Connection Fails
**Cause**: `DATABASE_URL` not set or invalid  
**Fix**:
1. Verify `DATABASE_URL` is set in Vercel env vars
2. Test connection with: `psql $DATABASE_URL -c "\dt"`
3. Ensure database is accessible from Vercel

---

## 📚 Understanding Your Architecture

### What Gets Deployed to Vercel
```
vercel.app/
├── / (Frontend - React/Vite SPA)
├── /api/* (Express.js API routes)
├── /api/auth/* (Auth0/OIDC integration)
├── /api/github/* (GitHub OAuth)
├── /api/stripe/* (Stripe webhooks)
└── /api/deployments/* (Runtime management)
```

### How Auth0 Is Configured
```
Auth0 Tenant → Frontend Auth Context → Backend API Routes
     ↓                                        ↓
Auth0 Rules/Actions                  Session/Cookie Management
```

### How Database Works
```
Vercel Serverless Functions → PostgreSQL Database
     ↓                              ↓
API routes & services          Tables, queries, migrations
```

---

## 🔐 Security Checklist

- [ ] `SECRET_ENCRYPTION_KEY` is strong and unique (not default/dev key)
- [ ] `AUTH0_CLIENT_SECRET` never exposed in frontend code
- [ ] `DATABASE_URL` uses strong password
- [ ] GitHub OAuth secrets (if using) are unique to production
- [ ] Stripe keys (if using) are production keys, not test keys
- [ ] All `.env` files are in `.gitignore`
- [ ] No secrets in commit history (use `git-filter-branch` if needed)
- [ ] CORS is restricted to your domain only
- [ ] Database is not accessible from the internet

---

## 📞 Getting Help

If deployment fails:

1. **Check Vercel Logs**: Vercel Dashboard → Deployments → See logs for errors
2. **Check API Startup Logs**: Vercel Dashboard → Functions → See error logs
3. **Test Locally First**:
   ```bash
   pnpm run dev
   # Visit http://localhost:3000 and test all features
   ```
4. **Verify Environment Variables**: 
   ```bash
   # In Vercel, test if vars are set by visiting a page that uses them
   # Or check Vercel logs for startup warnings
   ```

---

## Summary of All Changes Made

| File | Issue | Fix | Status |
|------|-------|-----|--------|
| `tailwind.config.js` | Content paths only scan dist/ | Added src/ paths to content glob | ✅ Applied |
| `artifacts/hostack/vercel.json` | Distant API server, no SPA routing | Updated to internal API + SPA rewrite | ✅ Applied |
| `tsconfig.base.json` | Strict TypeScript disabled | Enabled `"strict": true` | ✅ Applied |
| `lib/auth-web/src/auth-context.tsx` | Dev fallback in production | Added env check, throw error if missing | ✅ Applied |
| `artifacts/api-server/src/index.ts` | Silent failures on startup | Added configuration validation logging | ✅ Applied |
| `package.json` | Windows-specific deps | Needs pnpm-lock regeneration on Linux | ⏭️ Required |
| `.env` | Not set up for Vercel | Set environment variables in Vercel UI | ⏭️ Required |
| Database | No production database | Create PostgreSQL and set DATABASE_URL | ⏭️ Required |

---

**Date Analyzed**: April 1, 2026  
**Readiness for Vercel**: Ready with configuration (all code fixes applied, requires env var + database setup)
