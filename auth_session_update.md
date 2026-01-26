# Session Token Authentication - Implementation Guide

**Date**: 2026-01-25
**From**: Coolify Wrapper API Team
**To**: SAAC CLI Team
**Subject**: New Session-Based Authentication System

---

## Executive Summary

The Coolify Wrapper API now supports **session-based authentication** with 1-year expiring tokens. This provides better security than permanent API keys while maintaining a great user experience.

**Key Changes**:
- New `/auth/login` endpoint to exchange API keys for session tokens
- Session tokens expire after 1 year (vs permanent API keys)
- Multiple concurrent sessions per user (laptop, desktop, etc.)
- Server-side revocation capability
- Backward compatible - permanent API keys still work

---

## Why Session Tokens?

### Current Problem
```javascript
// Current flow - LESS SECURE
~/.saac/config.json:
{
  "email": "user@example.com",
  "apiKey": "cw_permanent_key..."  // Never expires, full access forever
}
```

**Risk**: If `~/.saac/config.json` is compromised, attacker has permanent access until user manually regenerates API key.

### New Solution
```javascript
// Session token flow - MORE SECURE
~/.saac/config.json:
{
  "email": "user@example.com",
  "sessionToken": "st_xyz...",      // Expires in 1 year
  "expiresAt": "2026-01-25T...",
  "verified": true
}
```

**Benefits**:
- ✅ Limited time window (1 year vs forever)
- ✅ Server can revoke tokens remotely
- ✅ User can see all active sessions
- ✅ Matches industry standards (GitHub CLI, AWS CLI, Vercel CLI)

---

## New API Endpoints

### 1. POST /api/v1/auth/login

**Purpose**: Exchange permanent API key for a session token (1-year expiry)

**Request**:
```bash
POST https://apps.startanaicompany.com/api/v1/auth/login
Headers:
  X-API-Key: cw_RJ1gH8Sd1nvmPF4lWigu2g3Nkjt1mwEJXYd2aycD0IIniNPhImE5XgWaz3Tcz
  Content-Type: application/json

Body (optional):
{
  "email": "ryan88@goryan.io"  // For validation
}
```

**Response (Success - 200)**:
```json
{
  "session_token": "st_abc123defghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTU",
  "expires_at": "2026-01-25T12:34:56.789Z",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "ryan88@goryan.io",
    "verified": true,
    "max_applications": 50
  }
}
```

**Response (Error - 401)**:
```json
{
  "error": "Invalid API key",
  "code": "UNAUTHORIZED",
  "timestamp": "2026-01-25T12:34:56.789Z"
}
```

**Token Format**:
- Prefix: `st_`
- Length: 64 characters total
- Pattern: `st_` + 61 random alphanumeric characters
- Example: `st_kgzfNByNNrtrDsAW07h6ORwTtP3POK6O98klH9Rm8jTt9ByHojeH7zDmGwaF`

**Security Notes**:
- Session token is returned in plaintext **only once**
- Server stores SHA-256 hash of the token
- Token expires exactly 1 year after creation
- Token can be revoked remotely by user or server

---

### 2. POST /api/v1/auth/logout

**Purpose**: Revoke the current session token

**Request**:
```bash
POST https://apps.startanaicompany.com/api/v1/auth/logout
Headers:
  X-Session-Token: st_abc123...
```

**Response (Success - 200)**:
```json
{
  "success": true,
  "message": "Session revoked successfully"
}
```

**Use Case**: User wants to logout from current device only

---

### 3. POST /api/v1/auth/logout-all

**Purpose**: Revoke ALL sessions for the current user

**Request**:
```bash
POST https://apps.startanaicompany.com/api/v1/auth/logout-all
Headers:
  X-Session-Token: st_abc123...
  # OR
  X-API-Key: cw_permanent_key...
```

**Response (Success - 200)**:
```json
{
  "success": true,
  "sessions_revoked": 3,
  "message": "3 session(s) revoked successfully"
}
```

**Use Cases**:
- Device lost or stolen
- Security breach suspected
- User wants to force re-login on all devices

---

### 4. GET /api/v1/auth/sessions

**Purpose**: List all active sessions for the current user

**Request**:
```bash
GET https://apps.startanaicompany.com/api/v1/auth/sessions
Headers:
  X-Session-Token: st_abc123...
  # OR
  X-API-Key: cw_permanent_key...
```

**Response (Success - 200)**:
```json
{
  "sessions": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "expires_at": "2026-01-25T12:34:56.789Z",
      "created_at": "2025-01-25T12:34:56.789Z",
      "last_used_at": "2025-01-25T14:22:10.123Z",
      "created_ip": "192.168.1.100",
      "created_user_agent": "saac-cli/1.0.0 (Darwin; x64)"
    },
    {
      "id": "660e9511-f39c-52e5-b827-557766551111",
      "expires_at": "2026-01-20T08:15:30.456Z",
      "created_at": "2025-01-20T08:15:30.456Z",
      "last_used_at": "2025-01-23T09:45:22.789Z",
      "created_ip": "192.168.1.105",
      "created_user_agent": "saac-cli/1.0.0 (Linux; x64)"
    }
  ],
  "total": 2
}
```

