# CLAUDE.md

This file provides guidance to Claude Code when working with the SAAC CLI codebase.

## Project Overview

SAAC CLI is the official command-line interface for StartAnAiCompany.com. Built with Node.js and Commander.js, it interfaces with a wrapper API that manages Coolify deployments.

**Current Version:** 1.9.2

## Development Commands

```bash
npm run dev      # Run CLI locally
npm run lint     # Lint code
npm link         # Link for local testing
```

## Architecture

### Configuration System

**Global Config** (`~/.config/startanaicompany/config.json`):
- User credentials (email, userId, sessionToken, expiresAt)
- API URLs (wrapper API, Git server)
- Uses `conf` package with explicit path (avoids `-nodejs` suffix)

**Project Config** (`.saac/config.json`):
- Application data (applicationUuid, applicationName, subdomain, gitRepository)
- Required for deployment commands

### API Client (`src/lib/api.js`)

- Axios-based HTTP client
- Auto-injects auth headers (X-Session-Token or X-API-Key)
- 30-second timeout
- Returns response.data directly

### Logger (`src/lib/logger.js`)

Uses chalk, ora, and boxen for formatted output:
- `logger.success()`, `logger.error()`, `logger.warn()`, `logger.info()`
- `logger.spinner(text)` - For async operations
- `logger.section(title)` - Bold headers
- `logger.field(key, value)` - Key-value pairs

### Command Structure Pattern

All commands follow this pattern:
1. Validate required flags (no interactive prompts except `init`, `logout-all`, `git connect`)
2. Check authentication with `ensureAuthenticated()` (auto-login via env vars)
3. Check project config with `getProjectConfig()` (if needed)
4. Execute with spinner feedback
5. Handle errors and exit with code 0/1

**Error Handling:**
```javascript
try {
  // command logic
} catch (error) {
  logger.error(error.response?.data?.message || error.message);
  process.exit(1);
}
```

### Polling Mechanism Pattern (v1.9.0)

Used for async operations (exec, db commands):

```javascript
async function pollForResult(applicationUuid, commandId, commandType, maxWaitSeconds = 120) {
  const startTime = Date.now();
  const pollInterval = 1000; // 1 second

  while (true) {
    const elapsed = (Date.now() - startTime) / 1000;

    if (elapsed > maxWaitSeconds) {
      throw new Error(`Command timed out after ${maxWaitSeconds} seconds`);
    }

    try {
      const result = await api.getDbCommandResult(applicationUuid, commandType, commandId);

      if (result.status === 'completed') {
        return result;
      }

      if (result.status === 'failed') {
        const errorMsg = result.result?.error || result.error || 'Command failed';
        throw new Error(errorMsg);
      }

      // Still pending, wait and retry
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    } catch (error) {
      // If error is not a 404 (command not found yet), rethrow
      if (error.response?.status !== 404) {
        throw error;
      }
      // 404 means command not processed yet, keep polling
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }
}
```

**Key points:**
- Universal polling endpoint: `/db/result/:commandId`
- 1-second poll interval
- 120-second default timeout
- Handles 404 (command not ready yet) vs other errors
- Returns result object with status, result, timestamps

## Authentication Flow

### Session Tokens (Primary Method)
- 1-year expiration
- Stored in global config
- Header: `X-Session-Token`

### Auto-Login (CI/CD)
- Set `SAAC_USER_API_KEY` and `SAAC_USER_EMAIL` env vars
- `ensureAuthenticated()` checks env vars and auto-logs in
- Subsequent commands use cached session (fast path)

### Authentication Priority
```javascript
// In api.js createClient():
if (process.env.SAAC_API_KEY) headers['X-API-Key'] = ...;        // 1st
else if (user.sessionToken) headers['X-Session-Token'] = ...;     // 2nd
else if (user.apiKey) headers['X-API-Key'] = ...;                 // 3rd
```

## Key Command Implementations

### Create Command
**Required flags:** `-s subdomain`, `-r repository`, `--org organization_id`
**Optional:** OAuth replaces `-t git-token` if connected

```bash
saac create my-app -s myapp -r git@git... --org 525ff3e4-...
```

Waits for deployment (30-120s typical, 5min max). Returns `success: true/false`.

### Logs Command (v1.6.0)
**Deployment logs:** `saac logs --deployment [uuid]`
**Runtime logs:** `saac logs --follow --type access`

SSE streaming implementation:
- Native Fetch API with `text/event-stream`
- Parses `data: {...}` lines
- Graceful Ctrl+C cleanup
- Formatted: `12:38:32 PM [service] message`
- Types: access (Traefik), runtime (container), build

