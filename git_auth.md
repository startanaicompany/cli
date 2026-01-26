# Git Authentication Implementation Guide for saac-cli

**Date**: 2026-01-26
**Status**: Wrapper OAuth implementation COMPLETE, CLI integration PENDING
**Related Project**: `~/projects/coolifywrapper` (OAuth backend)

---

## Executive Summary

The Coolify Wrapper API now has **full OAuth support** for Git authentication, matching industry standards (Railway, Vercel, Netlify). Users can connect their Git accounts once and deploy unlimited applications without providing tokens repeatedly.

**What's Changed:**
- ✅ Wrapper API supports OAuth for Gitea, GitHub, and GitLab
- ✅ OAuth tokens stored encrypted (AES-256-GCM) with auto-refresh
- ✅ Fallback to manual `--git-token` if OAuth not connected
- ⏳ **CLI needs updates to support OAuth flow**

**User Experience Goal:**
```bash
# First time - user connects Git account
saac create my-app --git git@git.startanaicompany.com:user/repo.git
❌ Git account not connected for git.startanaicompany.com
Would you like to connect now? (Y/n): y
Opening browser for authentication...
✅ Connected to git.startanaicompany.com as mikael.westoo
✅ Application created: my-app

# Future deployments - no token needed!
saac create another-app --git git@git.startanaicompany.com:user/repo2.git
✅ Using connected account: mikael.westoo@git.startanaicompany.com
✅ Application created: another-app
```

---

## What the Wrapper API Provides

### OAuth Endpoints (Already Implemented)

**1. Initiate OAuth Flow**
```
GET /oauth/authorize?git_host=<host>&session_id=<id>
Headers: X-API-Key: cw_xxx

Response: HTTP 302 Redirect to Git provider OAuth page
```

**2. Callback Handler** (Automatic)
```
GET /oauth/callback?code=<code>&state=<state>

Response: HTML success page (user closes browser)
```

**3. Poll for Completion** (CLI uses this)
```
GET /oauth/poll/:session_id
Headers: X-API-Key: cw_xxx

Response:
{
  "sessionId": "abc123",
  "gitHost": "git.startanaicompany.com",
  "status": "pending" | "completed" | "failed",
  "gitUsername": "mikael.westoo",
  "completedAt": "2026-01-26T12:00:00Z"
}
```

**4. List Connections**
```
GET /api/v1/users/me/oauth
Headers: X-API-Key: cw_xxx

Response:
{
  "connections": [
    {
      "gitHost": "git.startanaicompany.com",
      "gitUsername": "mikael.westoo",
      "providerType": "gitea",
      "scopes": ["read:repository", "write:repository"],
      "expiresAt": "2026-01-26T13:00:00Z",
      "createdAt": "2026-01-26T12:00:00Z",
      "lastUsedAt": "2026-01-26T12:30:00Z"
    }
  ],
  "count": 1
}
```

**5. Revoke Connection**
```
DELETE /api/v1/users/me/oauth/:git_host
Headers: X-API-Key: cw_xxx

Response: { "success": true }
```

### Application Creation (Auto-Uses OAuth)

**Wrapper's `createApplication()` logic:**
1. Extract `git_host` from `git_repository` URL
2. Check if user has OAuth connection for that `git_host`
3. If YES → Use OAuth token (automatic)
4. If NO → Fall back to manual `git_api_token` (if provided)
5. If NEITHER → Return error with OAuth connection URL

**Error Response Format:**
```json
{
  "error": "Git account not connected for git.startanaicompany.com. Please connect your Git account at https://apps.startanaicompany.com/oauth/authorize?git_host=git.startanaicompany.com or provide --git-token when creating the application."
}
```

---

## CLI Implementation Tasks

### Task 1: Add OAuth Helper Module

**File**: `lib/oauth.js`