**Use Case**: User wants to see which devices are logged in

---

### 5. DELETE /api/v1/auth/sessions/:sessionId

**Purpose**: Revoke a specific session by ID

**Request**:
```bash
DELETE https://apps.startanaicompany.com/api/v1/auth/sessions/550e8400-e29b-41d4-a716-446655440000
Headers:
  X-Session-Token: st_abc123...
  # OR
  X-API-Key: cw_permanent_key...
```

**Response (Success - 200)**:
```json
{
  "success": true,
  "message": "Session revoked successfully"
}
```

**Use Case**: User sees unfamiliar session and wants to revoke it

---

## Authentication Header Priority

The middleware checks headers in this order:

1. **X-Session-Token** (session token) - Checked first
2. **X-API-Key** (permanent API key) - Fallback

**Examples**:

```bash
# Option 1: Use session token (recommended for CLI users)
curl https://apps.startanaicompany.com/api/v1/users/me \
  -H "X-Session-Token: st_abc123..."

# Option 2: Use permanent API key (for CI/CD, scripts)
curl https://apps.startanaicompany.com/api/v1/users/me \
  -H "X-API-Key: cw_abc123..."
```

**Note**: If both headers are provided, `X-Session-Token` takes priority.

---

## CLI Implementation Guide

### Recommended Changes

#### 1. Update `src/lib/api.js`

```javascript
const axios = require('axios');
const { getUser } = require('./config');

function createClient() {
  const user = getUser();
  const envApiKey = process.env.SAAC_API_KEY; // For CI/CD

  const headers = {
    'Content-Type': 'application/json',
  };

  // Priority order:
  // 1. Environment variable (for CI/CD, scripts)
  // 2. Session token (for CLI users)
  // 3. API key (backward compatibility)
  if (envApiKey) {
    headers['X-API-Key'] = envApiKey;
  } else if (user?.sessionToken) {
    headers['X-Session-Token'] = user.sessionToken;
  } else if (user?.apiKey) {
    headers['X-API-Key'] = user.apiKey;
  }

  return axios.create({
    baseURL: 'https://apps.startanaicompany.com/api/v1',
    timeout: 30000,
    headers,
  });
}

/**
 * Login and get session token
 */
async function login(email, apiKey) {
  const client = axios.create({
    baseURL: 'https://apps.startanaicompany.com/api/v1',
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey, // Use API key for login
    },
  });

  const response = await client.post('/auth/login', { email });
  return response.data;
}

module.exports = {
  createClient,
  login,
};
```

#### 2. Update `src/lib/config.js`

```javascript
const Conf = require('conf');
const config = new Conf();

/**
 * Save user data including session token
 */
function saveUser(userData) {
  config.set('user', {
    email: userData.email,
    userId: userData.userId,
    sessionToken: userData.sessionToken,  // NEW
    expiresAt: userData.expiresAt,        // NEW
    verified: userData.verified,
  });
}

/**
 * Check if user is authenticated and token is valid
 */
function isAuthenticated() {
  const user = getUser();

  if (!user || !user.email) {
    return false;
  }

  // Check for session token
  if (user.sessionToken) {
    // Check if token is expired
    if (user.expiresAt) {
      const expirationDate = new Date(user.expiresAt);
      const now = new Date();

      if (now >= expirationDate) {
        return false; // Token expired
      }
    }
    return true;
  }

  // Fallback: Check for API key (backward compatibility)
  return !!user.apiKey;
}

/**
 * Check if session token expires soon (within 7 days)
 */
function isTokenExpiringSoon() {
  const user = getUser();
  if (!user?.expiresAt) return false;

  const expirationDate = new Date(user.expiresAt);
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  return expirationDate <= sevenDaysFromNow;
}

module.exports = {
  saveUser,
  getUser,
  isAuthenticated,
  isTokenExpiringSoon,
};
```

#### 3. Update `src/commands/login.js`

