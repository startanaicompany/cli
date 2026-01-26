# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SAAC CLI is the official command-line interface for StartAnAiCompany.com, enabling users to deploy AI recruitment sites through a wrapper API that interfaces with Coolify. The CLI is built with Node.js and uses the Commander.js framework for command structure.

## Key Commands

### Development
```bash
# Run CLI locally during development
npm run dev

# Lint code
npm run lint

# Link for local testing
npm link
```

### After linking, test with:
```bash
saac --help
saac register
saac login
```

## Architecture

### Configuration System (Dual-Level)

The CLI maintains two separate configuration files:

1. **Global Config** (`~/.config/startanaicompany/config.json`)
   - Managed by the `conf` package with custom cwd path
   - Stores user credentials (email, userId, sessionToken, expiresAt)
   - Stores API URLs (wrapper API, Git server)
   - Persists across all projects
   - Note: Uses explicit path to avoid `-nodejs` suffix that Conf adds by default

2. **Project Config** (`.saac/config.json` in project directory)
   - Manually managed via fs operations
   - Stores application-specific data (applicationUuid, applicationName, subdomain, gitRepository)
   - Required for deployment commands

**Important Pattern**: Commands check both configs:
- Authentication commands → global config only
- Deployment/management commands → require BOTH global config (for auth) and project config (for app UUID)

### API Client (`src/lib/api.js`)

Creates axios instances with:
- Base URL from global config
- X-API-Key header automatically injected from global config
- 30-second timeout
- All API functions are async and return response.data

**API Wrapper Endpoints**:
- `/register` - Create new user account
- `/users/verify` - Email verification
- `/users/me` - Get current user info
- `/applications` - CRUD operations for apps
- `/applications/:uuid/deploy` - Trigger deployment
- `/applications/:uuid/logs` - Fetch logs
- `/applications/:uuid/env` - Manage environment variables
- `/applications/:uuid/domain` - Update domain settings

### Logger (`src/lib/logger.js`)

Centralized logging utility using chalk, ora, and boxen:
- `logger.success()` - Green checkmark messages
- `logger.error()` - Red X messages
- `logger.warn()` - Yellow warning symbol
- `logger.info()` - Blue info symbol
- `logger.spinner(text)` - Returns ora spinner instance
- `logger.section(title)` - Bold cyan headers with underline
- `logger.field(key, value)` - Key-value pair display
- `logger.box(message, options)` - Boxed messages

**Pattern**: Use spinners for async operations:
```javascript
const spin = logger.spinner('Processing...').start();
try {
  await someAsyncOperation();
  spin.succeed('Done!');
} catch (error) {
  spin.fail('Failed');
  throw error;
}
```

### Command Structure

All commands follow this pattern:
1. **Validate required flags** - Show usage if missing (commands are non-interactive by default)
2. Import required libraries (api, config, logger)
3. Check authentication with `isAuthenticated()` (validates session token expiration)
4. Check project config if needed with `getProjectConfig()`
5. Execute operation with spinner feedback
6. Handle errors and exit with appropriate code

**Important:** Commands require flags and do NOT use interactive prompts. This makes them LLM and automation-friendly.

**Examples:**
```bash
# ✅ Correct - with flags
saac register -e user@example.com
saac login -e user@example.com -k cw_api_key

# ❌ Wrong - will show usage error
saac register
saac login
```

**Command Files**:
- Authentication: `register.js`, `login.js`, `verify.js`, `logout.js`, `whoami.js`
- App Management: `create.js`, `init.js`, `deploy.js`, `delete.js`, `list.js`, `status.js`
- Configuration: `env.js`, `domain.js`
- Logs: `logs.js`

### Entry Point (`bin/saac.js`)

Uses Commander.js to define:
- Commands with options and aliases
- Nested commands (e.g., `env set`, `env get`, `domain set`)
- Help text and version info
- Error handling for invalid commands

## Important Patterns

### Authentication Flow

**Session Token Flow (Primary):**
1. User registers with email → API returns session token (1 year expiration)
2. Session token stored in global config with expiration timestamp
3. Verification code sent to MailHog (not real email)
4. User verifies → verified flag set to true
5. All subsequent API requests include X-Session-Token header
6. Token expires after 1 year → user must login again

**API Key Flow (CI/CD & Scripts):**
1. User logs in with email + API key → API returns session token
2. Environment variable `SAAC_API_KEY` can override stored credentials
3. Useful for automation, scripts, and CI/CD pipelines

**Authentication Priority:**
```javascript
// In api.js createClient()
if (process.env.SAAC_API_KEY) {
  headers['X-API-Key'] = SAAC_API_KEY;  // 1st priority
} else if (user.sessionToken) {
  headers['X-Session-Token'] = sessionToken;  // 2nd priority
} else if (user.apiKey) {
  headers['X-API-Key'] = apiKey;  // 3rd priority (backward compat)
}
```

