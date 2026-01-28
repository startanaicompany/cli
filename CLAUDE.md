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

**Exceptions to Non-Interactive Rule:**
- `saac init` - Uses inquirer to select from existing applications (intentionally interactive)
- `saac logout-all` - Confirmation prompt (can be skipped with `-y` flag)
- `saac git connect` - Interactive provider selection when no host specified

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
- Authentication: `register.js`, `login.js`, `verify.js`, `logout.js`, `logoutAll.js`, `sessions.js`, `whoami.js` (stub)
- Git OAuth: `git.js` (exports object with `connect`, `list`, `disconnect` methods)
- App Management: `create.js`, `init.js`, `deploy.js`, `update.js`, `delete.js` (stub), `list.js`, `status.js`
- Configuration: `env.js` (stub), `domain.js` (stub)
- Logs: `logs.js` (stub)

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

**Deployment Behavior (NEW):**

The `create` command now **waits for the initial deployment to complete** (up to 5 minutes) before returning.

**Response Time:**
- Typical: 30-120 seconds
- Maximum: 5 minutes (timeout)

**Success Response:**
```json
{
  "success": true,
  "coolify_app_uuid": "...",
  "app_name": "my-app",
  "domain": "https://myapp.startanaicompany.com",
  "deployment_status": "finished",
  "deployment_uuid": "...",
  "git_branch": "master"
}
```

**Failure Response (HTTP 200 with success: false):**
```json
{
  "success": false,
  "coolify_app_uuid": "...",
  "app_name": "my-app",
  "deployment_status": "failed",
  "message": "Port 8080 is already in use. Remove host port bindings...",
  "errors": [
    {
      "type": "PORT_CONFLICT",
      "message": "Port 8080 is already in use...",
      "detail": "Bind for 0.0.0.0:8080 failed..."
    }
  ],
  "relevant_logs": [...],
  "last_logs": [...]
}
```

**Error Types:**
- `PORT_CONFLICT` - Host port binding conflict in docker-compose.yml
- `BUILD_FAILED` - Build process returned non-zero exit code
- `TIMEOUT` - Deployment didn't complete in 5 minutes
- `UNKNOWN` - Generic deployment failure

**Important Notes:**
1. **Application is created even if deployment fails** - the UUID is saved to `.saac/config.json`
2. Failed deployments return HTTP 200 (not 4xx) with `success: false`
3. CLI must check the `success` field, not just HTTP status code
4. Detailed error information is displayed with actionable advice
5. User can fix the issue and run `saac deploy` to retry

**Error Display:**
The CLI displays comprehensive error information:
- Error summary message
- Structured error details with types
- Relevant error logs (filtered)
- Last log lines for context
- Actionable advice based on error type:
  - `PORT_CONFLICT`: Remove host port bindings from docker-compose.yml
  - `BUILD_FAILED`: Check Dockerfile, run `docker build .` locally
  - `TIMEOUT`: Check `saac status` and `saac logs`, may still be running

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
- `src/lib/oauth.js` - OAuth helper functions (exports: `extractGitHost`, `connectGitAccount`, `getConnection`, `listConnections`, `revokeConnection`)
- `src/commands/git.js` - Git command implementation (exports object with `connect`, `list`, `disconnect` methods)
- Updated `src/commands/create.js` - OAuth integration (checks for existing OAuth connection before requiring `--git-token`)

### Deploy Command Implementation

The `deploy` command triggers deployment and **waits for completion** (up to 5 minutes).

**Usage:**
```bash
saac deploy
saac deploy --force
```

**How It Works:**
1. Validates authentication (session token not expired)
2. Checks for project config (`.saac/config.json`)
3. Makes POST request to `/api/v1/applications/:uuid/deploy`
4. **Waits for deployment to complete** (up to 5 minutes)
5. Displays deployment status with detailed error information on failure

**Response Time:**
- Typical: 30-120 seconds
- Maximum: 5 minutes (timeout)

**Success Response:**
```json
{
  "success": true,
  "status": "finished",
  "deployment_uuid": "...",
  "git_branch": "master",
  "domain": "https://myapp.startanaicompany.com",
  "traefik_status": "queued"
}
```

**Failure Response:**
```json
{
  "success": false,
  "status": "failed",
  "message": "Build failed with exit code 1",
  "errors": [
    {
      "type": "BUILD_FAILED",
      "message": "Build failed with exit code 1",
      "detail": "npm ERR! code ELIFECYCLE..."
    }
  ],
  "relevant_logs": [...],
  "last_logs": [...]
}
```