```javascript
const inquirer = require('inquirer');
const validator = require('validator');
const api = require('../lib/api');
const { saveUser } = require('../lib/config');
const logger = require('../lib/logger');

async function login(options) {
  try {
    logger.section('Login to StartAnAiCompany');

    // Get credentials
    let email = options.email;
    let apiKey = options.apiKey;

    if (!email) {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'email',
          message: 'Email address:',
          validate: (input) => validator.isEmail(input) || 'Invalid email',
        },
      ]);
      email = answers.email;
    }

    if (!apiKey) {
      const answers = await inquirer.prompt([
        {
          type: 'password',
          name: 'apiKey',
          message: 'API Key:',
          mask: '*',
        },
      ]);
      apiKey = answers.apiKey;
    }

    const spin = logger.spinner('Logging in...').start();

    try {
      // Call new /auth/login endpoint
      const result = await api.login(email, apiKey);

      spin.succeed('Login successful!');

      // Save session token and expiration
      saveUser({
        email: result.user.email || email,
        userId: result.user.id,
        sessionToken: result.session_token,  // NEW: Store session token
        expiresAt: result.expires_at,        // NEW: Store expiration
        verified: result.user.verified,
      });

      logger.newline();
      logger.success('You are now logged in!');
      logger.newline();
      logger.field('Email', email);
      logger.field('Verified', result.user.verified ? 'Yes' : 'No');

      // Show expiration date
      if (result.expires_at) {
        const expirationDate = new Date(result.expires_at);
        logger.field('Session expires', expirationDate.toLocaleDateString());
      }

    } catch (error) {
      spin.fail('Login failed');
      throw error;
    }
  } catch (error) {
    logger.error(error.response?.data?.message || error.message);
    process.exit(1);
  }
}

module.exports = login;
```

#### 4. Add New Command: `src/commands/logout.js`

```javascript
const api = require('../lib/api');
const { clearUser } = require('../lib/config');
const logger = require('../lib/logger');

async function logout() {
  try {
    logger.section('Logout from StartAnAiCompany');

    const spin = logger.spinner('Logging out...').start();

    try {
      // Revoke current session on server
      const client = api.createClient();
      await client.post('/auth/logout');

      // Clear local config
      clearUser();

      spin.succeed('Logout successful!');
      logger.success('You have been logged out.');

    } catch (error) {
      // Even if server call fails, clear local config
      clearUser();
      spin.warn('Logged out locally (server error)');
    }
  } catch (error) {
    logger.error(error.message);
    process.exit(1);
  }
}

module.exports = logout;
```

---

## Migration Strategy

### Phase 1: Backward Compatible (Recommended)

**Support both authentication methods** during transition:

```javascript
// CLI automatically uses the best available authentication:
// 1. SAAC_API_KEY env var (for CI/CD)
// 2. Session token (for CLI users)
// 3. API key (legacy, still works)

createClient() {
  if (process.env.SAAC_API_KEY) {
    return { 'X-API-Key': process.env.SAAC_API_KEY };
  }
  if (user.sessionToken) {
    return { 'X-Session-Token': user.sessionToken };
  }
  if (user.apiKey) {
    return { 'X-API-Key': user.apiKey };
  }
}
```

**Benefits**:
- ✅ No breaking changes
- ✅ Users can upgrade CLI whenever convenient
- ✅ CI/CD pipelines continue working
- ✅ Gradual migration

### Phase 2: Encourage Session Tokens

**Show warnings for API key usage**:

```javascript
if (user.apiKey && !user.sessionToken) {
  logger.warn('You are using a permanent API key.');
  logger.warn('Run `saac login` to get a session token (more secure).');
}
```

### Phase 3: Optional - Force Migration

**After 6-12 months**, optionally deprecate permanent API keys for CLI usage:

```javascript
if (user.apiKey && !user.sessionToken) {
  logger.error('Permanent API keys are deprecated for CLI usage.');
  logger.error('Please run `saac login` to get a session token.');
  process.exit(1);
}
```

**Note**: Keep permanent API keys working for CI/CD via environment variable!

---

## Testing the Implementation

### Test 1: Login Flow

```bash
# Clear existing config
rm -rf ~/.saac

# Login with API key
saac login -e ryan88@goryan.io -k cw_RJ1gH8Sd1nvmPF4lWigu2g3Nkjt1mwEJXYd2aycD0IIniNPhImE5XgWaz3Tcz

# Verify session token saved
cat ~/.saac/config.json | jq
# Should show sessionToken and expiresAt
```

### Test 2: Authenticated Request

```bash
# Get user info (should use session token)
saac whoami

# Verify it works
```

### Test 3: Token Expiration

```bash
# Manually set expired token in config
# Edit ~/.saac/config.json:
{
  "sessionToken": "st_abc123...",
  "expiresAt": "2020-01-01T00:00:00.000Z"  // Past date
}

# Try authenticated request
saac whoami
# Should prompt to login again
```

### Test 4: Multiple Sessions

```bash
# Login on device 1
saac login -e user@example.com -k cw_key1

# Login on device 2
saac login -e user@example.com -k cw_key1

# List sessions
saac sessions
# Should show 2 active sessions
```

### Test 5: Logout

```bash
# Logout from current session
saac logout

# Try authenticated request
saac whoami
# Should prompt to login
```

---