```javascript
// lib/oauth.js
const axios = require('axios');
const open = require('open');
const crypto = require('crypto');
const chalk = require('chalk');

const WRAPPER_API_URL = process.env.WRAPPER_API_URL || 'https://apps.startanaicompany.com';

/**
 * Extract git_host from repository URL
 * @param {string} gitUrl - Git repository URL (SSH or HTTPS)
 * @returns {string} - Git host domain
 */
function extractGitHost(gitUrl) {
  // SSH format: git@git.startanaicompany.com:user/repo.git
  const sshMatch = gitUrl.match(/git@([^:]+):/);
  if (sshMatch) {
    return sshMatch[1];
  }

  // HTTPS format: https://git.startanaicompany.com/user/repo.git
  const httpsMatch = gitUrl.match(/https?:\/\/([^/]+)/);
  if (httpsMatch) {
    return httpsMatch[1];
  }

  throw new Error('Invalid Git repository URL format');
}

/**
 * Initiate OAuth flow for a git_host
 * @param {string} gitHost - Git host domain
 * @param {string} apiKey - User's API key
 * @returns {Promise<object>} - { gitUsername, gitHost }
 */
async function connectGitAccount(gitHost, apiKey) {
  const sessionId = crypto.randomBytes(16).toString('hex');

  console.log(chalk.blue(`\n🔐 Connecting to ${gitHost}...`));
  console.log(chalk.gray(`Session ID: ${sessionId}\n`));

  // Build authorization URL
  const authUrl = `${WRAPPER_API_URL}/oauth/authorize?git_host=${encodeURIComponent(gitHost)}&session_id=${sessionId}`;

  console.log(chalk.yellow('Opening browser for authentication...'));
  console.log(chalk.gray(`If browser doesn't open, visit: ${authUrl}\n`));

  // Open browser
  await open(authUrl);

  console.log(chalk.blue('Waiting for authorization...'));

  // Poll for completion
  return await pollForCompletion(sessionId, apiKey);
}

/**
 * Poll OAuth session until completed
 * @param {string} sessionId - Session ID
 * @param {string} apiKey - User's API key
 * @returns {Promise<object>} - { gitUsername, gitHost }
 */
async function pollForCompletion(sessionId, apiKey) {
  const pollInterval = 2000; // 2 seconds
  const maxAttempts = 150; // 5 minutes total (150 * 2s)

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(pollInterval);

    try {
      const response = await axios.get(
        `${WRAPPER_API_URL}/oauth/poll/${sessionId}`,
        {
          headers: {
            'X-API-Key': apiKey,
          },
        }
      );

      const { status, gitUsername, gitHost } = response.data;

      if (status === 'completed') {
        console.log(chalk.green(`\n✅ Connected to ${gitHost} as ${gitUsername}\n`));
        return { gitUsername, gitHost };
      }

      if (status === 'failed') {
        throw new Error('OAuth authorization failed');
      }

      // Still pending, continue polling
      process.stdout.write(chalk.gray('.'));
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error('OAuth session not found or expired');
      }
      throw error;
    }
  }

  throw new Error('OAuth authorization timed out (5 minutes)');
}

/**
 * Check if user has OAuth connection for git_host
 * @param {string} gitHost - Git host domain
 * @param {string} apiKey - User's API key
 * @returns {Promise<object|null>} - Connection object or null
 */
async function getConnection(gitHost, apiKey) {
  try {
    const response = await axios.get(
      `${WRAPPER_API_URL}/api/v1/users/me/oauth`,
      {
        headers: {
          'X-API-Key': apiKey,
        },
      }
    );

    const connection = response.data.connections.find(
      (conn) => conn.gitHost === gitHost
    );

    return connection || null;
  } catch (error) {
    return null;
  }
}

/**
 * List all OAuth connections
 * @param {string} apiKey - User's API key
 * @returns {Promise<array>} - Array of connection objects
 */
async function listConnections(apiKey) {
  const response = await axios.get(
    `${WRAPPER_API_URL}/api/v1/users/me/oauth`,
    {
      headers: {
        'X-API-Key': apiKey,
      },
    }
  );

  return response.data.connections;
}

/**
 * Revoke OAuth connection for git_host
 * @param {string} gitHost - Git host domain
 * @param {string} apiKey - User's API key
 */