**Error Types:**
- `PORT_CONFLICT` - Host port binding conflict
- `BUILD_FAILED` - Build process failed
- `TIMEOUT` - Deployment didn't complete in 5 minutes
- `UNKNOWN` - Generic failure

**Error Display:**
The CLI displays:
1. Error summary message
2. Structured error details with types
3. Relevant logs (filtered error logs)
4. Last 5 log lines for context
5. Actionable advice based on error type
6. Suggestion to view full logs with `saac logs --follow`

**Note:** The `--force` flag is defined in the CLI but not currently used by the API.

### OTP-Based Login (NEW in 1.4.16)

The login command now supports two authentication methods:

**Method 1: Login with API Key (Fast Path)**
```bash
saac login -e user@example.com -k cw_abc123
# → Immediate session token, no email verification needed
```

**Method 2: Login with OTP (Recovery Path)**
```bash
# Step 1: Request OTP
saac login -e user@example.com
# → Verification code sent to email (6 digits, 5-minute expiration)

# Step 2: Verify OTP
saac login -e user@example.com --otp 123456
# → Session token created, user is now logged in
```

**Why This Feature?**

Solves the **API key lockout problem**:
- User loses API key
- All sessions expire
- Cannot login (no API key)
- Cannot regenerate key (requires login)
- **LOCKED OUT** ❌

With OTP login:
- User can always recover via email ✅
- No support tickets needed ✅
- Self-service account recovery ✅

**Implementation Details:**

The `login.js` command now has three modes:
1. **API key login** - If `-k` flag provided (existing flow)
2. **OTP request** - If no `-k` or `--otp` flag (new flow)
3. **OTP verification** - If `--otp` flag provided (new flow)

**Backend Requirements:**
- `POST /api/v1/auth/login-otp` - Generate and send OTP
- `POST /api/v1/auth/verify-otp` - Verify OTP and create session

See `/data/sharedinfo/login-feature-update.md` for complete API specifications.

### API Key Management (NEW in 1.4.16)

Users can now regenerate their API keys if lost or compromised.

**Commands:**

```bash
# Regenerate API key (requires authentication)
saac keys regenerate
# → Shows new API key (only once!)

# Show API key info
saac keys show
# → Displays key prefix, created date, last used
```

**Recovery Flow:**

```bash
# 1. User loses API key but is not logged in
saac login -e user@example.com
# → OTP sent to email

# 2. Verify OTP
saac login -e user@example.com --otp 123456
# → Logged in with session token

# 3. Generate new API key
saac keys regenerate
# → New API key: cw_new_key_xyz...

# 4. On next machine, use new API key
saac login -e user@example.com -k cw_new_key_xyz...
```

**Security Notes:**
- Regenerating API key invalidates the old key immediately
- Existing session tokens remain valid (no disruption)
- Email notification sent when key is regenerated
- Full API key shown only once (must be saved)

**Backend Requirements:**
- `POST /api/v1/users/regenerate-key` - Generate new API key
- `GET /api/v1/users/api-key` - Get API key info (optional)

See `/data/sharedinfo/login-feature-update.md` for complete specifications.

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

### List Command Implementation

The `list` command displays all user applications in a formatted table.

**Usage:**
```bash
saac list
saac ls  # Alias
```

**How It Works:**
1. Validates authentication
2. Fetches all applications from `/api/v1/applications`
3. Displays table with columns: Name, Domain, Status, Branch, Created
4. Shows total count and helpful next-step commands

**Status Display:**
Uses the same status display logic as the status command (see "Application Status Values" section).

**Table Formatting:**
- Uses the `table` npm package
- Header shows total application count
- Domains fallback to `{subdomain}.startanaicompany.com` if not set
- Branch defaults to 'master' if not specified

### Deployments Command Implementation

The `deployments` command displays deployment history for the current application in a formatted table.

**Usage:**
```bash
saac deployments
saac deploys  # Alias

# With pagination
saac deployments --limit 10
saac deployments --limit 20 --offset 20
```

**How It Works:**
1. Validates authentication (session token not expired)
2. Checks for project config (`.saac/config.json`)
3. Fetches deployment history from `/api/v1/applications/:uuid/deployments`
4. Displays table with columns: UUID, Status, Branch, Commit, Duration, Trigger, Date
5. Shows pagination info if more deployments available

**Options:**
- `-l, --limit <number>` - Number of deployments to show (default: 20)
- `-o, --offset <number>` - Offset for pagination (default: 0)

**Status Display:**
- ✅ `finished` - Displayed in green
- ✗ `failed` - Displayed in red
- ⏳ `running`, `queued` - Displayed in yellow
- `unknown` - Displayed in gray