## Environment Variable Support (CI/CD)

For CI/CD pipelines and scripts, **permanent API keys via environment variable still work**:

```bash
# Set API key as environment variable
export SAAC_API_KEY="cw_RJ1gH8Sd1nvmPF4lWigu2g3Nkjt1mwEJXYd2aycD0IIniNPhImE5XgWaz3Tcz"

# Run CLI commands (no login required)
saac create myapp
saac deploy myapp
saac logs myapp
```

**This approach is recommended for**:
- GitHub Actions
- GitLab CI
- Jenkins
- Docker containers
- Automated scripts

---

## Security Best Practices

### For CLI Users

1. ✅ **Use session tokens** (via `saac login`)
2. ✅ **Don't commit** `~/.saac/config.json` to git
3. ✅ **Set file permissions**: `chmod 600 ~/.saac/config.json`
4. ✅ **Revoke sessions** when changing devices
5. ✅ **Use `saac logout-all`** if device is lost

### For CI/CD

1. ✅ **Use environment variables** for API keys
2. ✅ **Use secrets management** (GitHub Secrets, GitLab Variables)
3. ✅ **Never log API keys** in CI output
4. ✅ **Rotate keys periodically**

---

## Timeline

- ✅ **2026-01-25**: Session token system deployed to production
- ⏳ **Next Week**: CLI team implements session token support
- ⏳ **Next Month**: Gradual user migration to session tokens
- ⏳ **6-12 Months**: Consider deprecating API keys for CLI (keep for CI/CD)

---

## FAQ

### Q: Do existing API keys still work?

**A**: Yes! Permanent API keys (`cw_...`) continue to work exactly as before. The server accepts both `X-API-Key` and `X-Session-Token` headers.

### Q: Can I have multiple active sessions?

**A**: Yes! Each device can have its own session token. Great for users with multiple computers.

### Q: What happens when a session token expires?

**A**: The CLI will receive a 401 error. You should detect this and prompt the user to login again via `saac login`.

### Q: Can I revoke a session remotely?

**A**: Yes! Use `POST /auth/logout-all` to revoke all sessions, or `DELETE /auth/sessions/:id` to revoke a specific session.

### Q: How do I rotate my permanent API key?

**A**: Use the existing `POST /users/regenerate-key` endpoint. This doesn't affect session tokens (they remain valid until expiry).

### Q: Are session tokens secure?

**A**: Yes! They are:
- 64 characters of cryptographically random data
- Hashed with SHA-256 before storage
- Transmitted over HTTPS only
- Automatically expire after 1 year
- Revocable server-side

---

## Support

If you have questions about implementing session tokens in the CLI:

1. Check this documentation
2. Test the endpoints manually with `curl`
3. Contact the Coolify Wrapper API team
4. Review the implementation in `/home/milko/projects/coolifywrapper/src/`

---

## Appendix: Complete Example

Here's a complete example of the login flow:

```bash
# 1. User runs login command
$ saac login -e ryan88@goryan.io -k cw_RJ1gH8Sd1nvmPF4lWigu2g3Nkjt1mwEJXYd2aycD0IIniNPhImE5XgWaz3Tcz

# 2. CLI calls API
POST https://apps.startanaicompany.com/api/v1/auth/login
Headers: X-API-Key: cw_RJ1gH8Sd1nvmPF4lWigu2g3Nkjt1mwEJXYd2aycD0IIniNPhImE5XgWaz3Tcz

# 3. Server responds
{
  "session_token": "st_kgzfNByNNrtrDsAW07h6ORwTtP3POK6O98klH9Rm8jTt9ByHojeH7zDmGwaF",
  "expires_at": "2026-01-25T12:34:56.789Z",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "ryan88@goryan.io",
    "verified": true,
    "max_applications": 50
  }
}

# 4. CLI saves to ~/.saac/config.json
{
  "user": {
    "email": "ryan88@goryan.io",
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "sessionToken": "st_kgzfNByNNrtrDsAW07h6ORwTtP3POK6O98klH9Rm8jTt9ByHojeH7zDmGwaF",
    "expiresAt": "2026-01-25T12:34:56.789Z",
    "verified": true
  }
}

# 5. User runs other commands
$ saac whoami

# 6. CLI uses session token
GET https://apps.startanaicompany.com/api/v1/users/me
Headers: X-Session-Token: st_kgzfNByNNrtrDsAW07h6ORwTtP3POK6O98klH9Rm8jTt9ByHojeH7zDmGwaF

# 7. Server validates and responds
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "ryan88@goryan.io",
  "gitea_username": "ryan",
  "created_at": "2025-01-20T08:15:30.456Z",
  "application_count": 5,
  "max_applications": 50,
  "email_verified": true
}
```

---

**End of Report**

Good luck with the implementation! The session token system is live and ready to use. 🚀
