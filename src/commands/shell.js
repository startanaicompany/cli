/**
 * Shell Command - Open interactive shell with remote environment variables
 */

const api = require('../lib/api');
const { getProjectConfig, isAuthenticated } = require('../lib/config');
const logger = require('../lib/logger');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// In-memory cache for environment variables (5 minutes TTL)
const envCache = new Map();
const CACHE_TTL = 300000; // 5 minutes in milliseconds

/**
 * Get environment variables (with caching)
 * @param {string} appUuid - Application UUID
 * @param {boolean} forceRefresh - Skip cache and fetch fresh
 */
async function getEnvironmentVariables(appUuid, forceRefresh = false) {
  // Check cache first
  if (!forceRefresh) {
    const cached = envCache.get(appUuid);
    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age < CACHE_TTL) {
        logger.info('📦 Using cached environment variables (updated <5 min ago)');
        return cached.data;
      }
      // Cache expired
      envCache.delete(appUuid);
    }
  }

  // Fetch from API
  const client = api.createClient();
  const response = await client.get(`/applications/${appUuid}/env/export`);

  // Cache for 5 minutes
  envCache.set(appUuid, {
    data: response.data,
    timestamp: Date.now()
  });

  return response.data;
}

/**
 * Open interactive shell with remote environment variables
 * @param {object} options - Command options
 */
async function shell(options = {}) {
  try {
    // Check authentication
    if (!isAuthenticated()) {
      logger.error('Not logged in. Run: saac login');
      process.exit(1);
    }

    // Check for project config
    const projectConfig = getProjectConfig();
    if (!projectConfig || !projectConfig.applicationUuid) {
      logger.error('No application found in current directory');
      logger.info('Run this command from a project directory (must have .saac/config.json)');
      logger.newline();
      logger.info('Or initialize with:');
      logger.log('  saac init');
      process.exit(1);
    }

    const { applicationUuid, applicationName } = projectConfig;

    // Fetch environment variables
    logger.newline();
    const spin = logger.spinner('Fetching environment variables...').start();

    let envData;
    try {
      envData = await getEnvironmentVariables(applicationUuid, options.sync);
      spin.succeed('Environment variables retrieved');
    } catch (error) {
      spin.fail('Failed to fetch environment variables');

      if (error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'] || 60;
        logger.newline();
        logger.error(`Rate limit exceeded. Too many requests.`);
        logger.info(`Retry in ${retryAfter} seconds.`);
        logger.newline();
        logger.info('Note: Environment variables are cached for 5 minutes.');
        process.exit(1);
      }

      throw error;
    }

    logger.newline();

    // Create temp file for environment variables
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `saac-env-${applicationUuid}.sh`);

    // Write export script to temp file with secure permissions
    fs.writeFileSync(tempFile, envData.export_script, { mode: 0o600 });

    // Setup cleanup handlers
    const cleanup = () => {
      try {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      } catch (err) {
        // Ignore cleanup errors
      }
    };

    process.on('SIGINT', () => {
      cleanup();
      process.exit(130);
    });

    process.on('SIGTERM', () => {
      cleanup();
      process.exit(143);
    });

    // Determine shell to use
    const userShell = options.cmd || process.env.SHELL || '/bin/bash';
    const shellName = path.basename(userShell);

    // Display info
    logger.success(`🚀 Opening shell with ${envData.variable_count} environment variables loaded`);
    logger.newline();
    logger.field('  Application', applicationName);
    logger.field('  Shell', shellName);
    logger.field('  Variables', envData.variable_count);
    logger.newline();
    logger.warn('⚠️  Secrets are exposed on local machine');
    logger.info(`Temporary file: ${tempFile} (will be deleted on exit)`);
    logger.newline();
    logger.info('Type "exit" or press Ctrl+D to close the shell');
    logger.section('─'.repeat(60));
    logger.newline();

    // Simple approach: Use bash to source env file, then exec into requested shell
    // Force interactive mode with -i flag
    const shellCommand = `source "${tempFile}" && exec ${userShell} -i`;

    const shellProc = spawn('/bin/bash', ['-c', shellCommand], {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: {
        ...process.env,
        SAAC_ENV_LOADED: '1',
        SAAC_APP_NAME: applicationName,
        SAAC_APP_UUID: applicationUuid
      }
    });

    shellProc.on('exit', (code) => {
      cleanup();
      logger.newline();
      logger.success('✓ Shell closed, environment variables cleared');
      process.exit(code || 0);
    });

    shellProc.on('error', (error) => {
      cleanup();
      logger.newline();
      logger.error(`Failed to open shell: ${error.message}`);
      process.exit(1);
    });

  } catch (error) {
    logger.error(error.response?.data?.message || error.message);
    process.exit(1);
  }
}

module.exports = shell;
