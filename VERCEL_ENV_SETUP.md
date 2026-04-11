# Vercel Environment Variables Setup Guide

This guide walks you through configuring all required environment variables for Hostack in Vercel.

## Quick Start

1. **Go to your Vercel project dashboard**: https://vercel.com/dashboard
2. **Select your Hostack project**
3. **Go to Settings → Environment Variables**
4. **Add each variable below for the `Production` environment**
5. **Redeploy after adding variables**: Deployments → Redeploy

---

## Required Variables

### 🔧 Application Configuration

```
APP_URL=https://your-domain.vercel.app
```
- **Description**: Your production app URL
- **Where it's used**: Auth0 callbacks, API base URL
- **Example**: `https://hostack.example.com`

### 🔐 Encryption & Security

```
SECRET_ENCRYPTION_KEY=<base64-32-byte-key>
```
- **Description**: Base64-encoded 32-byte encryption key for sensitive data
- **Generate it**: Run one of these commands:
  ```bash
  # macOS/Linux
  openssl rand -base64 32

  # PowerShell
  [Convert]::ToBase64String((1..32 | ForEach-Object { [byte](Get-Random -Maximum 256) }))

  # Node.js
  node -e "console.log(Buffer.from(require('crypto').randomBytes(32)).toString('base64'))"
  ```
- **⚠️ IMPORTANT**: Store this securely, don't commit to git
- **Usage**: Used by API server to encrypt sensitive data

### 🔑 Auth0 Configuration (Backend)

```
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_CLIENT_ID=your-backend-client-id
AUTH0_CLIENT_SECRET=your-backend-client-secret
AUTH0_AUDIENCE=https://api.yourapp.com
```

**How to get these values**:
1. Go to Auth0 Dashboard → Applications → Your App
2. Copy `Domain`, `Client ID`, `Client Secret` from the settings
3. In Auth0, go to APIs → Create or select your API
4. Use the API identifier as `AUTH0_AUDIENCE`

**Auth0 Configuration in Auth0 Dashboard**:
- **Allowed Callback URLs**: `https://your-domain.vercel.app/api/callback`
- **Allowed Logout URLs**: `https://your-domain.vercel.app`
- **Allowed Web Origins**: `https://your-domain.vercel.app`

### 🌐 Frontend Auth0 Variables (Vite)

```
VITE_AUTH0_DOMAIN=your-tenant.us.auth0.com
VITE_AUTH0_CLIENT_ID=your-frontend-client-id
```

**How to get these values**:
1. Go to Auth0 Dashboard → Applications → Your Frontend App
2. Copy `Domain` and `Client ID`

**Note**: These are visible to the frontend (in browser), so use your frontend-specific Auth0 app credentials, not backend secrets.

### 🗄️ Database Configuration

```
DATABASE_URL=postgresql://user:password@host:5432/hostack
```

- **Description**: PostgreSQL connection string
- **Format**: `postgresql://username:password@hostname:5432/database_name`
- **How to set up**:
  1. Create a PostgreSQL database (on Render, AWS RDS, Supabase, etc.)
  2. Get the connection string from your database provider
  3. Paste it here

**For Supabase users**:
```
DATABASE_URL=postgresql://postgres:[password]@[host].supabase.co:5432/postgres?sslmode=require
```

**⚠️ IMPORTANT**: 
- Never commit `DATABASE_URL` to git
- Ensure the database is accessible from Vercel's IP range
- Test the connection before deploying

### 💳 Stripe (if using payment features)

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

- **How to get these**:
  1. Go to Stripe Dashboard → Developers → API keys
  2. Copy the Secret key (starts with `sk_live_` for production)
  3. Go to Webhooks → Create endpoint for `https://your-domain.vercel.app/api/stripe/webhooks`
  4. Copy the webhook signing secret

**Optional if you're not using Stripe payments yet**.

### 🐙 GitHub OAuth (for login/authentication)

```
GITHUB_CLIENT_ID=your-github-oauth-app-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-app-client-secret
```

- **How to set up GitHub OAuth App**:
  1. Go to https://github.com/settings/developers
  2. Click **New OAuth App**
  3. Fill in:
     - **Application name**: `Hostack`
     - **Homepage URL**: `https://your-domain.vercel.app`
     - **Authorization callback URL**: `https://your-domain.vercel.app/api/github-callback`
  4. Copy the **Client ID** and generate a **Client Secret**
  
