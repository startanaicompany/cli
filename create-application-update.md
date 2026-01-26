# Create Application Endpoint - Comprehensive Update

**Date**: 2026-01-25
**Target**: SAAC CLI Team
**Endpoint**: `POST /api/v1/applications`
**Status**: ✅ MAJOR UPDATE - Tier-based resource limits, advanced configuration fields

---

## What Changed?

The `POST /api/v1/applications` endpoint has been significantly enhanced with:

1. **Tier-Based Resource Limits** - Automatic CPU and memory limits based on user tier (free, starter, pro, enterprise)
2. **Advanced Build Configuration** - Support for Nixpacks, Dockerfile, Static builds (not just Docker Compose)
3. **Health Check Configuration** - Optional health checks for auto-restart and zero-downtime deployments
4. **Custom Commands** - Pre/post deployment hooks, custom install/build/start commands
5. **Resource Allocation** - Manual CPU/memory limits (enforced by tier)
6. **Field Renaming** - `gitea_username` → `git_username`, `gitea_api_token` → `git_api_token`

---

## Tier-Based Resource Limits (NEW!)

### Overview

All applications now have **automatic resource limits** based on user tier to prevent resource exhaustion:

| Tier       | CPU Limit | Memory Limit | Max Applications | Description                                   |
|------------|-----------|--------------|------------------|-----------------------------------------------|
| **free**   | 1 vCPU    | 1024M (1GB)  | 3 apps           | Perfect for testing and small projects        |
| **starter**| 2 vCPU    | 2048M (2GB)  | 10 apps          | For small production apps                     |
| **pro**    | 4 vCPU    | 8192M (8GB)  | 50 apps          | For serious production workloads              |
| **enterprise** | Unlimited | Unlimited | Unlimited        | Custom resource allocation                    |

### How It Works

1. **Automatic Application** - When creating an app, the wrapper retrieves the user's tier from the database
2. **Default Limits Applied** - If user doesn't specify limits, tier defaults are applied
3. **Enforcement** - If user tries to exceed tier limits, wrapper caps at tier maximum
4. **Current Status** - All users are currently on the **free tier** (1GB RAM, 1 vCPU)

### Examples

```bash
# Free tier user - defaults to 1GB RAM, 1 vCPU (automatic)
curl -X POST https://apps.startanaicompany.com/api/v1/applications \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-app",
    "subdomain": "myapp",
    ...
  }'
# Result: cpu_limit="1", memory_limit="1024M" (enforced by wrapper)

# Free tier user tries to request 4GB - capped at 1GB
curl -X POST https://apps.startanaicompany.com/api/v1/applications \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-app",
    "subdomain": "myapp",
    "memory_limit": "4096M",  # User requests 4GB
    ...
  }'
# Result: memory_limit="1024M" (capped at tier limit)

# Pro tier user - can use up to 8GB RAM, 4 vCPU
curl -X POST https://apps.startanaicompany.com/api/v1/applications \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-app",
    "subdomain": "myapp",
    "cpu_limit": "4",
    "memory_limit": "8192M",
    ...
  }'
# Result: Full allocation granted (within tier limits)
```

---

## Complete Request Schema (Updated)

### Required Fields

```json
{
  "name": "string (required, max 255)",
  "subdomain": "string (required, lowercase alphanumeric + hyphens)",
  "domain_suffix": "string (required, e.g., 'startanaicompany.com')",
  "git_repository": "string (required, SSH format: git@...)",
  "git_api_token": "string (required, min 40 chars)"
}
```

### Optional Fields (NEW!)

#### Build & Deployment Configuration

```json
{
  "git_branch": "string (default: 'master')",
  "ports_exposes": "string (default: '3000', e.g., '3000', '8080', '3000,8080')",
  "build_pack": "string (default: 'dockercompose')",
    // Options: 'dockercompose', 'nixpacks', 'dockerfile', 'static'

  "docker_compose_location": "string (default: 'docker-compose.yml')",
  "dockerfile_location": "string (for Dockerfile builds)",
  "static_directory": "string (for static builds)",
  "base_directory": "string",
  "publish_directory": "string"
}
```

#### Custom Commands (NEW!)

```json
{
  "install_command": "string (max 1000 chars, e.g., 'pnpm install')",
  "build_command": "string (max 1000 chars, e.g., 'npm run build:production')",
  "start_command": "string (max 1000 chars, e.g., 'node dist/server.js')",
  "pre_deployment_command": "string (max 1000 chars, e.g., 'npm run migrate')",
  "post_deployment_command": "string (max 1000 chars, e.g., 'npm run seed')"
}
```