**Table Formatting:**
- UUID truncated to 26 characters for readability
- Commit SHA truncated to 7 characters
- Duration shown in seconds
- Date formatted with `toLocaleString()`

**Response Fields:**
```json
{
  "deployments": [
    {
      "deployment_uuid": "...",
      "status": "finished",
      "git_branch": "master",
      "git_commit": "abc1234",
      "duration_seconds": 45,
      "triggered_by": "api",
      "started_at": "2024-01-20T12:00:00Z"
    }
  ],
  "total": 100
}
```

**Next Steps:**
After viewing deployment history, use:
- `saac logs --deployment` - View latest deployment logs
- `saac logs --deployment <uuid>` - View specific deployment logs

### Logs Command Implementation

The `logs` command displays application logs with support for both deployment logs (build logs) and runtime logs (container logs).

**Usage:**
```bash
# View latest deployment logs (build logs)
saac logs --deployment
saac logs -d

# View specific deployment logs
saac logs --deployment abc123-def456-...
saac logs abc123-def456-... --deployment

# View deployment logs in raw format
saac logs --deployment --raw

# View runtime logs (container logs)
saac logs
saac logs --tail 200
saac logs --follow
saac logs --since 1h
```

**Two Modes:**

**1. Deployment Logs Mode (Build Logs)**
- Enabled with `--deployment` flag
- Shows logs from the build/deployment process
- Includes build output, errors, and deployment status
- Supports both parsed (colorized) and raw formats

**Options:**
- `--deployment [uuid]` - View deployment logs (omit UUID for latest)
- `--raw` - Show raw log output (no parsing or colorization)
- `--include-hidden` - Include hidden log lines

**Display:**
- Header with deployment UUID, status, commit, duration
- Parsed logs with stderr highlighted in red
- Error summary if deployment failed
- Structured error information with types and details

**2. Runtime Logs Mode (Container Logs)**
- Default mode when no `--deployment` flag
- Shows logs from the running container
- Real-time application output

**Options:**
- `-t, --tail <lines>` - Number of lines to show (default: 100)
- `-f, --follow` - Follow log output (not yet implemented)
- `--since <time>` - Show logs since timestamp

**Error Handling:**
- 404 error → No deployments found, suggests `saac deploy`
- 501 error → Runtime logs not implemented, suggests deployment logs

**Response Fields (Deployment Logs):**
```json
{
  "deployment_uuid": "...",
  "status": "finished",
  "commit": "abc1234",
  "commit_message": "Fix bug",
  "started_at": "2024-01-20T12:00:00Z",
  "finished_at": "2024-01-20T12:02:00Z",
  "duration_seconds": 120,
  "log_count": 150,
  "logs": [
    {
      "type": "stdout",
      "output": "Installing dependencies..."
    },
    {
      "type": "stderr",
      "output": "npm WARN deprecated package@1.0.0"
    }
  ],
  "raw_logs": "...",
  "errors": [
    {
      "type": "BUILD_FAILED",
      "message": "Build failed with exit code 1",
      "detail": "npm ERR! code ELIFECYCLE"
    }
  ]
}
```

### Incomplete Commands

Several commands still need implementation:
- `src/commands/env.js` - Not implemented (stub only)
- `src/commands/domain.js` - Not implemented (stub only)
- `src/commands/delete.js` - Not implemented (stub only)
- `src/commands/whoami.js` - Not implemented (stub only)

**Important:** The `env` and `domain` commands need to export OBJECTS with subcommand methods (e.g., `module.exports = { set, get, list }`), not simple functions. See `bin/saac.js:189-219` for how these are called.

**Implementation Pattern for New Commands:**
1. Require flags, no interactive prompts (exception: `init` uses inquirer for app selection)
2. Show usage info if required flags missing
3. Validate inputs before API calls
4. Use spinners for async operations
5. Handle errors with descriptive messages

**Example Module Structure for env.js:**
```javascript
async function set(vars) { /* implementation */ }
async function get(key) { /* implementation */ }
async function list() { /* implementation */ }

module.exports = { set, get, list };
```

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

## Current Status - Version 1.4.17

### Completed Features

**Authentication & Sessions:**
- ✅ `saac register` - Register with email only (git_username auto-detected from email)
- ✅ `saac login` - Two methods: API key (fast) or OTP (recovery)
  - `saac login -e email -k api-key` - Login with API key
  - `saac login -e email` - Request OTP via email
  - `saac login -e email --otp code` - Verify OTP and login