- **What this enables**:
  - Users can log in with their GitHub account
  - GitHub and Auth0 can be used simultaneously
  
**Optional - only needed if you want GitHub login support**.

### 🔓 GitHub OAuth (for repository integration)

If using GitHub integration for connecting repositories:

```
GITHUB_APP_CLIENT_ID=your-github-app-client-id
GITHUB_APP_CLIENT_SECRET=your-github-app-client-secret
```

These are different from the OAuth login credentials above. This is for connecting GitHub repositories for deployments.

**Optional if you're not using GitHub repository integration yet**.

---

## Setting Variables in Vercel

### Via Vercel Dashboard (GUI)

1. Go to your project on Vercel
2. Click **Settings** tab
3. Click **Environment Variables** in the sidebar
4. For each variable:
   - Click **Add**
   - Enter **Name** (e.g., `DATABASE_URL`)
   - Enter **Value** (the actual value)
   - Select **Production** under "Select environments"
   - Click **Save**

### Via Vercel CLI

```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# Set a variable
vercel env add DATABASE_URL
# (Follow prompts)

# Verify variables are set
vercel env ls
```

---

## Verification Checklist

After setting all variables in Vercel:

- [ ] `APP_URL` is set to your production domain
- [ ] `SECRET_ENCRYPTION_KEY` is a base64-encoded 32-byte key (not default/dev)
- [ ] `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET` are production credentials
- [ ] `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID` are frontend app credentials
- [ ] `DATABASE_URL` points to your production PostgreSQL database
- [ ] All Auth0 callback URLs are configured in Auth0 dashboard
- [ ] Database is accessible from Vercel (test with a simple query)

---

## Redeploy After Adding Variables

After adding environment variables to Vercel:

1. Go to **Deployments**
2. Click the most recent deployment's **...** menu
3. Select **Redeploy**
4. Or: `git push origin main` to trigger auto-redeploy

---

## Troubleshooting

### "Critical environment variable not set"
- **Cause**: `VITE_AUTH0_DOMAIN` or `VITE_AUTH0_CLIENT_ID` missing in production
- **Fix**: Add missing variables in Vercel Settings → Environment Variables
- **Redeploy** after adding

### "Database connection failed"
- **Cause**: `DATABASE_URL` incorrect or database not accessible
- **Fix**: 
  1. Verify `DATABASE_URL` format in Vercel
  2. Test locally: `psql $DATABASE_URL -c "\dt"`
  3. Ensure database allows connections from Vercel's IP range
  4. Check database firewall rules

### "Auth0 login fails with CORS error"
- **Cause**: `APP_URL` mismatch or not configured in Auth0
- **Fix**:
  1. Set `APP_URL` in Vercel to your actual domain
  2. Go to Auth0 → Applications → Your App → Settings
  3. Update **Allowed Callback URLs**: `https://your-domain.vercel.app/api/callback`
  4. Update **Allowed Web Origins**: `https://your-domain.vercel.app`

### "Environment variables not taking effect"
- **Cause**: Vercel cached old deployment
- **Fix**: Go to Deployments → Redeploy the latest build

---

## Security Best Practices

✅ **DO**:
- Store all secrets in Vercel's environment variables (not code)
- Use strong, unique values for `SECRET_ENCRYPTION_KEY`
- Use production Auth0 credentials (not dev tenant)
- Rotate keys periodically
- Use `.gitignore` to prevent `.env` files from being committed

❌ **DON'T**:
- Commit `.env` files to git
- Use dev/test auth credentials in production
- Share environment variables in messages or emails
- Expose `AUTH0_CLIENT_SECRET` in frontend code
- Use the same key/secret across multiple environments

---

## Next Steps

1. ✅ Ensure `pnpm-lock.yaml` is pushed (for Linux compatibility)
2. ✅ Run `pnpm run typecheck` again to verify all types pass
3. 📝 Set up all environment variables in Vercel (use this guide)
4. 🗄️ Create/configure your production PostgreSQL database
5. 🔐 Generate strong `SECRET_ENCRYPTION_KEY`
6. 🔑 Create production Auth0 tenant and app
7. 🚀 Trigger deployment in Vercel

---

**Version**: 1.0  
**Last Updated**: April 2, 2026
