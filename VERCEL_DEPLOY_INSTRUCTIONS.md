# Vercel Deployment Instructions

> **Status**: Ready to deploy. All code fixes applied, pnpm-lock.yaml regenerated for Linux, all changes pushed to `main` branch.

---

## Quick Start Deployment (5 minutes)

### Step 1: Create Vercel Project

**Option A: Using Vercel Dashboard (Recommended)**
1. Go to https://vercel.com/new
2. Select "Import Git Repository"
3. Search for and select `bry92/Hostack-Deploy`
4. Click "Import"
5. Leave all settings default (Vercel will auto-detect pnpm)
6. Click "Deploy"

**Option B: Using Vercel CLI**
```powershell
npm install -g vercel
cd C:\Users\pageb\Documents\GitHub\Hostack-Deploy
vercel --prod
# Follow prompts to connect and deploy
```

### Step 2: Configure Environment Variables

After creating the project, set these in **Vercel Dashboard → Settings → Environment Variables**:

#### Required Production Environment Variables

```
# App & Security
APP_URL=https://[your-app-name].vercel.app
SECRET_ENCRYPTION_KEY=[Generate with: node -e "console.log(Buffer.from(require('crypto').randomBytes(32)).toString('base64'))"]

# Authentication (Auth0)
AUTH0_DOMAIN=your-production-tenant.us.auth0.com
AUTH0_CLIENT_ID=your-prod-client-id
AUTH0_CLIENT_SECRET=your-prod-client-secret
AUTH0_AUDIENCE=https://api.yourapp.com
VITE_AUTH0_DOMAIN=your-production-tenant.us.auth0.com
VITE_AUTH0_CLIENT_ID=your-prod-client-id

# Database
DATABASE_URL=postgresql://user:password@host:5432/hostack_prod

# Payments (if using Stripe)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# GitHub OAuth (if using)
GITHUB_CLIENT_ID=your-prod-github-client-id
GITHUB_CLIENT_SECRET=your-prod-github-client-secret
```

**Add each variable:**
1. Name: (e.g., `APP_URL`)
2. Value: (e.g., `https://hostack.vercel.app`)
3. Environment: Select `Production`
4. Click "Save"

### Step 3: Generate SECRET_ENCRYPTION_KEY

Choose one method based on your environment:

**Node.js (recommended):**
```bash
node -e "console.log(Buffer.from(require('crypto').randomBytes(32)).toString('base64'))"
```

**PowerShell:**
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

**Bash/WSL:**
```bash
openssl rand -base64 32
```

### Step 4: Set Up Auth0 Production Configuration

In your Auth0 Dashboard:

1. **Create Production Application:**
   - Go to Applications → Create Application
   - Name: "Hostack Production"
   - Type: "Single Page Application"
   - Click "Create"

2. **Update Application Settings:**
   - Copy `Domain` and `Client ID` into Vercel env vars
   - In Settings tab:
     - **Allowed Callback URLs**: `https://[your-app].vercel.app/api/callback`
     - **Allowed Logout URLs**: `https://[your-app].vercel.app`
     - **Allowed Web Origins**: `https://[your-app].vercel.app`
     - Save

3. **Create API (if needed):**
   - Go to Applications → APIs
   - Create API: "Hostack Production"
   - Identifier: `https://api.yourapp.com`
   - Copy this value to `AUTH0_AUDIENCE`

### Step 5: Set Up Production PostgreSQL Database

**Option A: Using Supabase (Recommended)**
```bash
# Create project at https://supabase.com/new
# Copy connection string (Database URL)
# Format: postgresql://user:password@db.supabase.co:5432/postgres
```

**Option B: Using AWS RDS, Google Cloud SQL, or your own server**
- Create PostgreSQL instance in your hosting provider
- Get connection string in format: `postgresql://user:password@host:port/database`
- Ensure Vercel has network access to database

**Option C: Using Vercel Data (if available)**
- Use Vercel's integrated database storage

Once database is set up, add `DATABASE_URL` to Vercel environment variables.

### Step 6: Trigger Deployment

**In Vercel Dashboard:**
1. Go to your project
2. Open "Deployments" tab
3. Click "Redeploy" on the latest production deployment
4. Or push changes to `main` branch (auto-deploys if enabled)

