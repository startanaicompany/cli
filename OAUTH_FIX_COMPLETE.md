# OAuth CLI Fix - Complete

## Status: ✅ Ready for Testing

All OAuth authentication issues have been fixed. The CLI version 1.4.9 is ready to be published to npm.

## What Was Fixed

### Backend Fixes (Deployed ✅)
1. **Schema Mismatch** - Fixed oauth.js to use correct table (`session_tokens`) and columns (`token_hash`)
2. **Email Retrieval** - Added JOIN with users table to get email field
3. **Deployed** - Backend changes deployed to production at commit a43192f

### CLI Fixes (Ready for Publish 📦)
1. **Wait Time** - Increased from 5s to 60s to give users time to authorize
2. **Error Handling** - Continue polling on 401/404 errors instead of failing immediately
3. **HTTP Headers** - Use correct header based on token type:
   - Session tokens (`st_*`) → `X-Session-Token` header
   - API keys (`cw_*`) → `X-API-Key` header
4. **Version** - Bumped to 1.4.9

## Publishing the CLI

**The CLI cannot auto-publish due to npm 2FA requirement.**

To publish manually:

```bash
cd /home/milko/projects/saac-cli

# Get 2FA code from authenticator app
npm publish --access public --otp=<YOUR_CODE>
```

## Testing the OAuth Flow

Once published, test with:

```bash
# Install latest version
npm install -g @startanaicompany/cli

# Test OAuth connection
saac git connect git.startanaicompany.com
```

**Expected Behavior:**
1. ✅ CLI opens browser to OAuth page
2. ✅ User has 60 seconds to authorize
3. ✅ CLI polls using `X-Session-Token` header
4. ✅ Browser shows: "✅ Authorization Successful"
5. ✅ CLI detects completion: "Connected to git.startanaicompany.com as <username>"

## What Changed in the Code

### Backend: `/home/milko/projects/coolifywrapper/src/routes/oauth.js`

**Before (Broken):**
```javascript
const sessionResult = await db.query(
  'SELECT user_id, email FROM sessions WHERE session_token = $1',
  [token]
);
```

**After (Fixed):**
```javascript
const sessionResult = await db.query(
  `SELECT st.user_id, u.email
   FROM session_tokens st
   JOIN users u ON st.user_id = u.id
   WHERE st.token_hash = $1 AND st.expires_at > NOW() AND st.revoked_at IS NULL`,
  [crypto.createHash('sha256').update(token).digest('hex')]
);
```

### CLI: `/home/milko/projects/saac-cli/src/lib/oauth.js`

**Before (Broken):**
```javascript
// Always used X-API-Key header
const response = await axios.get(
  `${baseUrl}/oauth/poll/${sessionId}`,
  {
    headers: {
      'X-API-Key': apiKey,
    },
  }
);
```

**After (Fixed):**
```javascript
// Use correct header based on token type
const headers = apiKey.startsWith('st_')
  ? { 'X-Session-Token': apiKey }
  : { 'X-API-Key': apiKey };

const response = await axios.get(
  `${baseUrl}/oauth/poll/${sessionId}`,
  { headers }
);
```

## Timeline of Fixes

1. **Backend schema fix** - Commit a43192f (deployed)
2. **CLI wait time** - Changed to 60s (version 1.4.8)
3. **CLI header fix** - Commit 493a512 (version 1.4.9, ready to publish)

## Architecture Notes

### Why Two Token Types?

- **Session Tokens (`st_*`)** - Short-lived (1 day), browser-based, for CLI login
- **API Keys (`cw_*`)** - Long-lived, for programmatic access

### Why Different Headers?

The backend authentication middleware checks headers in this priority:

1. `X-Session-Token` - For session tokens
2. `X-API-Key` - For API keys

If you send `st_*` tokens via `X-API-Key` header, the backend validates them as API keys and rejects them (API keys must start with `cw_`).

### How OAuth Flow Works

```
1. CLI calls: saac git connect git.startanaicompany.com
2. CLI generates session_id (random hex)
3. CLI opens browser: /oauth/authorize?git_host=...&session_id=...&token=st_...
4. User clicks "Authorize" in browser
5. Browser redirects to Gitea OAuth
6. User approves in Gitea
7. Gitea redirects to: /oauth/callback?code=...&state=...
8. Backend exchanges code for access token
9. Backend stores connection in database
10. Backend updates oauth_cli_sessions to 'completed'
11. CLI polls /oauth/poll/:session_id (with X-Session-Token header)
12. CLI receives status='completed' and displays success
```

## Troubleshooting

### If "Request failed with status code 401"
- Check that CLI version is 1.4.9 or higher
- Verify backend is deployed (commit a43192f or later)

### If "Authorization timed out"
- User has 5 minutes total (60s initial wait + 150 polls × 2s)
- Check that user completed OAuth in browser

### If browser shows success but CLI keeps polling
- This was the header mismatch bug - fixed in 1.4.9
- Ensure using latest CLI version

## Next Steps

1. **Publish CLI** - Run `npm publish --access public --otp=<code>`
2. **Test OAuth** - Run `saac git connect git.startanaicompany.com`
3. **Verify** - Browser should show success, CLI should detect it

---

**All issues resolved. Ready for production testing.**