### Git OAuth
**Commands:** `git connect/list/disconnect`
**Flow:** Browser OAuth → CLI polls every 2s → Connection saved (AES-256-GCM encrypted)

### Remote Execution (v1.9.1)
```bash
saac exec "npm run migrate"          # Execute command
saac exec --history                  # View history
```
**Implementation:** SSE command channel with polling mechanism
**Security:** Command allowlist, dangerous pattern detection, rate limiting (30/5min)
**Performance:** ~500ms average response time

### Database Management (v1.9.0)
```bash
saac db list                         # List database containers
saac db sql "SELECT * FROM users"    # Execute SQL query (read-only)
saac db sql "INSERT INTO..." --write # Write operation (requires flag)
saac db sql "SELECT..." --db mydb    # Target specific database
saac db redis GET mykey              # Execute Redis command
saac db info                         # Show database connection info
```
**Implementation:** SSE command channel with universal polling endpoint
**Security:** Read-only by default, --write flag for modifications, rate limiting (60/5min)
**Performance:** ~1s average response time

## API Endpoints (v1.9.0)

```
POST   /api/v1/users/register
POST   /api/v1/auth/login
GET    /api/v1/users/me
POST   /api/v1/applications                    # --org required
PATCH  /api/v1/applications/:uuid
POST   /api/v1/applications/:uuid/deploy
GET    /api/v1/applications/:uuid/logs         # ?follow=true for SSE
GET    /api/v1/applications/:uuid/env/export

# Remote Execution (v1.9.1)
POST   /api/v1/applications/:uuid/exec         # Queue command
GET    /api/v1/applications/:uuid/db/result/:commandId  # Universal polling

# Database Management (v1.9.0)
GET    /api/v1/applications/:uuid/db/containers
GET    /api/v1/applications/:uuid/db/info      # Instant response
POST   /api/v1/applications/:uuid/db/sql       # Queue SQL query
POST   /api/v1/applications/:uuid/db/redis     # Queue Redis command

# OAuth (no /api/v1 prefix)
GET    /oauth/authorize
GET    /oauth/poll/:session_id
```

## Critical Bugs Fixed (v1.6.0)

1. **whoami verified field:** Changed `verified` → `email_verified`
2. **keys show removed:** API keys are write-once, never readable
3. **delete message:** Use `app.name` not `result.application_name`
4. **organization_id:** Added required `--org` flag to create command

## Testing Methodology

**Process:**
1. Test ONE feature at a time
2. HIVE message to backend for validation
3. Backend checks database/containers
4. Fix bugs immediately
5. Move to next feature

**Comprehensive tests completed:**
- Authentication, auto-login, API keys
- Git OAuth, application management
- Environment/domain, logs, streaming
- Database management (SQL queries, Redis commands)
- Remote execution (allowed/blocked commands)
- Error handling and user experience
- Real app testing (golden-68-rekrytering-9jsq1e)

**v1.9.0 Database Testing:**
- Created test_users table with INSERT/SELECT operations
- Tested PostgreSQL meta-queries (list databases, tables, schemas)
- Tested Redis commands (PING, SET, GET, HGETALL)
- Created new database (test_cli_db) with products table
- Validated --write flag enforcement
- Validated --db flag for targeting specific databases

**v1.9.1/v1.9.2 Exec Testing:**
- Tested allowed commands (npm, node, ls, cat, pwd)
- Tested blocked commands (whoami, ps, kill)
- Validated error messages and UX improvements
- Confirmed ~500ms average response time

## Publishing Checklist

1. Test all new features with live backend
2. Check syntax: `node -c src/**/*.js bin/*.js`
3. Update version in package.json
4. Update CLAUDE.md
5. Git commit and push
6. `npm publish --access public`

## Release Notes

### Version 1.9.2 (Current)
**Bug Fixes:**
- Fixed exec error handling to use correct backend field (`data.error` not `data.message`)
- Improved error messages for blocked commands
- Updated allowed commands list to match backend implementation

### Version 1.9.1
**Improvements:**
- Fixed `saac exec` to use SSE command channel with polling
- Migrated from direct docker exec to daemon-based execution
- Average response time improved to ~500ms (from 30s timeout)

### Version 1.9.0
**New Features:**
- **Database Management Commands:**
  - `saac db list` - List database containers (postgres, redis, etc.)
  - `saac db sql <query>` - Execute SQL queries (read-only by default)
  - `saac db redis <command>` - Execute Redis commands
  - `saac db info` - Show database connection information
- Read-only by default with `--write` flag for modifications
- `--db` flag to target specific databases
- Rate limiting: 60 queries per 5 minutes
- Universal polling endpoint for all async operations