### Application Lifecycle

1. **Create/Init** → applicationUuid saved to `.saac/config.json`
2. **Deploy** → POST to `/applications/:uuid/deploy`
3. **Monitor** → GET `/applications/:uuid/logs`
4. **Update** → PATCH environment or domain
5. **Delete** → DELETE `/applications/:uuid`

### Error Handling Convention

All commands use try-catch with:
```javascript
try {
  // command logic
} catch (error) {
  logger.error(error.response?.data?.message || error.message);
  process.exit(1);
}
```

This pattern extracts API error messages or falls back to generic error message.

## Development Notes

### Session Token Implementation

The CLI now uses session tokens instead of storing permanent API keys:

**Config Storage** (`~/.saac/config.json`):
```json
{
  "user": {
    "email": "user@example.com",
    "userId": "uuid",
    "sessionToken": "st_...",
    "expiresAt": "2026-01-25T12:00:00Z",
    "verified": true
  }
}
```

**Token Validation Functions** (in `config.js`):
- `isAuthenticated()` - Checks if user has valid, non-expired token
- `isTokenExpired()` - Checks if session token has expired
- `isTokenExpiringSoon()` - Checks if token expires within 7 days

**Backend Requirements:**
- `POST /auth/login` - Accepts `X-API-Key` + email, returns session token
- Middleware must accept both `X-Session-Token` and `X-API-Key` headers
- Session tokens expire after 1 year

### Create Command Implementation

The `create` command is fully implemented with ALL backend features:

**Required Options:**
- `-s, --subdomain` - Subdomain for the application
- `-r, --repository` - Git repository URL (SSH format)
- `-t, --git-token` - Git API token for repository access

**Optional Basic Configuration:**
- `-b, --branch` - Git branch (default: master)
- `-d, --domain-suffix` - Domain suffix (default: startanaicompany.com)
- `-p, --port` - Port to expose (default: 3000)

**Build Pack Options:**
- `--build-pack` - Build system: dockercompose, nixpacks, dockerfile, static
- `--install-cmd` - Custom install command (e.g., "pnpm install")
- `--build-cmd` - Custom build command (e.g., "npm run build")
- `--start-cmd` - Custom start command (e.g., "node server.js")
- `--pre-deploy-cmd` - Pre-deployment hook (e.g., "npm run migrate")
- `--post-deploy-cmd` - Post-deployment hook (e.g., "npm run seed")

**Resource Limits:**
- `--cpu-limit` - CPU limit (e.g., "1", "2.5")
- `--memory-limit` - Memory limit (e.g., "512M", "2G")
- Note: Free tier limited to 1 vCPU, 1024M RAM

**Health Checks:**
- `--health-check` - Enable health checks
- `--health-path` - Health check endpoint (default: /health)
- `--health-interval` - Check interval in seconds
- `--health-timeout` - Check timeout in seconds
- `--health-retries` - Number of retries (1-10)

**Environment Variables:**
- `--env KEY=VALUE` - Can be used multiple times (max 50 variables)

**Examples:**
```bash
# Basic application
saac create my-app -s myapp -r git@git.startanaicompany.com:user/repo.git -t abc123

# With build pack and custom port
saac create api -s api -r git@git... -t abc123 --build-pack nixpacks --port 8080

# With health checks and pre-deployment migration
saac create web -s web -r git@git... -t abc123 \
  --health-check \
  --pre-deploy-cmd "npm run migrate" \
  --env NODE_ENV=production \
  --env LOG_LEVEL=info
```

**Implementation Details:**
- Validates all required fields before API call
- Shows configuration summary before creation
- Handles tier-based quota errors (403)
- Handles validation errors (400) with field-specific messages
- Saves project config to `.saac/config.json` after successful creation
- Displays next steps and useful commands

### Update Command Implementation

The `update` command allows modifying application configuration after deployment using `PATCH /api/v1/applications/:uuid`.

**All Configuration Fields Can Be Updated:**
- Basic: name, branch, port
- Build pack and custom commands
- Resource limits (CPU, memory) - capped at tier limits
- Health checks (enable/disable, path, interval, timeout, retries)
- Restart policy (always, on-failure, unless-stopped, no)
- Environment variables

**Important Notes:**
- Only fields you specify will be updated (partial updates)
- Resource limits are enforced by user tier (free: 1 vCPU, 1GB RAM)
- Changes require redeployment to take effect: `saac deploy`
- Requires project config (`.saac/config.json`)

