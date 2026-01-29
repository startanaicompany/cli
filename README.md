# @startanaicompany/cli

> Official CLI for StartAnAiCompany.com - Deploy AI recruitment sites with ease

[![npm version](https://img.shields.io/npm/v/@startanaicompany/cli.svg)](https://www.npmjs.com/package/@startanaicompany/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- ✨ **Simple & Intuitive** - Deploy with a single command
- 🔐 **Secure** - Session token + OAuth-based authentication
- 🚀 **Fast** - Optimized for quick deployments
- 📦 **Zero Configuration** - Works out of the box
- 🎨 **Beautiful CLI** - Color-coded output and progress indicators
- 🔄 **Auto-healing** - Automatically fixes common deployment issues
- 🖥️ **Remote Shell** - Access your container via WebSocket (Project Aurora)
- 🔧 **Remote Execution** - Run commands inside your container
- 📊 **Real-time Logs** - View runtime and deployment logs

## Installation

```bash
npm install -g @startanaicompany/cli
```

## Quick Start

```bash
# 1. Register for an account
saac register -e user@example.com

# 2. Verify your email (check MailHog at https://mailhog.goryan.io)
saac verify 123456

# 3. Login with your API key (shown after verification)
saac login -e user@example.com -k cw_your_api_key_here

# 4. Connect your Git account (OAuth - required!)
saac git connect

# 5. Create a new application
saac create my-app -s myapp -r git@git.startanaicompany.com:user/repo.git

# 6. Deploy!
saac deploy

# 7. View logs
saac logs

# 8. Access your container shell
saac shell
```

---

## Table of Contents

- [Authentication](#authentication)
  - [Register & Login](#register--login)
  - [Session Management](#session-management)
  - [API Keys](#api-keys)
- [Git OAuth](#git-oauth)
- [Application Management](#application-management)
- [Environment Variables](#environment-variables)
- [Remote Access](#remote-access)
  - [Remote Shell (saac shell)](#remote-shell)
  - [Remote Execution (saac exec)](#remote-execution)
  - [Local Development (saac run)](#local-development)
- [Logs & Monitoring](#logs--monitoring)
- [Domain Management](#domain-management)
- [Complete Workflows](#complete-workflows)
- [Troubleshooting](#troubleshooting)

---

## Authentication

### Register & Login

SAAC uses a **session token-based authentication** system for security and ease of use.

#### `saac register -e <email>`

Register for a new account. Your Git username will be auto-detected from your email.

```bash
# Register with email
saac register -e user@example.com

# With custom Git username (optional)
saac register -e user@example.com --git-username myusername
```

**What happens:**
1. Account created in database
2. Verification code sent to email
3. You're prompted to verify your email

**Required:**
- `-e, --email <email>` - Your email address

**Optional:**
- `--git-username <username>` - Git username (auto-detected from email if not provided)

#### `saac verify <code>`

Verify your email address with the 6-digit code from your email.

```bash
saac verify 123456
```

**Important:** The verification response shows your **API key** (starts with `cw_`). **Save this immediately** - it's only shown once!

```
✓ Email verified successfully!

Your API Key (save this now!):

  cw_kgzfNByNNrtrDsAW07h6ORwTtP3POK6O98klH9Rm8jTt9ByHojeH7zDmGwaF

⚠️  This API key is shown only once. Store it securely!
```

**Where to check for codes:** https://mailhog.goryan.io (development environment)

#### `saac login -e <email> -k <api-key>`

Login with your email and API key. This exchanges your permanent API key for a temporary session token (valid for 1 year).

```bash
saac login -e user@example.com -k cw_your_api_key_here
```

**What happens:**
1. API key verified with backend
2. Session token generated (valid for 1 year)
3. Session token stored locally in `~/.config/startanaicompany/config.json`
4. All future commands use session token automatically

**Required:**
- `-e, --email <email>` - Your email address
- `-k, --api-key <key>` - Your API key (from verification step)

**Alternative: OTP Login (Optional)**

You can also login with a one-time password sent to your email:

```bash
saac login -e user@example.com --otp 123456
```

### Session Management

#### `saac sessions`

List all active sessions across all devices.

```bash
saac sessions
```

**Shows:**
- Device/location
- Session creation date
- Last used timestamp
- IP address
- Expiration date

**Example output:**
```
Active Sessions
───────────────

  Session 1
    Created:   Jan 26, 2026, 10:00 AM
    Last Used: Jan 29, 2026, 9:00 AM
    IP:        192.168.1.100
    Expires:   Jan 26, 2027

  Session 2
    Created:   Jan 20, 2026, 2:00 PM
    Last Used: Jan 28, 2026, 5:00 PM
    IP:        10.0.0.50
    Expires:   Jan 20, 2027

Total: 2 active sessions
```

#### `saac logout`

Logout from current device (revokes current session token only).

```bash
saac logout
```

**What happens:**
- Current session token revoked on server
- Local config cleared
- Other devices remain logged in

#### `saac logout-all [-y]`

Logout from **all devices** (revokes all session tokens).

```bash
# With confirmation prompt
saac logout-all

# Skip confirmation
saac logout-all --yes
saac logout-all -y
```

**What happens:**
- ALL session tokens revoked on server
- Local config cleared
- All devices logged out
- You'll need to login again on all devices

**Use case:** Security - if you suspect your session was compromised.

### API Keys

#### `saac keys show`

Show your API key information (masked for security).

```bash
saac keys show
saac keys info  # Alias
```

**Shows:**
- API key (masked)
- Creation date
- Last used timestamp

#### `saac keys regenerate`

Generate a new API key (invalidates the old one).

```bash
saac keys regenerate
```

**⚠️ Warning:** Your old API key will stop working immediately! Save the new key securely.

**What happens:**
1. Old API key invalidated
2. New API key generated
3. New key displayed (only shown once)
4. You'll need to update any scripts/automation using the old key

#### `saac whoami`

Show current user information.

```bash
saac whoami
```

**Shows:**
- Email
- User ID
- Verification status
- Member since date
- Connected Git accounts
- Application quotas
- Available commands

---

## Git OAuth

SAAC CLI uses **OAuth-only authentication** for Git access. You must connect your Git account before creating applications.

### Why OAuth?

**Benefits:**
- ✅ Connect once, deploy unlimited apps
- ✅ No need to remember or manually provide tokens
- ✅ Tokens stored encrypted on server (AES-256-GCM)
- ✅ Auto-refresh for expired tokens
- ✅ Supports multiple Git providers (Gitea, GitHub, GitLab)
- 🔒 More secure than manual token management

### `saac git connect [host]`

Connect a Git account via OAuth.

```bash
# Interactive mode - select from providers
saac git connect

# Connect to specific host
saac git connect git.startanaicompany.com

# Connect from repository URL
saac git connect git@git.startanaicompany.com:user/repo.git
```

**What happens:**
1. Browser opens to OAuth authorization page
2. You authorize on the Git provider
3. CLI polls for completion (every 2 seconds, max 5 minutes)
4. Connection saved encrypted on server
5. Future app creations use this connection automatically

**Example output:**
```
Git OAuth Connection
────────────────────

ℹ Opening browser for OAuth authorization...
ℹ Authorize the application in your browser

⏳ Waiting for authorization... (0s)

✓ Git account connected successfully!

  Provider:  gitea
  Host:      git.startanaicompany.com
  Username:  ryan.gogo
  Expires:   Never (auto-refreshed)

ℹ You can now create applications without providing Git tokens:
  saac create my-app -s myapp -r git@git.startanaicompany.com:user/repo.git
```

### `saac git list`

List all connected Git accounts.

```bash
saac git list
saac git ls  # Alias
```

**Shows:**
- Git host
- Username
- Provider (gitea/github/gitlab)
- Connection date
- Expiration (if applicable)
- Last used timestamp

**Example output:**
```
Connected Git Accounts
──────────────────────

┌─────────────────────────────┬────────────┬──────────┬──────────────┐
│ Host                        │ Username   │ Provider │ Connected    │
├─────────────────────────────┼────────────┼──────────┼──────────────┤
│ git.startanaicompany.com    │ ryan.gogo  │ gitea    │ Jan 26, 2026 │
└─────────────────────────────┴────────────┴──────────┴──────────────┘

Total: 1 connection(s)
```

### `saac git disconnect <host>`

Disconnect (revoke) a Git account connection.

```bash
saac git disconnect git.startanaicompany.com
```

**What happens:**
- OAuth token revoked on server
- Connection removed
- Existing applications continue to work
- New applications will require reconnection

---

## Application Management

### `saac init`

Link an existing SAAC application to the current directory.

```bash
cd my-project
saac init
```

**Use case:** When you:
- Clone a Git repository
- Have an existing project
- Want to manage an application from a different directory

**What it does:**
1. Fetches all your SAAC applications
2. Shows interactive list to select from
3. Saves selected application info to `.saac/config.json`
4. Now you can use `saac deploy`, `saac logs`, etc.

**Example:**
```bash
$ saac init

Select Application
──────────────────

? Which application do you want to link to this directory?
  ❯ mysimpleflowershop (mysimpleflowershop.startanaicompany.com)
    api-server (api.startanaicompany.com)
    landing-page (landing.startanaicompany.com)

✓ Application linked successfully!

ℹ Configuration saved to .saac/config.json
ℹ You can now use:
  saac deploy    - Deploy application
  saac logs      - View logs
  saac status    - Check status
```

### `saac create <name>`

Create a new application with full configuration options.

```bash
# Basic application (OAuth required!)
saac create my-app -s myapp -r git@git.startanaicompany.com:user/repo.git

# Advanced with health checks and migrations
saac create api \
  -s api \
  -r git@git.startanaicompany.com:user/api-server.git \
  --build-pack nixpacks \
  --port 8080 \
  --pre-deploy-cmd "npm run migrate" \
  --post-deploy-cmd "npm run seed" \
  --health-check \
  --health-path /api/health \
  --health-interval 30 \
  --health-timeout 10 \
  --health-retries 3 \
  --cpu-limit 2 \
  --memory-limit 2G \
  --env NODE_ENV=production \
  --env LOG_LEVEL=debug \
  --env DATABASE_URL=postgresql://...
```

**Prerequisites:**
- ✅ You must be logged in: `saac login`
- ✅ You must connect Git account: `saac git connect`

**Required:**
- `<name>` - Application name (alphanumeric, hyphens allowed)
- `-s, --subdomain <subdomain>` - Subdomain (e.g., `myapp` → `myapp.startanaicompany.com`)
- `-r, --repository <url>` - Git repository URL in SSH format

**Basic Options:**
- `-b, --branch <branch>` - Git branch (default: `master`)
- `-d, --domain-suffix <suffix>` - Domain suffix (default: `startanaicompany.com`)
- `-p, --port <port>` - Port to expose (default: `3000`)

**Build Pack Options:**
- `--build-pack <pack>` - Build system to use:
  - `nixpacks` (default) - Auto-detects language and builds
  - `dockerfile` - Uses Dockerfile in repository
  - `dockercompose` - Uses docker-compose.yml
  - `static` - Static site hosting

**Custom Commands:**
- `--install-cmd <command>` - Install command (e.g., `pnpm install`)
- `--build-cmd <command>` - Build command (e.g., `npm run build`)
- `--start-cmd <command>` - Start command (e.g., `node dist/server.js`)
- `--pre-deploy-cmd <command>` - Pre-deployment hook (e.g., `npm run migrate`)
- `--post-deploy-cmd <command>` - Post-deployment hook (e.g., `npm run seed`)

**Resource Limits:**
- `--cpu-limit <limit>` - CPU limit (e.g., `1`, `2.5`)
- `--memory-limit <limit>` - Memory limit (e.g., `512M`, `1G`, `2G`)

**Note:** Free tier limited to 1 vCPU, 1024M RAM. Upgrades required for higher limits.

**Health Checks:**
- `--health-check` - Enable health checks
- `--health-path <path>` - Health check endpoint (default: `/health`)
- `--health-interval <seconds>` - Check interval (default: 30s)
- `--health-timeout <seconds>` - Check timeout (default: 10s)
- `--health-retries <count>` - Number of retries before marking unhealthy (1-10)

**Environment Variables:**
- `--env <KEY=VALUE>` - Set environment variable (can be used multiple times)
- Maximum 50 variables per application

**Example with all features:**
```bash
saac create production-api \
  -s api \
  -r git@git.startanaicompany.com:company/api.git \
  -b main \
  --build-pack nixpacks \
  --port 8080 \
  --pre-deploy-cmd "npm run db:migrate" \
  --start-cmd "node dist/index.js" \
  --cpu-limit 2 \
  --memory-limit 2G \
  --health-check \
  --health-path /api/health \
  --health-interval 30 \
  --health-timeout 10 \
  --health-retries 3 \
  --env NODE_ENV=production \
  --env LOG_LEVEL=info \
  --env DATABASE_URL=postgresql://user:pass@host/db \
  --env REDIS_URL=redis://redis:6379
```

**What happens:**
1. Validates all inputs
2. Checks Git OAuth connection
3. Creates application on Coolify via wrapper API
4. Saves configuration to `.saac/config.json`
5. Shows next steps (deploy, logs, status)

### `saac update`

Update application configuration after creation.

```bash
# Update port and enable health checks
saac update --port 8080 --health-check --health-path /api/health

# Switch to Nixpacks and update resource limits
saac update --build-pack nixpacks --cpu-limit 2 --memory-limit 2G

# Update custom commands
saac update --pre-deploy-cmd "npm run migrate" --start-cmd "npm start"

# Disable health checks
saac update --no-health-check

# Update environment variables
saac update --env NODE_ENV=production --env DEBUG=true

# Change restart policy
saac update --restart on-failure
```

**Options:** All options from `create` command can be updated individually.

**Important:** Configuration changes require redeployment to take effect:
```bash
saac deploy
```

**Supported Updates:**
- Basic: name, branch, port
- Build pack and custom commands
- Resource limits (subject to tier limits)
- Health checks (enable/disable and all parameters)
- Restart policy: `always`, `on-failure`, `unless-stopped`, `no`
- Environment variables

**Note:** Only the fields you specify will be updated (partial updates).

### `saac deploy [-f]`

Trigger deployment of your application.

```bash
# Normal deployment
saac deploy

# Force deployment (rebuild from scratch)
saac deploy --force
saac deploy -f
```

**What happens:**
1. Validates authentication and project config
2. Triggers deployment on Coolify via wrapper API
3. Shows deployment ID and status
4. Provides command to follow logs

**Options:**
- `-f, --force` - Force rebuild (ignore cache)

**Example output:**
```
Deploying Application
─────────────────────

ℹ Application:  mysimpleflowershop
ℹ Repository:   git@git.startanaicompany.com:user/repo.git
ℹ Branch:       master

⏳ Triggering deployment...

✓ Deployment triggered successfully!

  Status:        queued
  Deployment ID: dp_abc123def456
  Domain:        mysimpleflowershop.startanaicompany.com

ℹ Follow deployment logs:
  saac logs --deployment
```

### `saac deployments`

View deployment history for your application.

```bash
# List recent deployments (default: 20)
saac deployments
saac deploys  # Alias

# Show more deployments
saac deployments --limit 50

# Pagination
saac deployments --limit 20 --offset 20
```

**Options:**
- `-l, --limit <number>` - Number of deployments to show (default: 20)
- `-o, --offset <number>` - Offset for pagination (default: 0)

**Shows:**
- Deployment ID
- Status (finished, failed, running, queued)
- Started/finished timestamps
- Duration
- Commit hash and message
- Branch

**Example output:**
```
Deployment History: mysimpleflowershop
─────────────────────────────────────

┌──────────────────┬──────────┬─────────────┬──────────┬──────────────┐
│ ID               │ Status   │ Started     │ Duration │ Commit       │
├──────────────────┼──────────┼─────────────┼──────────┼──────────────┤
│ dp_abc123...     │ finished │ 10:30 AM    │ 45s      │ a1b2c3d Fix  │
│ dp_def456...     │ failed   │ 9:15 AM     │ 12s      │ e4f5g6h Add  │
│ dp_ghi789...     │ finished │ Yesterday   │ 52s      │ i7j8k9l Upd  │
└──────────────────┴──────────┴─────────────┴──────────┴──────────────┘

Total: 3 deployments
```

### `saac list`

List all your applications.

```bash
saac list
saac ls  # Alias
```

**Shows:**
- Application name
- Domain
- Status (running, stopped, error, etc.)
- Git branch
- Creation date

**Example output:**
```
Your Applications (3)
─────────────────────

┌──────────────────────┬──────────────────────────────────┬─────────────┬────────┬──────────────┐
│ Name                 │ Domain                           │ Status      │ Branch │ Created      │
├──────────────────────┼──────────────────────────────────┼─────────────┼────────┼──────────────┤
│ mysimpleflowershop   │ shop.startanaicompany.com        │ Running ✓   │ master │ Jan 26, 2026 │
│ api-server           │ api.startanaicompany.com         │ Running ✓   │ main   │ Jan 20, 2026 │
│ landing-page         │ landing.startanaicompany.com     │ Stopped     │ master │ Jan 15, 2026 │
└──────────────────────┴──────────────────────────────────┴─────────────┴────────┴──────────────┘

Total: 3 applications
```

### `saac status`

Show current application status and configuration.

```bash
saac status
```

**Shows:**
- Application details (name, UUID, domain)
- Git repository and branch
- Current status (running/stopped/error)
- Resource usage (CPU, memory)
- Health check status
- Environment variables count
- Recent deployments

**Example output:**
```
Application Status
──────────────────

  Name:          mysimpleflowershop
  UUID:          abc123def456
  Domain:        shop.startanaicompany.com
  Status:        Running ✓
  Branch:        master
  Repository:    git@git.startanaicompany.com:user/repo.git

Resources
─────────
  CPU:           0.5 / 1.0 vCPU
  Memory:        256M / 1024M
  Health:        Healthy ✓

Configuration
─────────────
  Build Pack:    nixpacks
  Port:          3000
  Env Variables: 5 / 50

Recent Deployments
──────────────────
  Last Deploy:   Jan 29, 2026, 10:30 AM (finished)
  Duration:      45 seconds
  Commit:        a1b2c3d Fix bug in auth
```

### `saac delete`

Delete current application.

```bash
# With confirmation prompt
saac delete

# Skip confirmation
saac delete --yes
saac delete -y

# Alias
saac rm
```

**⚠️ Warning:** This action is **irreversible**! All data will be deleted.

**What gets deleted:**
- Application container
- Environment variables
- Deployment history
- Logs
- Domain configuration

**What stays:**
- Git repository (not affected)
- Local `.saac/config.json` (you can delete manually)

### `saac manual`

Display full documentation from GitHub README.

```bash
saac manual
```

Fetches and displays the latest README.md from the GitHub repository.

---

## Environment Variables

Manage environment variables for your application. Changes require redeployment to take effect.

### `saac env set <vars...>`

Set or update environment variables.

```bash
# Set single variable
saac env set NODE_ENV=production

# Set multiple variables
saac env set NODE_ENV=production LOG_LEVEL=debug API_URL=https://api.example.com

# Set variable with special characters
saac env set DATABASE_URL="postgresql://user:p@ss!word@host:5432/db"

# Set variable with spaces (must quote the entire KEY=VALUE)
saac env set "WELCOME_MESSAGE=Hello World"
```

**Rules:**
- **Key format:** `^[A-Z_][A-Z0-9_]*$` (uppercase, alphanumeric, underscores)
- **Valid keys:** `NODE_ENV`, `DATABASE_URL`, `API_KEY`, `LOG_LEVEL`
- **Invalid keys:** `node-env` (hyphen), `2KEY` (starts with number), `key!` (special char)
- **Value length:** 0-10,000 characters
- **Maximum variables:** 50 per application

**Example output:**
```
Updating Environment Variables
──────────────────────────────

ℹ Variables to set:
    NODE_ENV: production
    DATABASE_URL: postgresql://use***@32/db
    API_KEY: sk_t***123

⏳ Updating environment variables...

✔ Environment variables updated successfully!

✓ Set 3 variable(s)

⚠ Changes require redeployment to take effect
ℹ Run:
  saac deploy
```

**Important:** Environment variable values with sensitive patterns are automatically masked in output:
- `PASSWORD`, `SECRET`, `KEY`, `TOKEN`
- `DATABASE_URL`, `DB_URL`, `PRIVATE`, `AUTH`

### `saac env get [key]`

Get environment variable(s).

```bash
# Get all variables
saac env get

# Get specific variable
saac env get NODE_ENV
```

**Example output (all variables):**
```
Environment Variables: mysimpleflowershop

┌───────────────────┬─────────────────────────────────────┐
│ Key               │ Value                               │
├───────────────────┼─────────────────────────────────────┤
│ NODE_ENV          │ production                          │
│ LOG_LEVEL         │ debug                               │
│ DATABASE_URL      │ post***@32/db                       │
│ API_KEY           │ sk_t***123                          │
│ PORT              │ 3000                                │
└───────────────────┴─────────────────────────────────────┘

Total: 5 / 50 variables
```

**Example output (specific variable):**
```
Environment Variable: NODE_ENV

  Key:   NODE_ENV
  Value: production
```

### `saac env list`

List all environment variables (alias for `saac env get`).

```bash
saac env list
saac env ls  # Alias
```

**Note:** This is exactly the same as `saac env get` with no arguments.

### Environment Variables Workflow

```bash
# 1. Set your environment variables
saac env set NODE_ENV=production \
  DATABASE_URL=postgresql://user:pass@host:5432/db \
  API_KEY=sk_test_123 \
  LOG_LEVEL=info

# 2. Verify what you set
saac env list

# 3. Deploy to apply changes
saac deploy

# 4. Check if application started correctly
saac logs

# 5. Verify specific variable (if needed)
saac env get DATABASE_URL
```

**Common Variables:**
```bash
# Node.js applications
saac env set NODE_ENV=production \
  PORT=3000 \
  LOG_LEVEL=info

# Database connections
saac env set DATABASE_URL=postgresql://user:pass@db.internal:5432/myapp \
  REDIS_URL=redis://redis:6379

# API keys and secrets
saac env set API_KEY=sk_live_... \
  JWT_SECRET=your-secret-key \
  STRIPE_SECRET_KEY=sk_live_...

# Application-specific
saac env set COMPANY_NAME="Acme Corp" \
  PRIMARY_COLOR="#2563EB" \
  CONTACT_EMAIL=contact@acme.com
```

---

## Remote Access

Access and execute commands inside your deployed container.

### Remote Shell

**Project Aurora** - TRUE remote shell access via WebSocket.

#### `saac shell`

Open an interactive remote shell session inside your container.

```bash
saac shell
```

**What happens:**
1. Connects to container via WebSocket
2. Creates or attaches to tmux session
3. Gives you a bash prompt inside the container
4. Session persists even if you disconnect

**Features:**
- ✅ Real bash prompt from container
- ✅ Working directory changes persist
- ✅ Access to all remote files and tools
- ✅ All environment variables available
- ✅ Interactive tools work (vim, nano, htop, etc.)
- ✅ Session persistence (up to 1 hour idle)
- ✅ Auto-reconnection on network interruption

**Example session:**
```bash
$ saac shell

═══════════════════════════════════════════════════════════════
  Remote Shell: mysimpleflowershop
═══════════════════════════════════════════════════════════════

ℹ Connecting to container...
ℹ This may take up to 30 seconds for container creation.

✓ Connected to remote container
✓ Container is ready!
ℹ Type commands below. Press Ctrl+D or type "exit" to quit.

root@container-abc123:/app# ls -la
total 128
drwxr-xr-x  8 root root  4096 Jan 29 09:00 .
drwxr-xr-x 18 root root  4096 Jan 29 09:00 ..
-rw-r--r--  1 root root  1245 Jan 29 09:00 package.json
drwxr-xr-x  2 root root  4096 Jan 29 09:00 node_modules
-rw-r--r--  1 root root   543 Jan 29 09:00 server.js

root@container-abc123:/app# npm run test
> mysimpleflowershop@1.0.0 test
> jest

PASS  tests/auth.test.js
PASS  tests/api.test.js

Test Suites: 2 passed, 2 total
Tests:       15 passed, 15 total

root@container-abc123:/app# echo $NODE_ENV
production

root@container-abc123:/app# exit

ℹ Disconnecting from remote shell...
```

**Exit shell:**
- Type `exit` or `quit`
- Press `Ctrl+D`

**Session Persistence:**
If you close your terminal and reconnect within 1 hour, you'll resume the same session:

```bash
# Terminal 1 (close after cd command)
$ saac shell
root@container:/app# cd src
root@container:/app/src# [close terminal]

# Terminal 2 (5 minutes later, same machine)
$ saac shell
root@container:/app/src# pwd
/app/src  ← Same session, same directory!
```

**Use Cases:**
- Debug production issues
- Run database migrations manually
- Check file contents
- Install packages temporarily
- Monitor processes
- Test commands before adding to build scripts

### Remote Execution

Run one-off commands inside your container without opening an interactive shell.

#### `saac exec <command>`

Execute a single command in the remote container.

```bash
# Run command
saac exec "npm run db:migrate"

# Check Node.js version
saac exec "node --version"

# View environment variables
saac exec "printenv | grep NODE"

# Check running processes
saac exec "ps aux"

# Custom working directory
saac exec "npm test" --workdir /app/src

# Set timeout
saac exec "npm run build" --timeout 300
```

**Options:**
- `--workdir <path>` - Working directory (default: `/app`)
- `--timeout <seconds>` - Timeout in seconds (default: 30, max: 300)

**Example output:**
```bash
$ saac exec "npm run db:migrate"

Executing Command: npm run db:migrate
─────────────────────────────────────

⏳ Executing remotely...

Output:
───────
> mysimpleflowershop@1.0.0 db:migrate
> knex migrate:latest

Batch 1 run: 3 migrations
✓ create_users_table
✓ create_posts_table
✓ create_comments_table

✓ Command executed successfully

  Exit Code:  0
  Duration:   2.5s
  Workdir:    /app
```

#### `saac exec --history`

View execution history.

```bash
# View recent executions
saac exec --history

# Show more history
saac exec --history --limit 50

# Pagination
saac exec --history --limit 20 --offset 20
```

**Options:**
- `--limit <number>` - Limit for history (default: 20, max: 100)
- `--offset <number>` - Offset for pagination (default: 0)

**Shows:**
- Command executed
- Exit code (success/failure)
- Duration
- Timestamp
- Working directory

### Local Development

Run local commands with remote environment variables.

#### `saac run <command>`

Execute a command locally with environment variables from your remote application.

```bash
# Run local dev server with remote env vars
saac run npm run dev

# Run tests with remote database
saac run npm test

# Run migrations locally
saac run npm run migrate

# Force refresh env vars (skip cache)
saac run npm start --sync

# Quiet mode (suppress warnings)
saac run "node script.js" --quiet
```

**What happens:**
1. Fetches environment variables from remote application
2. Caches them locally for 1 hour
3. Spawns your command with those env vars
4. Command runs on your local machine (not in container)

**Options:**
- `--sync` - Force refresh environment variables (skip cache)
- `-q, --quiet` - Quiet mode (suppress warnings)

**Use Cases:**
- Local development with production database
- Running migrations before deployment
- Testing with production API keys
- Debugging with real environment

**Example:**
```bash
$ saac run "node -e 'console.log(process.env.DATABASE_URL)'"

🚀 Running command with remote environment variables

  Application:  mysimpleflowershop
  Variables:    5 loaded
  Cache:        Fresh (expires in 58m)

──────────────────────────────────────────────────────────────

postgresql://user:pass@db.internal:5432/myapp

✓ Command completed successfully
```

**⚠️ Security Warning:** Remote secrets are exposed on your local machine. Only use this on trusted machines.

---

## Logs & Monitoring

View runtime logs and deployment logs for your application.

### `saac logs`

View runtime logs (container stdout/stderr).

```bash
# View recent logs
saac logs

# Show more lines
saac logs --tail 200

# Follow logs in real-time (not yet implemented)
saac logs --follow

# Show logs since timestamp
saac logs --since "2026-01-29T10:00:00Z"
```

**Options:**
- `-t, --tail <lines>` - Number of lines to show (default: 100)
- `-f, --follow` - Follow log output (live streaming - not yet implemented)
- `--since <time>` - Show logs since timestamp

**Example output:**
```
Runtime Logs: mysimpleflowershop
───────────────────────────────

> mysimpleflowershop@1.0.0 start
> node server.js

Server running on port 3000
[2026-01-29T10:30:00.000Z] INFO: Database connected
[2026-01-29T10:30:01.123Z] INFO: Application started successfully
[2026-01-29T10:30:15.456Z] INFO: GET /api/users 200 25ms
[2026-01-29T10:30:16.789Z] INFO: GET /api/posts 200 15ms
[2026-01-29T10:31:00.000Z] WARN: Slow query detected (1.2s)
```

### `saac logs --deployment [uuid]`

View deployment logs (build logs).

```bash
# View latest deployment logs
saac logs --deployment

# View specific deployment logs
saac logs --deployment dp_abc123def456

# Raw log format (no coloring)
saac logs --deployment --raw

# Include hidden lines (debug output)
saac logs --deployment --include-hidden

# Short form
saac logs -d
saac logs -d dp_abc123def456
```

**Options:**
- `-d, --deployment [uuid]` - View deployment logs (if UUID omitted, shows latest)
- `--raw` - Show raw log output (deployment logs only)
- `--include-hidden` - Include hidden log lines (deployment logs only)

**Example output:**
```
Deployment Logs: mysimpleflowershop
───────────────────────────────────

  Deployment UUID: dp_abc123def456
  Application:     mysimpleflowershop
  Status:          finished
  Commit:          a1b2c3d
  Message:         Fix authentication bug
  Started:         Jan 29, 2026, 10:30:00 AM
  Finished:        Jan 29, 2026, 10:30:45 AM
  Duration:        45s

Log Output (234 lines):
────────────────────────────────────────────────────────────

[00:00:01] Cloning repository...
[00:00:03] Checking out branch: master
[00:00:05] Detecting language: Node.js
[00:00:06] Installing dependencies...
[00:00:15] Running npm install...
[00:00:25] Building application...
[00:00:30] Running npm run build...
[00:00:40] Build completed successfully
[00:00:42] Creating container image...
[00:00:44] Pushing image to registry...
[00:00:45] ✓ Deployment completed
```

### Log Monitoring Workflow

```bash
# 1. Deploy application
saac deploy

# 2. Watch deployment progress
saac logs --deployment

# 3. If deployment succeeds, check runtime logs
saac logs --tail 100

# 4. Monitor for errors
saac logs | grep ERROR

# 5. Follow logs (when implemented)
saac logs --follow
```

---

## Domain Management

Manage your application's domain and subdomain.

### `saac domain show`

Show current domain configuration.

```bash
saac domain show
```

**Shows:**
- Current domain
- Subdomain
- Domain suffix
- SSL status (if applicable)

**Example output:**
```
Domain Configuration
────────────────────

  Domain:    mysimpleflowershop.startanaicompany.com
  Subdomain: mysimpleflowershop
  Suffix:    startanaicompany.com
  SSL:       Enabled ✓
```

### `saac domain set <subdomain>`

Change your application's subdomain.

```bash
# Change subdomain
saac domain set newsubdomain

# With custom domain suffix
saac domain set myapp --domain-suffix customdomain.com
saac domain set myapp -d customdomain.com
```

**Options:**
- `-d, --domain-suffix <suffix>` - Domain suffix (default: startanaicompany.com)

**What happens:**
1. Updates domain configuration
2. Reconfigures routing
3. Issues new SSL certificate (if applicable)
4. Old domain redirects to new domain

**Important:** You may need to redeploy for changes to take full effect:
```bash
saac deploy
```

---

## Complete Workflows

### First-Time Setup (From Scratch)

```bash
# 1. Register account
saac register -e developer@company.com

# 2. Check email for verification code
# Visit: https://mailhog.goryan.io

# 3. Verify email (save API key shown after verification!)
saac verify 123456

# 4. Login with API key
saac login -e developer@company.com -k cw_abc123...

# 5. Connect Git account (required for creating apps)
saac git connect git.startanaicompany.com

# 6. Clone or create your project
git clone git@git.startanaicompany.com:company/myapp.git
cd myapp

# 7. Create SAAC application
saac create myapp \
  -s myapp \
  -r git@git.startanaicompany.com:company/myapp.git \
  -b main \
  --env NODE_ENV=production

# 8. Deploy
saac deploy

# 9. View logs
saac logs --deployment

# 10. Check application
saac status

# 11. Access shell if needed
saac shell
```

### Existing Application (Link to Directory)

```bash
# 1. Login (if not already logged in)
saac login -e developer@company.com -k cw_abc123...

# 2. Clone the repository
git clone git@git.startanaicompany.com:company/existing-app.git
cd existing-app

# 3. Link to existing SAAC application
saac init
# Select "existing-app" from the list

# 4. Now you can manage it
saac deploy
saac logs
saac status
```

### Environment Variables Management

```bash
# 1. View current environment variables
saac env list

# 2. Set new variables
saac env set NODE_ENV=production \
  DATABASE_URL=postgresql://user:pass@host:5432/db \
  API_KEY=sk_live_123 \
  LOG_LEVEL=info

# 3. Verify they were set
saac env list

# 4. Deploy to apply changes
saac deploy

# 5. Check if application started correctly
saac logs

# 6. Test specific variable (if needed)
saac env get DATABASE_URL
```

### Debugging Production Issues

```bash
# 1. Check application status
saac status

# 2. View runtime logs
saac logs --tail 200

# 3. Look for errors
saac logs | grep ERROR

# 4. Access container shell
saac shell

# Inside container:
root@container:/app# ps aux
root@container:/app# df -h
root@container:/app# cat /app/logs/error.log
root@container:/app# npm run db:status
root@container:/app# exit

# 5. Run one-off diagnostic command
saac exec "node scripts/health-check.js"

# 6. Check environment variables
saac env list

# 7. View recent deployments
saac deployments

# 8. Check specific deployment logs
saac logs --deployment dp_abc123
```

### Local Development with Remote Env

```bash
# 1. Ensure you're in project directory
cd ~/myapp

# 2. Link to SAAC application (if not already)
saac init

# 3. Run local development server with remote env vars
saac run npm run dev

# 4. Run tests with remote database
saac run npm test

# 5. Run migrations locally (against remote database)
saac run npm run migrate

# 6. Run custom scripts
saac run "node scripts/seed-data.js"
```

### Multi-Environment Setup

```bash
# Development environment
saac create myapp-dev \
  -s myapp-dev \
  -r git@git.startanaicompany.com:company/myapp.git \
  -b develop \
  --env NODE_ENV=development \
  --env LOG_LEVEL=debug

# Staging environment
saac create myapp-staging \
  -s myapp-staging \
  -r git@git.startanaicompany.com:company/myapp.git \
  -b staging \
  --env NODE_ENV=staging \
  --env LOG_LEVEL=info

# Production environment
saac create myapp-prod \
  -s myapp \
  -r git@git.startanaicompany.com:company/myapp.git \
  -b main \
  --env NODE_ENV=production \
  --env LOG_LEVEL=warn \
  --health-check \
  --health-path /api/health \
  --cpu-limit 2 \
  --memory-limit 2G

# Switch between environments using different directories
mkdir -p ~/projects/myapp-dev ~/projects/myapp-staging ~/projects/myapp-prod

cd ~/projects/myapp-dev
saac init  # Select myapp-dev
saac deploy

cd ~/projects/myapp-staging
saac init  # Select myapp-staging
saac deploy

cd ~/projects/myapp-prod
saac init  # Select myapp-prod
saac deploy
```

---

## Troubleshooting

### Authentication Issues

#### "Not logged in"

**Problem:** Session token expired or not found.

**Solution:**
```bash
saac login -e your@email.com -k cw_your_api_key
```

**If you lost your API key:**
```bash
# You need to have a valid session first (via OTP)
# Contact support or check MailHog for OTP login

# Then regenerate API key
saac keys regenerate
```

#### "Invalid or expired session token"

**Problem:** Session token expired (valid for 1 year).

**Solution:**
```bash
saac logout
saac login -e your@email.com -k cw_your_api_key
```

#### "Email not verified"

**Problem:** You registered but didn't verify your email.

**Solution:**
```bash
# Check MailHog for verification code
# Visit: https://mailhog.goryan.io

# Verify with code
saac verify 123456
```

### Git OAuth Issues

#### "Git account not connected"

**Problem:** You must connect your Git account before creating applications.

**Solution:**
```bash
saac git connect

# Or specify host directly
saac git connect git.startanaicompany.com
```

#### "OAuth authorization failed"

**Problem:** Browser OAuth flow was cancelled or failed.

**Solution:**
```bash
# Try again with specific host
saac git connect git.startanaicompany.com

# If browser doesn't open automatically, copy the URL from the terminal
```

#### "OAuth connection expired"

**Problem:** OAuth token expired or was revoked.

**Solution:**
```bash
# Disconnect and reconnect
saac git disconnect git.startanaicompany.com
saac git connect git.startanaicompany.com
```

### Application Issues

#### "No application found in current directory"

**Problem:** No `.saac/config.json` file in current directory.

**Solution:**
```bash
# Link to existing application
saac init

# Or create new application
saac create myapp -s myapp -r git@git...
```

#### "Application not found" (404)

**Problem:** Application UUID is incorrect or application was deleted.

**Solution:**
```bash
# List all your applications
saac list

# Re-initialize with correct application
saac init
```

### Deployment Issues

#### Deployment fails

**Problem:** Various reasons - check logs.

**Solution:**
```bash
# View deployment logs to see what went wrong
saac logs --deployment

# Common issues:
# - Build errors: Check your package.json, Dockerfile, etc.
# - Missing dependencies: Ensure all dependencies are in package.json
# - Port conflicts: Check --port setting
# - Resource limits: Free tier is limited to 1 vCPU, 1GB RAM

# Try force deploy (rebuild from scratch)
saac deploy --force
```

#### "Health check failed"

**Problem:** Health check endpoint not responding or returning errors.

**Solution:**
```bash
# 1. Check if health endpoint exists
saac shell
root@container:/app# curl localhost:3000/health

# 2. View logs for errors
saac logs

# 3. Temporarily disable health checks
saac update --no-health-check
saac deploy

# 4. Fix your health endpoint, re-enable health checks
saac update --health-check --health-path /api/health
saac deploy
```

### Environment Variables Issues

#### "Failed to fetch environment variables" (500 error)

**Problem:** Backend database schema issue (known bug as of Jan 29, 2026).

**Reported to backend team:** Column name mismatch in database query.

**Workaround:** Setting variables works fine:
```bash
# Setting works
saac env set KEY=value

# Listing fails (backend issue)
saac env list  # Returns 500

# Wait for backend team to fix database schema
```

#### Changes not taking effect

**Problem:** Environment variable changes require redeployment.

**Solution:**
```bash
# After setting env vars, always redeploy
saac env set NODE_ENV=production
saac deploy
```

### Logs Issues

#### "No logs available"

**Problem:** Application not deployed yet or container not running.

**Solution:**
```bash
# Check application status
saac status

# Deploy if not deployed
saac deploy

# Wait a moment for container to start
sleep 10

# Try logs again
saac logs
```

#### "result.logs.forEach is not a function"

**Problem:** Fixed in version 1.4.20. Update your CLI.

**Solution:**
```bash
npm update -g @startanaicompany/cli
```

### Shell Issues

#### "Connection timeout"

**Problem:** Container taking too long to start or network issues.

**Solution:**
```bash
# Check application status
saac status

# Ensure application is running
saac deploy

# Wait for deployment to complete
saac logs --deployment

# Try shell again
saac shell
```

#### "WebSocket connection failed"

**Problem:** Backend WebSocket server not available (Project Aurora not deployed yet).

**Status:** As of Jan 29, 2026, Project Aurora WebSocket infrastructure awaiting backend deployment.

**Workaround:** Use `saac exec` for one-off commands:
```bash
saac exec "npm run migrate"
saac exec "ps aux"
```

### General Debugging

```bash
# Check CLI version
saac --version

# Show help
saac --help

# Check what command does
saac logs --help
saac deploy --help

# View user information
saac whoami

# List all applications
saac list

# Check application status
saac status

# View session information
saac sessions

# Test API connectivity (manual command from GitHub)
saac manual
```

---

## Configuration Files

### Global Configuration

**Location:** `~/.config/startanaicompany/config.json`

**Contains:**
- API URL
- User credentials (email, userId, sessionToken)
- Session expiration timestamp
- Verification status

**Example:**
```json
{
  "apiUrl": "https://apps.startanaicompany.com/api/v1",
  "user": {
    "email": "developer@company.com",
    "userId": "a2c37076-1b0e-4b9a-80f8-31ef39766096",
    "sessionToken": "st_kgzfNByNNrtrDsAW07h6ORwTtP3POK6O98klH9Rm8jTt9ByHojeH7zDmGwaF",
    "expiresAt": "2027-01-29T09:00:00.000Z",
    "verified": true
  }
}
```

**Note:** Managed by the CLI. Do not edit manually unless troubleshooting.

### Project Configuration

**Location:** `.saac/config.json` (in your project directory)

**Contains:**
- Application UUID
- Application name
- Subdomain
- Domain suffix
- Git repository

**Example:**
```json
{
  "applicationUuid": "h884go4s4080kwk4808sw0wc",
  "applicationName": "mysimpleflowershop",
  "subdomain": "shop",
  "domainSuffix": "startanaicompany.com",
  "gitRepository": "git@git.startanaicompany.com:company/myapp.git"
}
```

**Note:** Created automatically by `saac create` or `saac init`.

### .gitignore

Add to your `.gitignore`:
```gitignore
# SAAC CLI config (can be project-specific, commit if shared)
.saac/config.json

# Or keep it if your team shares the same SAAC application
# .saac/config.json
```

---

## For LLMs: How to Use This Tool

### Quick Reference

**Authentication Flow:**
1. `saac register -e email@example.com` → Register
2. Check email for code → Get verification code
3. `saac verify 123456` → Verify (save API key!)
4. `saac login -e email@example.com -k cw_...` → Login (gets session token)

**Git OAuth (Required for App Creation):**
1. `saac git connect` → Connect Git account
2. Browser opens → Authorize
3. Now you can create apps

**Application Management:**
1. `saac create name -s subdomain -r git@git...` → Create
2. `saac deploy` → Deploy
3. `saac logs` → View logs
4. `saac shell` → Access container

**Environment Variables:**
1. `saac env set KEY=value KEY2=value2` → Set
2. `saac env list` → List
3. `saac deploy` → Deploy to apply changes

**Common Commands:**
- `saac list` → List all applications
- `saac status` → Show application status
- `saac logs` → Runtime logs
- `saac logs --deployment` → Build logs
- `saac shell` → Interactive shell in container
- `saac exec "command"` → Run command in container
- `saac run npm start` → Run local command with remote env vars

### Key Concepts for LLMs

1. **Session Tokens:** Login with API key to get session token (valid 1 year). CLI handles this automatically.

2. **Git OAuth Required:** You MUST connect Git account (`saac git connect`) before creating applications.

3. **Project Context:** Most commands require `.saac/config.json` in current directory (created by `create` or `init`).

4. **Environment Variables:** Changes require redeployment (`saac deploy`) to take effect.

5. **Two Types of Logs:**
   - Runtime logs: `saac logs` (container stdout/stderr)
   - Deployment logs: `saac logs --deployment` (build output)

6. **Remote Access:**
   - `saac shell` - Interactive shell (like SSH)
   - `saac exec` - One-off command execution
   - `saac run` - Local command with remote env vars

7. **Project Aurora:** WebSocket-based remote shell providing TRUE container access (not local shell with env vars).

### Common Patterns

**Create and Deploy:**
```bash
saac create myapp -s myapp -r git@git.startanaicompany.com:user/repo.git --env NODE_ENV=production
saac deploy
saac logs --deployment
saac logs
```

**Update Configuration:**
```bash
saac update --port 8080 --health-check
saac deploy
```

**Debug Issues:**
```bash
saac status
saac logs
saac shell
# Inside: check files, processes, etc.
saac exec "npm run health-check"
```

**Manage Environment:**
```bash
saac env set KEY=value
saac env list
saac deploy
```

---

## API Endpoints Reference

For developers integrating with the wrapper API:

**Base URL:** `https://apps.startanaicompany.com/api/v1`

**Authentication:**
- Header: `X-Session-Token: st_...` (recommended)
- Header: `X-API-Key: cw_...` (alternative)

**Key Endpoints:**
- `POST /users/register` - Register user
- `POST /users/verify` - Verify email
- `POST /auth/login` - Login with API key
- `GET /oauth/authorize` - OAuth authorization
- `GET /oauth/poll/:session_id` - Poll OAuth status
- `GET /users/me/oauth` - List OAuth connections
- `DELETE /users/me/oauth/:host` - Revoke OAuth connection
- `POST /applications` - Create application
- `GET /applications` - List applications
- `PATCH /applications/:uuid` - Update application
- `POST /applications/:uuid/deploy` - Deploy
- `GET /applications/:uuid/logs` - Runtime logs
- `GET /applications/:uuid/deployment-logs` - Deployment logs
- `GET /applications/:uuid/env` - Get environment variables
- `PATCH /applications/:uuid/env` - Set environment variables
- `GET /shell/connect` - WebSocket endpoint for remote shell
- `POST /applications/:uuid/exec` - Execute remote command

---

## Development

```bash
# Clone repository
git clone https://github.com/startanaicompany/cli.git
cd cli

# Install dependencies
npm install

# Link for local development
npm link

# Now you can use `saac` command globally
saac --help

# Run linter
npm run lint

# Test locally
npm run dev
```

### Contributing

Pull requests are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit pull request

### Architecture

- **Entry Point:** `bin/saac.js` (Commander.js definitions)
- **Commands:** `src/commands/*.js` (command implementations)
- **API Client:** `src/lib/api.js` (axios-based HTTP client)
- **Logger:** `src/lib/logger.js` (chalk, ora, boxen)
- **Config:** `src/lib/config.js` (conf package for global config)
- **OAuth:** `src/lib/oauth.js` (Git OAuth helpers)

---

## Support

- 📧 **Email:** support@startanaicompany.com
- 🐛 **Issues:** https://github.com/startanaicompany/cli/issues
- 📚 **Docs:** https://startanaicompany.com/docs
- 💬 **MailHog (Dev):** https://mailhog.goryan.io

---

## License

MIT © StartAnAiCompany

---

## Changelog

### Version 1.4.20 (Latest)
- Fixed logs command - handle logs as string instead of array
- Backend returns `result.logs` as string, not array

### Version 1.4.19
- Version bump

### Version 1.4.18
- Implemented Project Aurora - TRUE remote shell via WebSocket (Phase 3.5)
- Added WebSocket-based remote shell access (`saac shell`)
- Fixed env set command - removed spread operator causing array-in-array bug
- Environment variable setting now works correctly

### Version 1.4.14
- OAuth-only authentication for Git
- Removed manual `--git-token` option
- Added `saac git connect`, `saac git list`, `saac git disconnect`
- Improved documentation

---

Made with ❤️ by StartAnAiCompany
