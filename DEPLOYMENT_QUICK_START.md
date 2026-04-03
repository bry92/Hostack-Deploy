# Quick Start: Deploy to Vercel

## 🚀 TL;DR - 5 Minute Setup

### Step 1: Apply Code Fixes (ALREADY DONE ✅)
All critical code fixes have been applied:
- ✅ Tailwind CSS scanning fixed
- ✅ SPA routing configured  
- ✅ TypeScript strict mode enabled
- ✅ Auth0 production safeguards added
- ✅ API startup validation improved

### Step 2: Verify Local Build (2 min)
```bash
pnpm run typecheck   # Must pass with 0 errors
pnpm run build       # Must complete successfully
```

### Step 3: Set Environment Variables in Vercel (2 min)
1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Add these for **Production**:

```
APP_URL=https://your-domain.vercel.app
SECRET_ENCRYPTION_KEY=<32-byte base64 key>
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_CLIENT_ID=your-client-id  
AUTH0_CLIENT_SECRET=your-client-secret
VITE_AUTH0_DOMAIN=your-tenant.us.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id
DATABASE_URL=postgresql://user:pass@host/hostack
```

**Get SECRET_ENCRYPTION_KEY**:
```bash
# macOS/Linux
openssl rand -base64 32

# PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

### Step 4: Set Up Database (1-2 min)
Choose one:
- **Vercel Postgres** (easiest): Let Vercel manage it
- **External DB**: Create PostgreSQL, get connection URL, add as `DATABASE_URL`

### Step 5: Deploy
```bash
git push origin main
# Vercel automatically deploys
```

---

## ⚠️ Critical Issues Fixed

| Issue | File | Status |
|-------|------|--------|
| Frontend/API split across domains | `vercel.json` | ✅ Fixed now uses same domain |
| Tailwind styles missing | `tailwind.config.js` | ✅ Fixed now scans source |
| SPA routes return 404 | `vercel.json` | ✅ Fixed with rewrite |
| Dev Auth0 used in prod | `auth-context.tsx` | ✅ Fixed throws error if not set |
| TypeScript type safety weak | `tsconfig.json` | ✅ Fixed strict mode enabled |

---

## 🔑 Key Files Created/Updated

| File | Purpose |
|------|---------|
| [vercel.json](vercel.json) | Root monorepo deployment config |
| [VERCEL_DEPLOYMENT_GUIDE.md](VERCEL_DEPLOYMENT_GUIDE.md) | Comprehensive deployment guide |
| [DEPLOYMENT_AUDIT_REPORT.md](DEPLOYMENT_AUDIT_REPORT.md) | Detailed audit of all changes |
| [artifacts/hostack/vercel.json](artifacts/hostack/vercel.json) | Frontend rewrite rules |

---

## ✅ Pre-Deploy Checklist

- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run build` completes 
- [ ] Auth0 production tenant set up
- [ ] PostgreSQL database created
- [ ] All env vars set in Vercel
- [ ] Code committed and pushed
- [ ] Deployment triggered in Vercel

---

## 🆘 If Something Breaks

### 1. Check Vercel Logs
Vercel Dashboard → Deployments → Click failed deployment → See logs

### 2. Common Issues
| Error | Fix |
|-------|-----|
| `Module not found` | Regenerate `pnpm-lock.yaml` on Linux |
| `Cannot find AUTH0_DOMAIN` | Add `VITE_AUTH0_DOMAIN` to Vercel env vars |
| `DATABASE_URL is not set` | Add `DATABASE_URL` to Vercel env vars |
| Routes return 404 | Verify `/api/*` and `/*` rewrites in `vercel.json` |
| Login fails with CORS | Verify `APP_URL` is set correctly |

### 3. Test Locally First
```bash
pnpm run dev
# Visit http://localhost:3000
# Test login, API calls, database features
```

---

## 📞 Documentation

- **Full Setup Guide**: [VERCEL_DEPLOYMENT_GUIDE.md](VERCEL_DEPLOYMENT_GUIDE.md)
- **Audit Details**: [DEPLOYMENT_AUDIT_REPORT.md](DEPLOYMENT_AUDIT_REPORT.md)
- **Env Example**: [.env.example](.env.example)

---

## 🎯 Next Steps

1. **Generate SECRET_ENCRYPTION_KEY** (copy one of the commands above)
2. **Create/Get Auth0 credentials** (production tenant)
3. **Create/Access PostgreSQL database**
4. **Add all 8 env vars to Vercel**
5. **Deploy**: `git push origin main`
6. **Test**: Visit `https://your-app.vercel.app` and test login/features

---

**Status**: Code is deployment-ready ✅  
**Blockers**: Need env vars + database ⏳  
**Estimated Time to Deploy**: 5-10 minutes after env setup
