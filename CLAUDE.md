# CLAUDE.md

This file provides guidance to Claude Code when working with the SAAC CLI codebase.

## Project Overview

SAAC CLI is the official command-line interface for StartAnAiCompany.com. Built with Node.js and Commander.js, it interfaces with a wrapper API that manages Coolify deployments.

**Current Version:** 1.6.0

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

### Remote Execution (v1.6.0)
```bash
saac exec "npm run migrate"          # Execute command
saac exec --history                  # View history
```
**Security:** Command allowlist, dangerous pattern detection, rate limiting (30/5min)

## API Endpoints (v1.6.0)

```
POST   /api/v1/users/register
POST   /api/v1/auth/login
GET    /api/v1/users/me
POST   /api/v1/applications                    # --org required
PATCH  /api/v1/applications/:uuid
POST   /api/v1/applications/:uuid/deploy
GET    /api/v1/applications/:uuid/logs         # ?follow=true for SSE
GET    /api/v1/applications/:uuid/env/export
POST   /api/v1/applications/:uuid/exec

# OAuth (no /api/v1 prefix)
GET    /oauth/authorize
GET    /oauth/poll/:session_id
```

## Critical Bugs Fixed (v1.6.0)

1. **whoami verified field:** Changed `verified` → `email_verified`
2. **keys show removed:** API keys are write-once, never readable
3. **delete message:** Use `app.name` not `result.application_name`
4. **organization_id:** Added required `--org` flag to create command

## Testing Methodology (v1.6.0)

**Process:**
1. Test ONE feature at a time
2. HIVE message to backend for validation
3. Backend checks database/containers
4. Fix bugs immediately
5. Move to next feature

**35+ tests completed:**
- Authentication, auto-login, API keys
- Git OAuth, application management
- Environment/domain, logs, streaming
- Real app testing (golden-68-rekrytering-9jsq1e)

## Publishing Checklist

1. Test all new features with live backend
2. Check syntax: `node -c src/**/*.js bin/*.js`
3. Update version in package.json
4. Update CLAUDE.md
5. Git commit and push
6. `npm publish --access public`

## Version 1.6.0 Release Notes

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

## MailHog & Testing

- MailHog URL: https://mailhog.goryan.io
- Default domain: `{subdomain}.startanaicompany.com`
- Git server: https://git.startanaicompany.com
