# GitHub OAuth Setup Guide

This guide explains how to add GitHub as an OAuth provider for Hostack authentication.

## Quick Start

GitHub OAuth allows users to log in to Hostack using their GitHub account. This runs alongside the existing Auth0 authentication.

## Prerequisites

- A GitHub account with admin access to an organization or personal account
- Your Hostack application URL

## Setup Steps

### 1. Create GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **"New OAuth App"** under OAuth Apps
3. Fill in the application details:
   - **Application name**: `Hostack` (or your custom name)
   - **Homepage URL**: Your Hostack domain (e.g., `https://hostack.example.com`)
   - **Authorization callback URL**: `https://hostack.example.com/api/github-callback`
4. Click **Create OAuth App**

### 2. Get Client Credentials

After creating the app:
1. Note the **Client ID** on the app page
2. Click **Generate a new client secret**
3. Copy the **Client Secret** (you won't see this again)

### 3. Configure Environment Variables

Add the following to your Vercel environment variables or `.env` file:

```bash
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
```

**Important**: Never commit `GITHUB_CLIENT_SECRET` to version control. Use environment variable management systems.

### 4. Redeploy

Deploy your application to apply the new environment variables:

```bash
# For Vercel
vercel env pull  # Pull new environment variables
npm run build
npm run dev
```

## Usage

### For Users

Once configured, users will see a GitHub login option:

```
Available login providers:
- Auth0
- GitHub
```

Users can click the GitHub button to:
1. Authorize Hostack to access their GitHub profile
2. Be logged in automatically using their GitHub account

### For Developers

#### Manual Testing

Test the GitHub OAuth flow locally:

```bash
# Start the development server
npm run dev

# Visit login page (adjust URL as needed)
http://localhost:3000

# Click "Log in with GitHub" button
# Authorize the app
# You should be redirected and logged in
```

#### API Endpoints

**Get available auth providers**:
```bash
curl http://localhost:3000/api/auth/providers
```

Example response:
```json
{
  "providers": [
    {
      "name": "Auth0",
      "id": "auth0",
      "enabled": true,
      "loginUrl": "/api/login"
    },
    {
      "name": "GitHub",
      "id": "github",
      "enabled": true,
      "loginUrl": "/api/github-login"
    }
  ]
}
```

**GitHub Login**:
```bash
# Redirect to GitHub auth
GET /api/github-login?returnTo=/dashboard
```

**GitHub Callback** (automatic):
```bash
# GitHub redirects here after user authorization
GET /api/github-callback?code=...&state=...
```

## Scopes

The app requests the following GitHub scopes:
- `user:email` - Access to user's email address

This is the minimal set required for authentication. Additional scopes can be added in `src/routes/auth.ts` if needed.

## User Data Mapping

When a user logs in with GitHub, the following information is stored:

| GitHub Field | Hostack Field | Notes |
|---|---|---|
| `id` | `id` (prefixed with `github_`) | Unique GitHub user ID |
| `email` | `email` | Primary email or first public email |
| `name` | `firstName`, `lastName` | Split on first space |
| `avatar_url` | `profileImageUrl` | GitHub profile picture |

## Troubleshooting

### "GitHub OAuth not configured"
**Cause**: `GITHUB_CLIENT_ID` or `GITHUB_CLIENT_SECRET` not set
**Solution**: Check environment variables are properly configured and server is restarted

### "github_state_mismatch"
**Cause**: State mismatch between request and callback
**Solution**: This is a security issue. Ensure cookies are enabled and the callback URL matches exactly

### "github_token_failed"
**Cause**: Failed to exchange authorization code for token
**Solution**: 
- Verify `GITHUB_CLIENT_SECRET` is correct
- Check authorization callback URL matches exactly in GitHub app settings
- Ensure the code hasn't expired (codes expire after 10 minutes)

### "github_user_fetch_failed"
**Cause**: Failed to fetch user info from GitHub API
**Solution**:
- GitHub API outage
- Token has insufficient permissions
- GitHub user has disabled profile visibility

## Security Considerations

1. **Never expose client secrets**: Use environment variables, never hardcode
2. **HTTPS only in production**: Ensure `COOKIE_SECURE` is true
3. **State validation**: The app validates state tokens to prevent CSRF attacks
4. **Token expiration**: GitHub tokens used for login are short-lived
5. **Email privacy**: Users with private emails may not expose them via OAuth

## Combining with Auth0

Both Auth0 and GitHub OAuth can be enabled simultaneously:
- Users can choose which provider to use when logging in
- The same email can be used for both providers
- The app treats them as separate identities (different `id` fields)

To unify accounts across providers, implement account linking in the future.

## Disabling GitHub OAuth

To disable GitHub OAuth:
1. Remove `GITHUB_CLIENT_ID` environment variable
2. Redeploy

Users will only see Auth0 as a login option.

## Advanced: Adding More OAuth Providers

To add additional OAuth providers (Google, GitLab, etc.):
1. Create a similar pattern in `src/routes/auth.ts`
2. Add configuration environment variables
3. Add provider to `/api/auth/providers` endpoint
4. Update frontend to show new options

The pattern is identical for any OAuth 2.0 provider.