**Examples:**
```bash
# Update port and enable health checks
saac update --port 8080 --health-check --health-path /api/health

# Switch to Nixpacks and update resource limits
saac update --build-pack nixpacks --cpu-limit 2 --memory-limit 2G

# Update custom commands
saac update --pre-deploy-cmd "npm run migrate" --start-cmd "node dist/server.js"

# Disable health checks
saac update --no-health-check

# Update environment variables
saac update --env NODE_ENV=production --env LOG_LEVEL=debug

# Change restart policy
saac update --restart on-failure
```

**Response Behavior:**
- Shows which fields were updated
- Warns if tier limits were applied (resource caps)
- Reminds user to redeploy for changes to take effect

### Git OAuth Commands (NEW in 1.4.0)

The `git` command manages Git account OAuth connections, allowing users to deploy applications without providing tokens repeatedly.

**Subcommands:**
1. `saac git connect [host]` - Connect Git account via OAuth
2. `saac git list` - List all connected Git accounts
3. `saac git disconnect <host>` - Disconnect a Git account

**OAuth Flow:**
1. User runs `saac git connect` or creates app without token
2. Browser opens to OAuth authorization page
3. User authorizes on Git provider (Gitea, GitHub, GitLab)
4. CLI polls for completion every 2 seconds (max 5 minutes)
5. Connection saved on server (encrypted AES-256-GCM)
6. Future app creations use OAuth token automatically

**Usage Examples:**
```bash
# Connect to default Gitea instance
saac git connect git.startanaicompany.com

# Connect from repository URL
saac git connect git@git.startanaicompany.com:user/repo.git

# Interactive mode - select provider
saac git connect

# List connections
saac git list

# Disconnect
saac git disconnect git.startanaicompany.com
```

**Integration with Create Command:**
- If Git account connected → Uses OAuth automatically
- If NOT connected and no `--git-token` → Prompts to connect
- If `--git-token` provided → Uses manual token (fallback)

**Benefits:**
- ✅ Connect once, deploy unlimited apps
- ✅ No need to copy/paste tokens repeatedly
- ✅ Tokens stored encrypted on server
- ✅ Auto-refresh for expired tokens
- ✅ Supports multiple Git providers

**Implementation Files:**
- `src/lib/oauth.js` - OAuth helper functions
- `src/commands/git.js` - Git command implementation
- Updated `src/commands/create.js` - OAuth integration

### Init Command Implementation

The `init` command links an existing SAAC application to the current directory.

**Primary Use Case:** When you clone a Git repository or have an existing project and want to link it to a SAAC application for deployment.

**How It Works:**
1. Checks if directory is already initialized (has `.saac/config.json`)
2. Fetches all user applications from the API
3. Shows interactive list to select which application to link
4. Saves selected application info to `.saac/config.json`

**Usage:**
```bash
# Interactive mode - select from existing applications
cd my-project
saac init
# Select application from list
```

**Behavior:**
- If directory is already initialized, asks for confirmation to re-link
- If user has no applications, suggests using `saac create`
- After initialization, shows available commands (deploy, logs, status, update)

**Note:** The `init` command options (`-n, --name`, etc.) are currently not implemented. To create a new application, use `saac create` instead.

### Incomplete Commands

Several commands still need implementation:
- `src/commands/env.js` - Not implemented (partial stub)
- `src/commands/domain.js` - Not implemented (partial stub)
- `src/commands/logs.js` - Not implemented (partial stub)
- `src/commands/delete.js` - Not implemented (partial stub)
- `src/commands/list.js` - Not implemented (partial stub)
- `src/commands/whoami.js` - Not implemented (partial stub)

These need full implementation following the pattern from completed commands like `create.js` or `login.js`.

**Implementation Pattern for New Commands:**
1. Require flags, no interactive prompts
2. Show usage info if required flags missing
3. Validate inputs before API calls
4. Use spinners for async operations
5. Handle errors with descriptive messages

### MailHog Integration

The system uses MailHog for email verification in development:
- URL: https://mailhog.goryan.io
- Users must manually retrieve verification codes
- Production would use real SMTP

### Domain Configuration

Default domain suffix: `startanaicompany.com`
Applications are accessible at: `{subdomain}.startanaicompany.com`

### Git Repository Integration

The wrapper API expects Git repositories to be hosted on the StartAnAiCompany Gitea instance:
- Gitea URL: https://git.startanaicompany.com
- During registration, Gitea username can be auto-detected or manually provided
- Applications reference repositories in the format: `git@git.startanaicompany.com:user/repo.git`

## Testing Considerations

When implementing new commands:
1. Test both with flags and interactive prompts
2. Verify error handling for missing authentication
3. Verify error handling for missing project config
4. Test API error responses
5. Ensure proper exit codes (0 for success, 1 for errors)
6. Check that spinners succeed/fail appropriately