- ✅ `saac verify` - Email verification, shows FULL API key for user to save
- ✅ `saac logout` - Logout from current device
- ✅ `saac logout-all` - Revoke all sessions
- ✅ `saac sessions` - List all active sessions
- ✅ `saac whoami` - Show current user info

**API Key Management (NEW in 1.4.16):**
- ✅ `saac keys regenerate` - Generate new API key (invalidates old one)
- ✅ `saac keys show` - Show API key information (prefix, created, last used)

**Git OAuth (NEW in 1.4.0):**
- ✅ `saac git connect [host]` - OAuth flow for Git authentication
- ✅ `saac git list` - List connected Git accounts
- ✅ `saac git disconnect <host>` - Revoke Git connection
- ✅ OAuth integration in create command (prompts if not connected)

**Application Management:**
- ✅ `saac create` - Create application with ALL advanced features
- ✅ `saac update` - Update application configuration (PATCH endpoint)
- ✅ `saac init` - Link existing application to current directory (interactive)
- ✅ `saac deploy` - Trigger deployment for current application
- ✅ `saac deployments` - List deployment history with table display
- ✅ `saac logs` - View deployment logs (build logs) or runtime logs (container logs)
- ✅ `saac list` - List all applications with table display
- ✅ `saac status` - Show login status, user info, and applications
- ✅ `saac delete` - Delete application with confirmation prompt
- ✅ `saac whoami` - Show current user information

**Environment & Domain Management:**
- ✅ `saac env set/get/list` - Manage environment variables (fully implemented)
- ✅ `saac domain set/show` - Manage application domain (fully implemented)

**All Commands Implemented!** ✅ No incomplete commands remain

### Critical Learnings & Bug Fixes

**Issue 1: Config Location**
- **Problem:** Conf package auto-appended `-nodejs` suffix to folder name
- **Solution:** Use explicit `cwd: path.join(os.homedir(), '.config', 'startanaicompany')` instead of `projectName`
- **Location:** `src/lib/config.js`

**Issue 2: Status Command Showing "Logged in" Then "Expired"**
- **Problem:** Command checked local session first, displayed status, THEN verified with server
- **Solution:** Verify with server FIRST before displaying any status
- **Location:** `src/commands/status.js`

**Issue 3: Application List Inconsistency**
- **Problem:** `/users/me` returned `application_count: 1` but `/applications` returned empty array
- **Root Cause:** Backend filtered by `status='active'` but new apps start with `status='creating'`
- **Solution:** Backend team fixed to filter by `status != 'deleted'`
- **Location:** Backend - `src/services/application.js:447`

**Issue 4: Register Endpoint 404 Error**
- **Problem:** CLI was calling `POST /api/v1/register` but actual endpoint is `POST /api/v1/users/register`
- **Solution:** Changed endpoint path in api.js
- **Location:** `src/lib/api.js:64`

**Issue 5: Deprecated Field Names**
- **Problem:** CLI still used `gitea_username` and `gitea_api_token`
- **Solution:** Renamed to `git_username` and `git_api_token` throughout codebase
- **Affected:** `register.js`, `api.js`, `bin/saac.js`