#### Resource Limits (NEW!)

```json
{
  "cpu_limit": "string (e.g., '1', '2.5')",
    // Enforced by tier: free=1, starter=2, pro=4, enterprise=unlimited

  "memory_limit": "string (e.g., '512M', '2G')",
    // Enforced by tier: free=1024M, starter=2048M, pro=8192M, enterprise=unlimited

  "memory_swap_limit": "string (e.g., '512M', '2G')",
  "memory_swappiness": "number (0-100)"
}
```

#### Health Check Configuration (NEW!)

```json
{
  "health_check_enabled": "boolean (default: false)",
  "health_check_path": "string (default: '/health')",
  "health_check_port": "number (1-65535)",
  "health_check_interval": "number (seconds)",
  "health_check_timeout": "number (seconds)",
  "health_check_retries": "number (1-10)"
}
```

#### Other Configuration

```json
{
  "template_type": "string (optional, max 100)",
  "environment_variables": "object (max 50 keys)",
  "restart": "string (options: 'always', 'on-failure', 'unless-stopped', 'no')"
}
```

---

## Complete Examples

### Example 1: Basic Docker Compose App (Free Tier)

```bash
curl -X POST https://apps.startanaicompany.com/api/v1/applications \
  -H "X-API-Key: cw_RJ1gH8Sd1nvmPF4lWigu2g3Nkjt1mwEJXYd2aycD0IIniNPhImE5XgWaz3Tcz" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-app",
    "subdomain": "myapp",
    "domain_suffix": "startanaicompany.com",
    "git_repository": "git@git.startanaicompany.com:username/repo.git",
    "git_branch": "main",
    "git_api_token": "7a4821935f9b8304bc2b6380af51d36a97978e4d"
  }'
```

**Result**: App deployed with:
- `build_pack`: "dockercompose" (default)
- `ports_exposes`: "3000" (default)
- `cpu_limit`: "1" (free tier default)
- `memory_limit`: "1024M" (free tier default)

---

### Example 2: Node.js App with Nixpacks (Automatic Detection)

```bash
curl -X POST https://apps.startanaicompany.com/api/v1/applications \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "nodejs-app",
    "subdomain": "nodeapp",
    "domain_suffix": "startanaicompany.com",
    "git_repository": "git@git.startanaicompany.com:username/nodejs-repo.git",
    "git_api_token": "your_token",
    "build_pack": "nixpacks",
    "ports_exposes": "8080",
    "start_command": "node server.js"
  }'
```

**Result**: Nixpacks automatically detects Node.js, runs `npm install`, builds, and starts with custom command.

---

### Example 3: Production App with Health Checks & Pre-Deployment Migration

```bash
curl -X POST https://apps.startanaicompany.com/api/v1/applications \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "production-api",
    "subdomain": "api",
    "domain_suffix": "startanaicompany.com",
    "git_repository": "git@git.startanaicompany.com:username/api.git",
    "git_api_token": "your_token",
    "build_pack": "dockercompose",
    "ports_exposes": "3000",
    "pre_deployment_command": "npm run migrate",
    "health_check_enabled": true,
    "health_check_path": "/api/health",
    "health_check_interval": 30,
    "health_check_retries": 3,
    "restart": "always",
    "environment_variables": {
      "NODE_ENV": "production",
      "LOG_LEVEL": "info"
    }
  }'
```

**Result**:
- Runs `npm run migrate` before deployment
- Health check on `/api/health` every 30 seconds
- Auto-restarts if health check fails 3 times
- Resource limits: 1GB RAM, 1 vCPU (free tier)

---

### Example 4: Custom Port Python App

```bash
curl -X POST https://apps.startanaicompany.com/api/v1/applications \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "python-api",
    "subdomain": "pyapi",
    "domain_suffix": "startanaicompany.com",
    "git_repository": "git@git.startanaicompany.com:username/python-api.git",
    "git_api_token": "your_token",
    "build_pack": "dockerfile",
    "dockerfile_location": "Dockerfile.prod",
    "ports_exposes": "5000"
  }'
```

**Result**: Builds using `Dockerfile.prod`, exposes port 5000, with free tier limits.

---

### Example 5: Static Site with Custom Directory

