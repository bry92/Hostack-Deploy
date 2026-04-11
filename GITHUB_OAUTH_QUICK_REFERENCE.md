# GitHub OAuth Quick Reference

## 30-Second Setup

### 1. Create GitHub OAuth App
- Visit: https://github.com/settings/developers
- Click **New OAuth App**
- **Application name**: `Hostack`
- **Homepage URL**: `https://your-domain.vercel.app`
- **Authorization callback URL**: `https://your-domain.vercel.app/api/github-callback`
- Click Create → Copy **Client ID** and **Client Secret**

### 2. Add Environment Variables

In Vercel or your `.env`:
```bash
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
```

### 3. Redeploy
```bash
vercel env pull
npm run build
npm run dev  # local testing
```

### 4. Done! 🎉
Users now see GitHub as a login option alongside Auth0.

---

## Test It

1. Go to your app's login page
2. You should see:
   - ✅ Auth0 button
   - ✅ GitHub button (if configured)
3. Click GitHub button
4. You'll be redirected to GitHub
5. Authorize the app
6. You'll be logged in automatically

---

## Troubleshooting

| Error | Solution |
|-------|----------|
| "GitHub OAuth not configured" | Check `GITHUB_CLIENT_ID` environment variable is set |
| "state mismatch" | Ensure callback URL exactly matches in GitHub settings |
| "token_failed" | Verify `GITHUB_CLIENT_SECRET` is correct |
| Users see error after GitHub auth | Check GitHub API status or user's GitHub permissions |

---

## API Endpoints

```bash
# Check available providers
curl https://your-domain.vercel.app/api/auth/providers

# GitHub login (automatic redirect)
GET /api/github-login?returnTo=/dashboard

# GitHub callback (automatic after user authorizes)
GET /api/github-callback?code=...&state=...
```

---

## Advanced: Using LoginChooser Component

Show a UI with all available login providers:

```tsx
import { LoginChooser } from "@/components/auth/login-chooser";

export function LoginPage() {
  return <LoginChooser returnTo="/dashboard" />;
}
```

---

## Disabling GitHub OAuth

Remove `GITHUB_CLIENT_ID` environment variable and redeploy. Only Auth0 will be available.

---

## Documentation

- **Full setup guide**: [GITHUB_OAUTH_SETUP.md](./GITHUB_OAUTH_SETUP.md)
- **Environment variables**: [VERCEL_ENV_SETUP.md](./VERCEL_ENV_SETUP.md)
- **GitHub OAuth docs**: https://docs.github.com/en/developers/apps/building-oauth-apps