**Using Vercel CLI:**
```bash
vercel --prod
```

### Step 7: Verify Deployment

Visit `https://[your-app-name].vercel.app` and test:

- [ ] Frontend loads without errors
- [ ] Navigation works (click around)
- [ ] Login button redirects to Auth0
- [ ] Auth0 login succeeds
- [ ] API call to `/api/user` works
- [ ] Can create/edit/delete projects (if using db)

---

## Detailed Vercel Configuration

### Build Settings

Vercel should auto-detect these, but verify in **Settings → Build & Output**:

- **Framework**: Vite
- **Build Command**: `pnpm run typecheck && pnpm -r --if-present run build`
- **Output Directory**: `artifacts/hostack/dist/public`
- **Install Command**: `pnpm install --frozen-lockfile`
- **Node Version**: 20.x or later

### Edge Function Configuration

If you have Edge Functions (optional):
- Create `api/` directory with serverless functions
- Vercel will auto-detect and deploy them
- Current setup uses Express API as serverless functions in `/api/`

### Headers & Redirects

Already configured in [vercel.json](vercel.json):
- **SPA Fallback**: All unmatched routes → `index.html`
- **API Rewrites**: `/api/*` → Express handlers
- **CORS & Caching**: Configured for API routes

---

## Troubleshooting

### "Module Not Found @rollup/rollup-win32-x64-msvc"
**Cause**: Windows-specific dependencies in lock file  
**Solution**: Already fixed! pnpm-lock.yaml regenerated for Linux. If building locally, Vercel will use correct Linux binaries.

### "Cannot find environment variable: VITE_AUTH0_DOMAIN"
**Cause**: Auth0 env vars not set  
**Solution**: 
1. Go to Vercel Settings → Environment Variables
2. Add `VITE_AUTH0_DOMAIN` and `VITE_AUTH0_CLIENT_ID`
3. Redeploy

### "Database connection refused"
**Cause**: DATABASE_URL incorrect or database unreachable  
**Solution**:
1. Verify `DATABASE_URL` format: `postgresql://user:password@host:5432/database`
2. Test locally: `psql $DATABASE_URL -c "\dt"`
3. Ensure Vercel's IP is whitelisted in database firewall

### "Auth0 callback URL mismatch"
**Cause**: Auth0 callback URLs don't match your Vercel domain  
**Solution**:
1. Go to Auth0 Dashboard → Applications → Settings
2. Update **Allowed Callback URLs** to: `https://[your-vercel-app].vercel.app/api/callback`
3. Save and redeploy

### Deployment Stuck or Slow
**Cause**: pnpm install timeout  
**Solution**:
1. Increase timeout in **Settings → Build**
2. Or ensure `.pnpmfile.cjs` is optimized
3. Check Vercel logs for details

---

## Post-Deployment Checklist

- [ ] Frontend loads at `https://[your-app].vercel.app`
- [ ] API responds at `/api/*` endpoints
- [ ] Auth0 login works end-to-end
- [ ] Database queries work (projects, etc.)
- [ ] Stripe webhooks configured (if using payments)
- [ ] GitHub OAuth works (if using)
- [ ] Email alerts configured
- [ ] Domain custom domain configured (optional)
- [ ] CDN caching optimized
- [ ] Log monitoring set up (Vercel Analytics)

---

## Useful Links

- **Vercel Dashboard**: https://vercel.com/dashboard
- **Project**: https://vercel.com/dashboard/projects
- **Auth0 Dashboard**: https://manage.auth0.com/
- **Supabase Console**: https://app.supabase.com/
- **Vercel Docs**: https://vercel.com/docs
- **Express to Serverless**: https://vercel.com/docs/concepts/functions/serverless-functions

---

## Questions?

See the detailed deployment guides:
- [VERCEL_DEPLOYMENT_GUIDE.md](VERCEL_DEPLOYMENT_GUIDE.md) - Architecture & issues
- [VERCEL_ENV_SETUP.md](VERCEL_ENV_SETUP.md) - Environment variable details
- [DEPLOYMENT_AUDIT_REPORT.md](DEPLOYMENT_AUDIT_REPORT.md) - Full audit results

**Deployment Status**: ✅ Ready to Ship!