**Issue 6: Truncated API Key Display**
- **Problem:** Showing truncated API key with "Save this key" message was confusing
- **Solution:** Show FULL API key in verify command (it's only shown once)
- **Location:** `src/commands/verify.js:72`

**Issue 7: Git Username Auto-Detection**
- **Finding:** Server auto-populates `git_username` from email address (e.g., `kalle.johansson@goryan.io` → `kalle.johansson`)
- **Behavior:** This is backend behavior, CLI just displays what server returns
- **No action needed:** Working as designed

### API Endpoint Reference

**Correct Endpoint Paths (v1.4.17):**
- `POST /api/v1/users/register` - Register (email only, git_username optional)
- `POST /api/v1/users/verify` - Verify email with code
- `POST /api/v1/auth/login` - Login with API key, get session token
- `POST /api/v1/auth/logout` - Logout current session
- `POST /api/v1/auth/logout-all` - Revoke all sessions
- `GET /api/v1/auth/sessions` - List all sessions
- `GET /api/v1/users/me` - Get user info
- `GET /api/v1/users/me/oauth` - List OAuth connections
- `DELETE /api/v1/users/me/oauth/:git_host` - Revoke OAuth connection
- `GET /oauth/authorize` - Initiate OAuth flow (no /api/v1 prefix!)
- `GET /oauth/poll/:session_id` - Poll OAuth status (no /api/v1 prefix!)
- `POST /api/v1/applications` - Create application
- `GET /api/v1/applications` - List applications
- `PATCH /api/v1/applications/:uuid` - Update application
- `POST /api/v1/applications/:uuid/deploy` - Deploy application
- `GET /api/v1/applications/:uuid/deployments` - Get deployment history (NEW in 1.4.17)
- `GET /api/v1/applications/:uuid/deployment-logs` - Get deployment logs (NEW in 1.4.17)
- `GET /api/v1/applications/:uuid/logs` - Get runtime logs (container logs)
- `DELETE /api/v1/applications/:uuid` - Delete application

**Important:** OAuth endpoints (`/oauth/*`) do NOT have the `/api/v1` prefix!

### OAuth Implementation Details

**Token Handling:**
- Session tokens start with `st_`
- API keys start with `cw_`
- OAuth helper functions detect token type and use correct header:
  - `st_*` → `X-Session-Token`
  - `cw_*` → `X-API-Key`

**Polling Strategy:**
- Initial 60-second wait before polling starts (gives user time to complete OAuth)
- Poll every 2 seconds for up to 5 minutes
- Handles 401/404 errors during polling (expected while user authorizes)
- Only fails on non-auth errors (500, network errors)

**OAuth URL Construction:**
- Remove `/api/v1` suffix from base URL: `baseUrl.replace('/api/v1', '')`
- OAuth endpoints: `${baseUrl}/oauth/authorize` and `${baseUrl}/oauth/poll/:id`

### Application Status Values

Backend returns these status values (from Coolify):
- `creating` - Application being created (initial state)
- `active` - Fully created and operational
- `running:healthy` - Container running and healthy
- `running:unknown` - Container running, health status unknown
- `stopped` - Container stopped
- `error` - Creation or deployment failed
- `suspended` - Suspended by admin

**CLI Display Logic:**
```javascript
if (status.startsWith('running')) {
  display = 'Running ✓' (green);
} else if (status.startsWith('stopped')) {
  display = 'Stopped' (yellow);
} else {
  switch (status) {
    case 'active': display = 'Active ✓' (green);
    case 'creating': display = 'Creating...' (yellow);
    case 'error': display = 'Error ✗' (red);
    case 'suspended': display = 'Suspended ⚠' (yellow);
  }
}
```

### User Registration & Authentication Flow

**Complete Flow:**
1. `saac register -e user@example.com` → Creates account, sends verification email
2. Check MailHog at https://mailhog.goryan.io for verification code
3. `saac verify 123456` → Verifies email, returns API key (shown in full, only once)
4. `saac login -e user@example.com -k cw_...` → Exchanges API key for 1-year session token
5. Session token saved to `~/.config/startanaicompany/config.json`
6. All future commands use session token automatically

**Note:** User MUST login after verification to get session token. Verification only provides API key.

### Sessions Management Commands

**Sessions Command (`saac sessions`):**
- Lists all active sessions with creation date, last used time, IP address, and expiration
- Uses table format for clear display
- Shows total session count
- Located in `src/commands/sessions.js`

**Logout All Command (`saac logout-all`):**
- Revokes ALL session tokens across all devices
- Requires confirmation prompt unless `--yes` flag provided
- Clears local config after successful revocation
- Shows count of sessions revoked
- Located in `src/commands/logoutAll.js`
- **Exception to non-interactive rule:** Uses inquirer for confirmation prompt (but can be skipped with `-y`)

**Implementation Notes:**
- Both commands check authentication before proceeding
- Handle gracefully if session already expired (401 errors)
- Clear local config even if server call fails

### Testing Considerations

When implementing new commands:
1. Test both with flags and interactive prompts
2. Verify error handling for missing authentication
3. Verify error handling for missing project config
4. Test API error responses
5. Ensure proper exit codes (0 for success, 1 for errors)
6. Check that spinners succeed/fail appropriately
7. **NEVER truncate sensitive data if user needs to save it** (API keys, session tokens)
8. Show full values for one-time credentials

### Publishing Checklist

Before publishing to npm:
1. Verify all new commands work with live backend
2. Test OAuth flow end-to-end
3. Check syntax: `node -c src/**/*.js bin/*.js`
4. Update version in package.json
5. Update CLAUDE.md with changes
6. Run: `npm publish --access public --otp=<code>`

### Dependencies

**Required packages:**
- `axios` - HTTP client for API calls
- `chalk` - Terminal colors
- `commander` - CLI framework
- `conf` - Configuration management
- `inquirer` - Interactive prompts
- `ora` - Spinners
- `boxen` - Boxed messages
- `table` - Table display
- `validator` - Email validation
- `dotenv` - Environment variables
- `open` - Open browser for OAuth (v8.4.2 for compatibility with chalk v4)

**Version:** 1.4.17 (current)