```bash
curl -X POST https://apps.startanaicompany.com/api/v1/applications \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "landing-page",
    "subdomain": "landing",
    "domain_suffix": "startanaicompany.com",
    "git_repository": "git@git.startanaicompany.com:username/landing.git",
    "git_api_token": "your_token",
    "build_pack": "static",
    "build_command": "npm run build",
    "publish_directory": "dist",
    "ports_exposes": "80"
  }'
```

**Result**: Builds static site, serves from `dist/` directory.

---

## Field Renaming (BREAKING CHANGE)

### Changed Field Names

| Old Name            | New Name          | Impact                                          |
|---------------------|-------------------|-------------------------------------------------|
| `gitea_username`    | `git_username`    | ⚠️ Update registration payload                  |
| `gitea_api_token`   | `git_api_token`   | ⚠️ Update application creation payload          |

### Migration Guide

**Before** (deprecated):
```json
{
  "email": "user@example.com",
  "gitea_username": "myusername",
  "gitea_api_token": "token123"
}
```

**After** (new):
```json
{
  "email": "user@example.com",
  "git_username": "myusername",
  "git_api_token": "token123"
}
```

**CLI Update Required**:
1. Update `POST /api/v1/register` - use `git_username` instead of `gitea_username`
2. Update `POST /api/v1/applications` - use `git_api_token` instead of `gitea_api_token`
3. Update `GET /api/v1/users/me` - expect `git_username` in response

---

## Response Format (Updated)

```json
{
  "id": 42,
  "coolify_app_uuid": "vgsc0gcwgso8wwggc08sc8kw",
  "coolify_project_uuid": "abc123...",
  "app_name": "my-app",
  "subdomain": "myapp",
  "domain": "https://myapp.startanaicompany.com",
  "created_at": "2026-01-25T10:30:00.000Z",
  "webhook_url": "https://apps.startanaicompany.com/api/v1/webhooks/deploy/vgsc0gcwgso8wwggc08sc8kw",
  "deployment_status": "creating",
  "next_steps": [
    "Configure webhook in your Git repository",
    "Push to trigger automatic deployment",
    "Monitor logs: GET /api/v1/applications/vgsc0gcwgso8wwggc08sc8kw/logs"
  ]
}
```

---

## Error Handling

### Tier Limit Exceeded

**Scenario**: Free tier user tries to create 4th application (limit is 3).

**Response**:
```json
{
  "error": "Application limit reached. You have 3 active applications (maximum: 3).",
  "code": "QUOTA_EXCEEDED",
  "current_tier": "free",
  "upgrade_info": "Contact support to upgrade your tier"
}
```

### Invalid Port Format

**Scenario**: User provides invalid `ports_exposes` value.

**Response**:
```json
{
  "error": "Validation failed",
  "details": {
    "ports_exposes": "Ports must be comma-separated numbers (e.g., \"3000\" or \"3000,8080\")"
  },
  "code": "VALIDATION_ERROR"
}
```

### Invalid Build Pack

**Scenario**: User provides unsupported build pack.

**Response**:
```json
{
  "error": "Validation failed",
  "details": {
    "build_pack": "Build pack must be one of: dockercompose, nixpacks, dockerfile, static"
  },
  "code": "VALIDATION_ERROR"
}
```

---

## Testing Scenarios

### Test 1: Verify Tier Limits (Free Tier)

**Goal**: Confirm free tier users get 1GB RAM, 1 vCPU limits.

```bash
# Create app without specifying limits
API_KEY="cw_RJ1gH8Sd1nvmPF4lWigu2g3Nkjt1mwEJXYd2aycD0IIniNPhImE5XgWaz3Tcz"

curl -X POST https://apps.startanaicompany.com/api/v1/applications \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "tier-test-app",
    "subdomain": "tiertest",
    "domain_suffix": "startanaicompany.com",
    "git_repository": "git@git.startanaicompany.com:username/test.git",
    "git_api_token": "token123"
  }'

# Expected Result:
# - Check wrapper logs for: "Prepared Coolify config with tier limits"
# - Verify logs show: cpu_limit="1", memory_limit="1024M"
# - Query Coolify API to confirm application has these limits set
```

**Verification**:
```bash
# Check Coolify application details
curl -s https://app.coolify.io/api/v1/applications/{app_uuid} \
  -H "Authorization: Bearer ${COOLIFY_API_TOKEN}" \
  | jq '{cpu_limit, memory_limit}'

# Expected output:
# {
#   "cpu_limit": "1",
#   "memory_limit": "1024M"
# }
```