**Implementation:**
- Created `src/commands/db.js` (416 lines)
- Added 5 new API client methods in `src/lib/api.js`
- Polling mechanism with 1s interval, 120s timeout
- Formatted table output for query results

### Version 1.8.0
**Improvements:**
- Made deploy streaming the default behavior
- Improved deploy command performance

### Version 1.7.0
**New Features:**
- Deploy streaming support
- No-cache deployment option

### Version 1.6.0
**New Features:**
- SSE streaming for real-time logs (`--follow`)
- Log type filtering (`--type access/runtime/build`)
- Formatted log display with timestamps
- Traefik access log integration

**Bug Fixes:**
- Fixed whoami verified field
- Removed keys show command
- Fixed delete success message
- Added organization_id requirement

**Breaking Changes:**
- `saac create` requires `--org` flag
- `saac keys show` removed

## Key Files & Structure

```
saac-cli/
├── bin/
│   └── saac.js                 # CLI entry point, all command definitions
├── src/
│   ├── commands/
│   │   ├── auth.js            # login, logout, register, verify
│   │   ├── create.js          # create applications
│   │   ├── db.js              # database management (v1.9.0)
│   │   ├── deploy.js          # deploy command
│   │   ├── exec.js            # remote execution (v1.9.1)
│   │   ├── git.js             # Git OAuth
│   │   ├── keys.js            # API key management
│   │   ├── logs.js            # log streaming (v1.6.0)
│   │   └── ...                # other commands
│   └── lib/
│       ├── api.js             # Axios client, all API methods
│       ├── config.js          # Config management, auth checking
│       └── logger.js          # Formatted output utilities
├── package.json               # Version, dependencies, bin script
├── README.md                  # Public documentation
└── CLAUDE.md                  # AI agent instructions (this file)
```

**Critical files for new features:**
1. `bin/saac.js` - Add new command definitions
2. `src/commands/<feature>.js` - Implement command logic
3. `src/lib/api.js` - Add API client methods
4. `package.json` - Update version number
5. `README.md` - Document public-facing features
6. `CLAUDE.md` - Update AI agent instructions

## Dependencies

- axios, chalk, commander, conf, inquirer, ora, boxen, table, validator, dotenv, open, ws

## Status Values

- `running:healthy/unknown` → Green "Running ✓"
- `active` → Green "Active ✓"
- `creating` → Yellow "Creating..."
- `stopped` → Yellow "Stopped"
- `error` → Red "Error ✗"
- `suspended` → Yellow "Suspended ⚠"

## Important Patterns

**ensureAuthenticated() usage:**
- Use in ALL non-auth commands (deploy, list, create, etc.)
- Do NOT use in: login, logout, register, verify

**Project config requirement:**
- All app-specific commands need `.saac/config.json`
- Created by: `saac init` or `saac create`

**Token validation:**
- `isAuthenticated()` - Checks local session expiration
- `ensureAuthenticated()` - Checks session + auto-login via env vars

**Never truncate sensitive data:**
- Show FULL API keys when displayed (they're only shown once)
- Same for session tokens during verification

**Database command patterns:**
- Always use `--write` flag for INSERT, UPDATE, DELETE, DROP, TRUNCATE
- Use `--db` flag to target specific databases (defaults to env vars)
- Format query results as tables using `table` package
- Handle CSV output from backend (comma-separated rows)

**Exec error handling (v1.9.2):**
- 400 errors = command not allowed (show clear message with allowlist)
- 408 errors = timeout (suggest increasing --timeout)
- 429 errors = rate limit exceeded (30 commands per 5 minutes)
- 503 errors = container not running
- Backend error field is `data.error` (not `data.message`)
- Show full backend error message with context

## HIVE Collaboration

**Agent Names:**
- CLI Developer: `saac-saac-clitool-developer`
- Backend Developer: `saac-owndockermachine-backend-developer`
- Workspace Backend: `saac-workspace-backend-developer`
- Orchestrator: `saac-orchestrator-backend-developer`

**Collaboration Workflow:**
1. Poll HIVE regularly when implementing new features
2. Coordinate with backend developers for API changes
3. Validate implementations with backend team
4. Share knowledge and best practices with other agents
5. Document all architectural decisions

**Example Communication:**
- Request API endpoint specifications
- Confirm error response formats
- Validate security patterns
- Share implementation guides for other teams
- Debug issues collaboratively

## MailHog & Testing

- MailHog URL: https://mailhog.goryan.io
- Default domain: `{subdomain}.startanaicompany.com`
- Git server: https://git.startanaicompany.com
- Test app: golden-68-rekrytering-9jsq1e