async function revokeConnection(gitHost, apiKey) {
  await axios.delete(
    `${WRAPPER_API_URL}/api/v1/users/me/oauth/${encodeURIComponent(gitHost)}`,
    {
      headers: {
        'X-API-Key': apiKey,
      },
    }
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  extractGitHost,
  connectGitAccount,
  getConnection,
  listConnections,
  revokeConnection,
};
```

**Dependencies to Add:**
```bash
npm install open axios crypto
```

---

### Task 2: Update `saac create` Command

**File**: `bin/saac-create.js`

**Changes Needed:**

```javascript
// bin/saac-create.js
const { extractGitHost, getConnection, connectGitAccount } = require('../lib/oauth');

// ... existing imports and code ...

program
  .name('create')
  .description('Create a new application')
  .requiredOption('--name <name>', 'Application name')
  .requiredOption('--git <repository>', 'Git repository URL (SSH or HTTPS)')
  .option('--git-branch <branch>', 'Git branch', 'master')
  .option('--git-token <token>', 'Git API token (optional if OAuth connected)')
  .option('--subdomain <subdomain>', 'Subdomain for the application')
  // ... other options ...
  .action(async (options) => {
    try {
      const apiKey = process.env.WRAPPER_API_KEY;
      if (!apiKey) {
        console.error(chalk.red('❌ WRAPPER_API_KEY not set'));
        process.exit(1);
      }

      // Extract git_host from repository URL
      const gitHost = extractGitHost(options.git);
      console.log(chalk.gray(`Git host: ${gitHost}`));

      // Check if OAuth connected for this git_host
      const connection = await getConnection(gitHost, apiKey);

      if (connection) {
        console.log(
          chalk.green(
            `✅ Using connected account: ${connection.gitUsername}@${connection.gitHost}`
          )
        );
        // No need for --git-token, OAuth will be used automatically
      } else if (!options.gitToken) {
        // No OAuth connection AND no manual token provided
        console.log(
          chalk.yellow(
            `\n⚠️  Git account not connected for ${gitHost}`
          )
        );

        const readline = require('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const answer = await new Promise((resolve) => {
          rl.question(
            chalk.blue('Would you like to connect now? (Y/n): '),
            resolve
          );
        });
        rl.close();

        if (answer.toLowerCase() === 'n') {
          console.log(
            chalk.red(
              `\n❌ Cannot create application without Git authentication.\n`
            )
          );
          console.log(chalk.gray('Options:'));
          console.log(chalk.gray('  1. Connect Git account: saac git connect'));
          console.log(
            chalk.gray('  2. Provide token: saac create ... --git-token <token>\n')
          );
          process.exit(1);
        }

        // Initiate OAuth flow
        await connectGitAccount(gitHost, apiKey);
      }

      // Proceed with application creation
      console.log(chalk.blue('\n📦 Creating application...\n'));

      const createData = {
        name: options.name,
        subdomain: options.subdomain || options.name,
        git_repository: options.git,
        git_branch: options.gitBranch,
        git_api_token: options.gitToken, // Optional - wrapper will use OAuth if not provided
        template_type: options.template || 'custom',
        environment_variables: options.env ? parseEnv(options.env) : {},
        // ... other fields ...
      };

      const response = await axios.post(
        `${WRAPPER_API_URL}/api/v1/applications`,
        createData,
        {
          headers: {
            'X-API-Key': apiKey,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log(chalk.green('✅ Application created successfully!\n'));
      console.log(chalk.bold('Application Details:'));
      console.log(chalk.gray(`  Name: ${response.data.name}`));
      console.log(chalk.gray(`  UUID: ${response.data.uuid}`));
      console.log(chalk.gray(`  Domain: ${response.data.domain}`));
      console.log(chalk.gray(`  Status: ${response.data.status}\n`));

    } catch (error) {
      if (error.response?.data?.error) {
        console.error(chalk.red(`\n❌ ${error.response.data.error}\n`));

        // Check if error is about missing OAuth connection
        if (error.response.data.error.includes('Git account not connected')) {
          console.log(chalk.yellow('💡 Tip: Connect your Git account to skip providing tokens:'));
          console.log(chalk.gray(`   saac git connect ${gitHost}\n`));
        }
      } else {
        console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
      }
      process.exit(1);
    }
  });

program.parse();
```

---

### Task 3: Add `saac git` Commands

**File**: `bin/saac-git.js` (NEW FILE)

```javascript
#!/usr/bin/env node
// bin/saac-git.js
const { Command } = require('commander');
const chalk = require('chalk');
const {
  connectGitAccount,
  listConnections,
  revokeConnection,
  extractGitHost,
} = require('../lib/oauth');

const program = new Command();

program
  .name('git')
  .description('Manage Git account connections (OAuth)');

// saac git connect <repository-or-host>
program
  .command('connect')
  .description('Connect a Git account via OAuth')
  .argument('[host]', 'Git host domain or repository URL')
  .action(async (hostOrUrl) => {
    try {
      const apiKey = process.env.WRAPPER_API_KEY;
      if (!apiKey) {
        console.error(chalk.red('❌ WRAPPER_API_KEY not set'));
        process.exit(1);
      }

      let gitHost;

      if (!hostOrUrl) {
        // No argument - ask user which provider
        const readline = require('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        console.log(chalk.blue('Select Git provider:'));
        console.log('  1. git.startanaicompany.com (Gitea)');
        console.log('  2. github.com');
        console.log('  3. gitlab.com');
        console.log('  4. Custom host\n');

        const choice = await new Promise((resolve) => {
          rl.question(chalk.blue('Enter choice (1-4): '), resolve);
        });

        switch (choice) {
          case '1':
            gitHost = 'git.startanaicompany.com';
            break;
          case '2':
            gitHost = 'github.com';
            break;
          case '3':
            gitHost = 'gitlab.com';
            break;
          case '4':
            const custom = await new Promise((resolve) => {
              rl.question(chalk.blue('Enter Git host domain: '), resolve);
            });
            gitHost = custom;
            break;
          default:
            console.error(chalk.red('Invalid choice'));
            process.exit(1);
        }

        rl.close();
      } else if (hostOrUrl.includes('git@') || hostOrUrl.includes('http')) {
        // Repository URL provided
        gitHost = extractGitHost(hostOrUrl);
      } else {
        // Host domain provided
        gitHost = hostOrUrl;
      }

      await connectGitAccount(gitHost, apiKey);
    } catch (error) {
      console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
      process.exit(1);
    }
  });

// saac git list
program
  .command('list')
  .description('List connected Git accounts')
  .action(async () => {
    try {
      const apiKey = process.env.WRAPPER_API_KEY;
      if (!apiKey) {
        console.error(chalk.red('❌ WRAPPER_API_KEY not set'));
        process.exit(1);
      }

      const connections = await listConnections(apiKey);

      if (connections.length === 0) {
        console.log(chalk.yellow('\n⚠️  No Git accounts connected\n'));
        console.log(chalk.gray('Connect an account: saac git connect\n'));
        return;
      }

      console.log(chalk.bold('\n🔐 Connected Git Accounts:\n'));

      connections.forEach((conn, index) => {
        console.log(chalk.blue(`${index + 1}. ${conn.gitHost}`));
        console.log(chalk.gray(`   Username: ${conn.gitUsername}`));
        console.log(chalk.gray(`   Provider: ${conn.providerType}`));
        console.log(
          chalk.gray(
            `   Expires: ${new Date(conn.expiresAt).toLocaleString()}`
          )
        );
        console.log(
          chalk.gray(
            `   Last used: ${new Date(conn.lastUsedAt).toLocaleString()}`
          )
        );
        console.log('');
      });
    } catch (error) {
      console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
      process.exit(1);
    }
  });

// saac git disconnect <host>
program
  .command('disconnect')
  .description('Disconnect a Git account')
  .argument('<host>', 'Git host domain to disconnect')
  .action(async (host) => {
    try {
      const apiKey = process.env.WRAPPER_API_KEY;
      if (!apiKey) {
        console.error(chalk.red('❌ WRAPPER_API_KEY not set'));
        process.exit(1);
      }

      console.log(chalk.yellow(`\n⚠️  Disconnecting from ${host}...\n`));

      await revokeConnection(host, apiKey);

      console.log(chalk.green(`✅ Disconnected from ${host}\n`));
    } catch (error) {
      if (error.response?.status === 404) {
        console.error(
          chalk.red(`\n❌ No connection found for ${host}\n`)
        );
      } else {
        console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
      }
      process.exit(1);
    }
  });

program.parse();
```

**Register in `bin/saac.js`:**

```javascript
// bin/saac.js
program
  .command('git', 'Manage Git account connections')
  .description('Connect, list, or disconnect Git accounts (OAuth)');
```

---

### Task 4: Update `saac status` Command

**File**: `bin/saac-status.js`

**Add OAuth connection info to status output:**

```javascript
// bin/saac-status.js
const { listConnections } = require('../lib/oauth');

// ... existing status code ...

// Add OAuth connections section
try {
  const connections = await listConnections(apiKey);

  if (connections.length > 0) {
    console.log(chalk.bold('\n🔐 Connected Git Accounts:'));
    connections.forEach((conn) => {
      console.log(chalk.green(`  ✅ ${conn.gitHost} (${conn.gitUsername})`));
    });
  } else {
    console.log(chalk.gray('\n🔐 No Git accounts connected'));
    console.log(chalk.gray('   Connect: saac git connect'));
  }
} catch (error) {
  // Non-fatal, just skip OAuth section
  console.log(chalk.gray('\n🔐 OAuth status unavailable'));
}
```

---

### Task 5: Update Documentation

**File**: `README.md`

Add OAuth section:

```markdown
## Git Authentication

saac-cli supports two methods for Git authentication:

### Method 1: OAuth (Recommended)

Connect your Git account once, deploy unlimited applications:

```bash
# Connect Git account
saac git connect git.startanaicompany.com
# Opens browser for authentication

# List connected accounts
saac git list

# Disconnect account
saac git disconnect git.startanaicompany.com

# Create app - no token needed!
saac create my-app --git git@git.startanaicompany.com:user/repo.git
```

### Method 2: Manual Token

Provide Git API token for each application:

```bash
saac create my-app \
  --git git@git.startanaicompany.com:user/repo.git \
  --git-token your_gitea_token_here
```

**OAuth automatically tries first, falls back to manual token if not connected.**
```

---

## Implementation Checklist

### Phase 1: Core OAuth Support (Week 1)
- [ ] Create `lib/oauth.js` with OAuth helper functions
- [ ] Install dependencies: `npm install open axios crypto`
- [ ] Test OAuth flow manually with wrapper API
- [ ] Verify polling works correctly

### Phase 2: Update Commands (Week 2)
- [ ] Create `bin/saac-git.js` with `connect`, `list`, `disconnect` subcommands
- [ ] Update `bin/saac-create.js` to auto-prompt for OAuth
- [ ] Update `bin/saac-status.js` to show OAuth connections
- [ ] Register `git` command in main `bin/saac.js`

### Phase 3: Testing (Week 3)
- [ ] Test OAuth flow with Gitea (git.startanaicompany.com)
- [ ] Test OAuth flow with GitHub (github.com)
- [ ] Test application creation with OAuth token
- [ ] Test fallback to manual `--git-token`
- [ ] Test error handling (expired sessions, timeouts)
- [ ] Test `saac git list` and `saac git disconnect`

### Phase 4: Documentation & Release (Week 4)
- [ ] Update README.md with OAuth documentation
- [ ] Create migration guide for existing users
- [ ] Update examples in all command files
- [ ] Create demo video/GIF showing OAuth flow
- [ ] Announce OAuth support to users

---

## Testing Guide

### Test 1: OAuth Connection Flow

```bash
# Set API key
export WRAPPER_API_KEY="cw_your_key_here"

# Test connect command
saac git connect git.startanaicompany.com

# Expected:
# - Browser opens to OAuth page
# - User authorizes
# - CLI shows "✅ Connected to git.startanaicompany.com as username"
```

### Test 2: List Connections

```bash
saac git list

# Expected output:
# 🔐 Connected Git Accounts:
#
# 1. git.startanaicompany.com
#    Username: mikael.westoo
#    Provider: gitea
#    Expires: 2026-01-26 13:00:00
#    Last used: 2026-01-26 12:30:00
```

### Test 3: Create App with OAuth

```bash
saac create test-oauth-app \
  --git git@git.startanaicompany.com:user/repo.git \
  --subdomain testoauth

# Expected:
# ✅ Using connected account: mikael.westoo@git.startanaicompany.com
# 📦 Creating application...
# ✅ Application created successfully!
```

### Test 4: Create App Without OAuth (Should Prompt)

```bash
# Disconnect first
saac git disconnect git.startanaicompany.com

# Try to create without --git-token
saac create test-app --git git@git.startanaicompany.com:user/repo.git

# Expected:
# ⚠️  Git account not connected for git.startanaicompany.com
# Would you like to connect now? (Y/n):
```

### Test 5: Fallback to Manual Token

```bash
saac create test-manual \
  --git git@git.startanaicompany.com:user/repo.git \
  --git-token gto_your_token_here

# Expected:
# ✅ Application created successfully!
# (Using manual token, not OAuth)
```

---

## Error Handling

### Common Errors & Solutions

**1. "OAuth session not found or expired"**
- User took too long to authorize (>10 minutes)
- Solution: Try `saac git connect` again

**2. "OAuth authorization timed out (5 minutes)"**
- Polling timed out waiting for user
- Solution: Increase `maxAttempts` in `pollForCompletion()`

**3. "Git account not connected"**
- User hasn't connected Git account yet
- Solution: Prompt to run `saac git connect <host>`

**4. Browser doesn't open automatically**
- `open` package failed on some systems
- Solution: Display URL and ask user to open manually

**5. "Invalid Git repository URL format"**
- Repository URL not in SSH or HTTPS format
- Solution: Show expected formats in error message

---

## Architecture Notes

### Why git_host Instead of Provider Name?

**User-Friendly:**
- Users know "git.startanaicompany.com" (from their repository URL)
- Users DON'T know "gitea" vs "github" vs "gitlab"

**Example:**
```bash
# ❌ Confusing (users don't know provider names)
saac git connect gitea

# ✅ Clear (users recognize the domain)
saac git connect git.startanaicompany.com
```

### Auto-Detection Flow

```
Repository URL: git@git.startanaicompany.com:user/repo.git
         ↓
Extract git_host: git.startanaicompany.com
         ↓
Check OAuth connection for git.startanaicompany.com
         ↓
    Connected?
    ├─ YES → Use OAuth token (automatic)
    └─ NO → Fall back to --git-token (if provided)
```

### Security Considerations

1. **API Key Storage**: Never commit API keys, always use environment variables
2. **OAuth State**: Wrapper handles CSRF protection with state parameter
3. **Token Storage**: Wrapper encrypts tokens (AES-256-GCM), CLI never stores tokens
4. **Session IDs**: Use crypto.randomBytes() for unpredictable session IDs
5. **Polling Timeout**: Limit polling to prevent infinite loops (5 minutes max)

---

## Dependencies

### Required npm Packages

```json
{
  "dependencies": {
    "axios": "^1.6.0",
    "chalk": "^4.1.2",
    "commander": "^11.0.0",
    "open": "^10.0.0"
  }
}
```

**Install:**
```bash
cd ~/projects/saac-cli
npm install open axios
```

---

## Wrapper API Contract

### What Wrapper Guarantees

1. **OAuth Flow**: Redirects to correct provider based on git_host
2. **Token Management**: Auto-refreshes expired tokens (1-hour expiration)
3. **Fallback**: Always supports manual `git_api_token` as fallback
4. **Error Messages**: Provides actionable error messages with OAuth URLs
5. **Multi-Provider**: Supports Gitea, GitHub, GitLab without CLI changes

### What CLI Must Do

1. **Extract git_host**: Parse repository URL to get git_host domain
2. **Prompt User**: Ask user to connect if OAuth not available and no token provided
3. **Poll Session**: Poll `/oauth/poll/:session_id` every 2 seconds until completed
4. **Handle Timeouts**: Abort after 5 minutes with clear error message
5. **Show Feedback**: Display connection status and connected username

---

## Timeline & Milestones

### Week 1: Foundation
- Implement `lib/oauth.js`
- Test OAuth flow manually with curl
- Verify polling mechanism works

### Week 2: Integration
- Update `saac create` command
- Implement `saac git` commands
- Update `saac status` command

### Week 3: Testing
- End-to-end testing with Gitea
- End-to-end testing with GitHub
- Error scenario testing
- Performance testing (polling overhead)

### Week 4: Release
- Documentation updates
- Migration guide for existing users
- Release notes
- User announcement

---

## Support & Questions

**Wrapper API Status**: ✅ PRODUCTION READY (commit a0d171a)
**Documentation**: All docs in `~/projects/coolifywrapper/*.md`
**OAuth Endpoints**: https://apps.startanaicompany.com/oauth/*

**Key Reference Files:**
- `~/projects/coolifywrapper/OAUTH_USER_FLOW_CORRECTED.md` - Complete user flow
- `~/projects/coolifywrapper/OAUTH_IMPLEMENTATION_ARCHITECTURE.md` - Technical details
- `~/projects/coolifywrapper/src/routes/oauth.js` - Endpoint implementation

**Contact**: Check wrapper deployment status at https://apps.startanaicompany.com/api/v1/health

---

**READY TO IMPLEMENT** 🚀

All backend infrastructure is complete. CLI team can start implementation immediately.
