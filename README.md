# @startanaicompany/cli

> Official CLI for StartAnAiCompany.com - Deploy AI recruitment sites with ease

[![npm version](https://img.shields.io/npm/v/@startanaicompany/cli.svg)](https://www.npmjs.com/package/@startanaicompany/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- ✨ **Simple & Intuitive** - Deploy with a single command
- 🔐 **Secure** - API key-based authentication
- 🚀 **Fast** - Optimized for quick deployments
- 📦 **Zero Configuration** - Works out of the box
- 🎨 **Beautiful CLI** - Color-coded output and progress indicators
- 🔄 **Auto-healing** - Automatically fixes common deployment issues

## Installation

```bash
npm install -g @startanaicompany/cli
```

## Quick Start

```bash
# 1. Register for an account
saac register --email user@example.com

# 2. Verify your email (check MailHog)
saac verify 123456

# 3. Login with your API key
saac login -e user@example.com -k cw_your_api_key

# 4. Connect your Git account (OAuth)
saac git connect

# 5. Create a new application
saac create my-app -s myapp -r git@git.startanaicompany.com:user/repo.git

# 6. Deploy!
saac deploy
```

## Commands

## Git Authentication

SAAC CLI uses **OAuth-only authentication** for Git access. You must connect your Git account before creating applications.

### Connect Your Git Account

Connect your Git account once, deploy unlimited applications:

```bash
# Connect Git account (interactive)
saac git connect

# Or specify host directly
saac git connect git.startanaicompany.com

# List connected accounts
saac git list

# Disconnect account
saac git disconnect git.startanaicompany.com
```

**Benefits:**
- ✅ Connect once, deploy unlimited apps
- ✅ No need to remember or copy tokens
- ✅ Tokens stored encrypted on server
- ✅ Supports Gitea, GitHub, and GitLab
- 🔒 More secure than manual tokens

**Creating apps with OAuth:**
```bash
# OAuth connection required!
saac create my-app -s myapp -r git@git.startanaicompany.com:user/repo.git

# CLI automatically uses your connected account
# ✅ Using connected account: username@git.startanaicompany.com
```

**⚠️ Important:** You must connect your Git account with `saac git connect` before creating applications. Manual tokens are no longer supported.

---

### Authentication

#### `saac register`
Register for a new account

```bash
saac register --email user@example.com
saac register -e user@example.com --gitea-username myuser
```

**Required:**
- `-e, --email <email>` - Your email address

**Optional:**
- `--gitea-username <username>` - Your Gitea username (auto-detected if not provided)

#### `saac login`
Login with existing credentials

```bash
saac login --email user@example.com --api-key cw_...
saac login -e user@example.com -k cw_...
```

**Required:**
- `-e, --email <email>` - Your email address
- `-k, --api-key <key>` - Your API key

#### `saac verify <code>`
Verify your email address

```bash
saac verify 123456
```

**Note:** Check MailHog at https://mailhog.goryan.io for verification codes

#### `saac logout`
Logout from current device (revokes session token)

```bash
saac logout
```

#### `saac logout-all`
Logout from all devices (revokes all session tokens)

```bash
saac logout-all
saac logout-all --yes  # Skip confirmation
```

**Options:**
- `-y, --yes` - Skip confirmation prompt

#### `saac sessions`
List all active sessions

```bash
saac sessions
```

Shows all devices where you're currently logged in with creation date, last used time, IP address, and expiration date.

#### `saac git connect [host]`
Connect a Git account via OAuth

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
3. Connection saved (encrypted on server)
4. Future app creations use this connection automatically

#### `saac git list`
List all connected Git accounts

```bash
saac git list
saac git ls  # Alias
```

Shows host, username, provider, expiration date, and last used time.

#### `saac git disconnect <host>`
Disconnect a Git account

```bash
saac git disconnect git.startanaicompany.com
```

### Application Management

#### `saac init`
Link an existing SAAC application to the current directory

```bash
# Interactive mode - select from your applications
cd my-project
saac init
```

**Use Case:** When you clone a Git repository or have an existing project and want to link it to a SAAC application.

**What it does:**
1. Shows all your SAAC applications
2. Let you select which one to link to this directory
3. Saves the link to `.saac/config.json`
4. Now you can use `saac deploy`, `saac logs`, etc.

**Note:** To create a new application, use `saac create` instead.

#### `saac create <name>`
Create a new application

```bash
# Basic application (OAuth required!)
saac create my-app -s myapp -r git@git.startanaicompany.com:user/repo.git

# Advanced with health checks and migration
saac create api -s api -r git@git... \
  --build-pack nixpacks \
  --port 8080 \
  --pre-deploy-cmd "npm run migrate" \
  --health-check \
  --health-path /api/health \
  --env NODE_ENV=production
```

**Required:**
- `<name>` - Application name
- `-s, --subdomain <subdomain>` - Subdomain for your app
- `-r, --repository <url>` - Git repository URL (SSH format)

**Prerequisites:**
- You must connect your Git account first: `saac git connect`

**Optional:**
- `-b, --branch <branch>` - Git branch (default: master)
- `-d, --domain-suffix <suffix>` - Domain suffix (default: startanaicompany.com)
- `-p, --port <port>` - Port to expose (default: 3000)
- `--build-pack <pack>` - Build pack: dockercompose, nixpacks, dockerfile, static
- `--install-cmd <command>` - Install command
- `--build-cmd <command>` - Build command
- `--start-cmd <command>` - Start command
- `--pre-deploy-cmd <command>` - Pre-deployment command (e.g., migrations)
- `--post-deploy-cmd <command>` - Post-deployment command (e.g., seeding)
- `--cpu-limit <limit>` - CPU limit (e.g., "1", "2.5")
- `--memory-limit <limit>` - Memory limit (e.g., "512M", "2G")
- `--health-check` - Enable health checks
- `--health-path <path>` - Health check path (default: /health)
- `--health-interval <seconds>` - Health check interval in seconds
- `--health-timeout <seconds>` - Health check timeout in seconds
- `--health-retries <count>` - Health check retries (1-10)
- `--env <KEY=VALUE>` - Environment variable (can be used multiple times)

**Note:** Free tier limited to 1 vCPU, 1024M RAM

#### `saac update`
Update application configuration

```bash
# Update port and enable health checks
saac update --port 8080 --health-check --health-path /api/health

# Switch to Nixpacks and update resource limits
saac update --build-pack nixpacks --cpu-limit 2 --memory-limit 2G

# Update custom commands
saac update --pre-deploy-cmd "npm run migrate"

# Disable health checks
saac update --no-health-check
```

**Options:** All options from `create` command can be updated individually

**Important:** Configuration changes require redeployment to take effect:
```bash
saac deploy
```

#### `saac deploy`
Deploy your application

```bash
saac deploy
saac deploy --force
```

#### `saac logs`
View application logs

```bash
saac logs
saac logs --tail 50
saac logs --follow
```

### Environment Variables

#### `saac env set <vars...>`
Set environment variables

```bash
saac env set KEY=value
saac env set KEY1=value1 KEY2=value2
```

#### `saac env get [key]`
Get environment variable(s)

```bash
saac env get
saac env get KEY
```

#### `saac env list`
List all environment variables

```bash
saac env list
```

### Domain Management

#### `saac domain set <subdomain>`
Change your application subdomain

```bash
saac domain set newsubdomain
```

#### `saac domain show`
Show current domain

```bash
saac domain show
```

### Information

#### `saac list`
List all your applications

```bash
saac list
saac ls
```

#### `saac status`
Show current application status

```bash
saac status
```

#### `saac whoami`
Show current user information

```bash
saac whoami
```

### Deletion

#### `saac delete`
Delete current application

```bash
saac delete
saac delete --yes  # Skip confirmation
saac rm            # Alias
```

## Configuration

### Global Configuration

Stored in `~/.config/startanaicompany/config.json`:

```json
{
  "apiUrl": "https://apps.startanaicompany.com/api/v1",
  "user": {
    "email": "user@example.com",
    "userId": "...",
    "apiKey": "cw_...",
    "verified": true
  }
}
```

### Project Configuration

Stored in `.saac/config.json` in your project:

```json
{
  "applicationUuid": "...",
  "applicationName": "my-site",
  "subdomain": "mysite",
  "domainSuffix": "startanaicompany.com",
  "gitRepository": "git@git.startanaicompany.com:user/repo.git"
}
```

## Workflow Example

```bash
# Step 1: Register and verify
saac register -e dev@company.com
# Check MailHog for code
saac verify 123456

# Step 2: Login
saac login -e dev@company.com -k cw_your_api_key

# Step 3: Connect your Git account (OAuth)
saac git connect

# Step 4: Clone or create your project
git clone git@git.startanaicompany.com:user/mysite.git
cd mysite

# Step 5: Create application
saac create mysite -s mysite -r git@git.startanaicompany.com:user/mysite.git

# Step 6: Deploy
saac deploy

# Step 7: View logs
saac logs --follow

# Step 8: Update environment variables
saac env set COMPANY_NAME="My Company"
saac deploy  # Redeploy to apply changes
```

## Environment Variables

The CLI sets these automatically:
- `DOMAIN` - Your application domain
- `COOLIFY_*` - Coolify API configuration (managed by wrapper)

You can set custom variables:
```bash
saac env set COMPANY_NAME="Acme Corp"
saac env set PRIMARY_COLOR="#2563EB"
saac env set CONTACT_EMAIL="contact@acme.com"
```

## Troubleshooting

### "Not logged in"
```bash
saac login -e your@email.com -k cw_your_api_key
```

### "Git account not connected"
You must connect your Git account before creating applications:
```bash
saac git connect
```

### "No application found"
```bash
saac init
# or
saac create
```

### "Email not verified"
Check MailHog at https://mailhog.goryan.io and run:
```bash
saac verify <code>
```

### Deployment fails
```bash
# View logs to see what went wrong
saac logs

# Try force deploy
saac deploy --force
```

## Development

```bash
# Clone repository
git clone https://github.com/startanaicompany/cli.git
cd cli

# Install dependencies
npm install

# Link for local development
npm link

# Now you can use `saac` command
saac --help
```

## Support

- 📧 Email: support@startanaicompany.com
- 🐛 Issues: https://github.com/startanaicompany/cli/issues
- 📚 Docs: https://startanaicompany.com/docs

## License

MIT © StartAnAiCompany

## Contributing

Pull requests are welcome! Please read our contributing guidelines first.

---

Made with ❤️ by StartAnAiCompany