---

### Test 2: Verify Tier Enforcement

**Goal**: Confirm free tier user cannot exceed 1GB RAM limit.

```bash
curl -X POST https://apps.startanaicompany.com/api/v1/applications \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "exceed-limit-test",
    "subdomain": "exceedtest",
    "domain_suffix": "startanaicompany.com",
    "git_repository": "git@git.startanaicompany.com:username/test.git",
    "git_api_token": "token123",
    "memory_limit": "4096M",
    "cpu_limit": "4"
  }'

# Expected Result:
# - Wrapper caps at tier limits: cpu_limit="1", memory_limit="1024M"
# - No error returned (silent capping)
# - Logs show: "Applied tier limits: free"
```

---

### Test 3: Custom Build Pack (Nixpacks)

**Goal**: Verify non-Docker Compose builds work.

```bash
curl -X POST https://apps.startanaicompany.com/api/v1/applications \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "nixpacks-test",
    "subdomain": "nixtest",
    "domain_suffix": "startanaicompany.com",
    "git_repository": "git@git.startanaicompany.com:username/nodejs-app.git",
    "git_api_token": "token123",
    "build_pack": "nixpacks",
    "ports_exposes": "8080"
  }'

# Expected Result:
# - Application created with build_pack="nixpacks"
# - Coolify uses Nixpacks to detect and build Node.js app
# - Port 8080 exposed (not default 3000)
```

---

### Test 4: Health Checks Enabled

**Goal**: Verify health check configuration is passed to Coolify.

```bash
curl -X POST https://apps.startanaicompany.com/api/v1/applications \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "health-check-test",
    "subdomain": "healthtest",
    "domain_suffix": "startanaicompany.com",
    "git_repository": "git@git.startanaicompany.com:username/api.git",
    "git_api_token": "token123",
    "health_check_enabled": true,
    "health_check_path": "/api/health",
    "health_check_interval": 30
  }'

# Verification:
curl -s https://app.coolify.io/api/v1/applications/{app_uuid} \
  -H "Authorization: Bearer ${COOLIFY_API_TOKEN}" \
  | jq '{health_check_enabled, health_check_path, health_check_interval}'

# Expected output:
# {
#   "health_check_enabled": true,
#   "health_check_path": "/api/health",
#   "health_check_interval": 30
# }
```

---

### Test 5: Pre-Deployment Command

**Goal**: Verify pre-deployment hooks run before deployment.

```bash
curl -X POST https://apps.startanaicompany.com/api/v1/applications \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "migration-test",
    "subdomain": "migtest",
    "domain_suffix": "startanaicompany.com",
    "git_repository": "git@git.startanaicompany.com:username/db-app.git",
    "git_api_token": "token123",
    "pre_deployment_command": "npm run migrate"
  }'

# Verification:
# - Deploy the application: POST /api/v1/applications/{uuid}/deploy
# - Check deployment logs: GET /api/v1/applications/{uuid}/logs
# - Verify logs show: "Running pre-deployment command: npm run migrate"
# - Confirm migration ran before app started
```

---

## Summary of Changes for CLI Team

### Action Items

1. **Update field names** in all API calls:
   - `gitea_username` → `git_username`
   - `gitea_api_token` → `git_api_token`

2. **Add support for new optional fields**:
   - `ports_exposes` - Allow users to specify custom ports
   - `build_pack` - Allow selection of build method (dockercompose, nixpacks, dockerfile, static)
   - `pre_deployment_command` - For database migrations
   - `health_check_enabled` - For production deployments

3. **Update documentation**:
   - Explain tier-based resource limits (all users start on free tier: 1GB RAM, 1 vCPU)
   - Document new build pack options
   - Add examples for health checks and deployment hooks

4. **Testing**:
   - Test creating apps with custom ports (e.g., 8080, 5000)
   - Test Nixpacks build (simple Node.js app without docker-compose.yml)
   - Verify tier limits are applied (check Coolify app config after creation)
   - Test pre-deployment command (migration scenario)

---

## Questions?

If you have any questions about these changes, please:

1. Check the updated OpenAPI docs at: https://apps.startanaicompany.com/api-docs
2. Review the wrapper source code at: `src/services/application.js`, `src/utils/validators.js`
3. Test against the live wrapper API: https://apps.startanaicompany.com

---

## UPDATE Configuration Endpoint (NEW!)

### Endpoint: `PATCH /api/v1/applications/:uuid`

**Status**: ✅ **IMPLEMENTED** (2026-01-25)

All configuration fields that can be set during creation can now be **updated after deployment** using this endpoint.

### Use Cases

- Change port from 3000 to 8080
- Switch from Docker Compose to Nixpacks build
- Enable/disable health checks
- Adjust resource limits (within tier constraints)
- Update custom build commands
- Change restart policy

### Request Format

```bash
PATCH https://apps.startanaicompany.com/api/v1/applications/{app_uuid}
Content-Type: application/json
X-API-Key: cw_...

{
  "ports_exposes": "8080",
  "health_check_enabled": true,
  "health_check_path": "/health",
  "cpu_limit": "2",
  "memory_limit": "2048M"
}
```

### All Updatable Fields

```json
{
  // Basic fields
  "name": "my-updated-app-name",
  "git_branch": "develop",
  "environment_variables": { "KEY": "value" },

  // Build & Deployment
  "ports_exposes": "8080",
  "build_pack": "nixpacks",
  "docker_compose_location": "docker-compose.prod.yml",
  "dockerfile_location": "Dockerfile.prod",
  "static_directory": "dist",

  // Custom Commands
  "install_command": "npm ci",
  "build_command": "npm run build:prod",
  "start_command": "npm run start:prod",
  "pre_deployment_command": "npm run migrate",
  "post_deployment_command": "npm run seed",

  // Resource Limits (capped at tier limits!)
  "cpu_limit": "2",
  "memory_limit": "2048M",
  "memory_swap_limit": "2048M",
  "memory_swappiness": 60,

  // Health Checks
  "health_check_enabled": true,
  "health_check_path": "/api/health",
  "health_check_port": 8080,
  "health_check_interval": 30,
  "health_check_timeout": 5,
  "health_check_retries": 3,

  // Restart Policy
  "restart": "on-failure"
}
```

### Response Format

```json
{
  "success": true,
  "message": "Application configuration updated successfully",
  "uuid": "vgsc0gcwgso8wwggc08sc8kw",
  "updated_fields": [
    "ports_exposes",
    "health_check_enabled",
    "health_check_path"
  ],
  "applied_tier_limits": false
}
```

### Important Notes

1. **Tier Limits Enforced**: Resource limits (CPU/memory) are capped at user's tier maximum
2. **Partial Updates**: You only need to send fields you want to update (not all fields)
3. **Redeploy Required**: After updating configuration, you must redeploy for changes to take effect:
   ```bash
   POST /api/v1/applications/{uuid}/deploy
   ```
4. **Free Tier Users**: Any CPU/memory requests above 1 vCPU / 1GB will be capped automatically

### Example: Update Port and Enable Health Checks

```bash
# 1. Update configuration
curl -X PATCH "https://apps.startanaicompany.com/api/v1/applications/vgsc0gcwgso8wwggc08sc8kw" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "ports_exposes": "8080",
    "health_check_enabled": true,
    "health_check_path": "/health"
  }'

# 2. Redeploy to apply changes
curl -X POST "https://apps.startanaicompany.com/api/v1/applications/vgsc0gcwgso8wwggc08sc8kw/deploy" \
  -H "X-API-Key: $API_KEY"
```

### Example: Try to Exceed Tier Limits (Free Tier)

```bash
# Free tier user tries to request 4 vCPU and 4GB RAM
curl -X PATCH "https://apps.startanaicompany.com/api/v1/applications/vgsc0gcwgso8wwggc08sc8kw" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "cpu_limit": "4",
    "memory_limit": "4096M"
  }'

# Response: Limits will be capped at 1 vCPU / 1GB
{
  "success": true,
  "message": "Application configuration updated successfully",
  "uuid": "vgsc0gcwgso8wwggc08sc8kw",
  "updated_fields": ["cpu_limit", "memory_limit"],
  "applied_tier_limits": true  // ← Indicates limits were capped
}
```

### CLI Implementation Suggestion

```bash
# saac update <app> [options]
saac update my-app \
  --port 8080 \
  --health-check \
  --health-path /api/health \
  --cpu 2 \
  --memory 2G

# Example output:
# ✓ Configuration updated (3 fields changed)
# ⚠ Resource limits capped at your tier (free: 1 vCPU, 1GB)
# ℹ Run 'saac deploy my-app' to apply changes
```

---

**Generated**: 2026-01-25
**Author**: Coolify Wrapper Team
**Version**: 2.1.0 (Added PATCH endpoint)
