/**
 * Environment Variables Commands - Manage application environment variables
 */

const api = require('../lib/api');
const { getProjectConfig, ensureAuthenticated } = require('../lib/config');
const logger = require('../lib/logger');
const { table } = require('table');

/**
 * Get environment variable(s)
 * @param {string} key - Optional specific variable key to retrieve
 */
async function get(key) {
  try {
    // Check authentication
    if (!(await ensureAuthenticated())) {
      logger.error('Not logged in');
      logger.info('Run: saac login -e <email> -k <api-key>');
      logger.info('Or set: SAAC_USER_API_KEY and SAAC_USER_EMAIL');
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

    const spin = logger.spinner('Fetching environment variables...').start();

    try {
      const result = await api.getEnvironmentVariables(applicationUuid);

      spin.succeed('Environment variables retrieved');

      logger.newline();

      if (!key) {
        // Display all variables
        if (Object.keys(result.variables).length === 0) {
          logger.warn('No environment variables set');
          logger.newline();
          logger.info('Set variables with:');
          logger.log('  saac env set KEY=value');
          return;
        }

        logger.section(`Environment Variables: ${applicationName}`);
        logger.newline();

        // Create table data
        const data = [
          ['Key', 'Value'],
        ];

        for (const [envKey, value] of Object.entries(result.variables)) {
          const maskedValue = maskSensitiveValue(envKey, value);
          data.push([envKey, maskedValue]);
        }

        console.log(table(data));

        logger.info(`Total: ${result.variable_count} / ${result.max_variables} variables`);
      } else {
        // Display specific variable
        if (result.variables[key]) {
          logger.section(`Environment Variable: ${key}`);
          logger.newline();
          logger.field('Key', key);
          logger.field('Value', result.variables[key]);
        } else {
          logger.error(`Variable '${key}' not found`);
          logger.newline();
          logger.info('List all variables:');
          logger.log('  saac env list');
          process.exit(1);
        }
      }

    } catch (error) {
      spin.fail('Failed to fetch environment variables');
      throw error;
    }

  } catch (error) {
    logger.error(error.response?.data?.message || error.message);
    process.exit(1);
  }
}

/**
 * List all environment variables (alias for get with no key)
 */
async function list() {
  return get();
}

/**
 * Set environment variables
 * @param {string[]} vars - Array of KEY=VALUE pairs
 */
async function set(vars) {
  try {
    // Check authentication
    if (!(await ensureAuthenticated())) {
      logger.error('Not logged in');
      logger.info('Run: saac login -e <email> -k <api-key>');
      logger.info('Or set: SAAC_USER_API_KEY and SAAC_USER_EMAIL');
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

    const { applicationUuid } = projectConfig;

    // Validate arguments
    if (vars.length === 0) {
      logger.error('No variables specified');
      logger.newline();
      logger.info('Usage:');
      logger.log('  saac env set KEY=VALUE [KEY2=VALUE2 ...]');
      logger.newline();
      logger.info('Examples:');
      logger.log('  saac env set NODE_ENV=production');
      logger.log('  saac env set LOG_LEVEL=debug API_URL=https://api.example.com');
      process.exit(1);
    }

    // Parse KEY=VALUE pairs
    const variables = {};
    for (const arg of vars) {
      const equalIndex = arg.indexOf('=');
      if (equalIndex === -1) {
        logger.error(`Invalid format: ${arg}`);
        logger.info('Variables must be in KEY=VALUE format');
        logger.newline();
        logger.info('Example:');
        logger.log('  saac env set NODE_ENV=production');
        process.exit(1);
      }

      const key = arg.substring(0, equalIndex).trim();
      const value = arg.substring(equalIndex + 1);

      if (!key) {
        logger.error(`Empty key in: ${arg}`);
        process.exit(1);
      }

      // Validate key format (uppercase alphanumeric + underscore)
      const keyRegex = /^[A-Z0-9_]+$/;
      if (!keyRegex.test(key)) {
        logger.error(`Invalid key format: ${key}`);
        logger.info('Keys must be uppercase alphanumeric with underscores only');
        logger.newline();
        logger.info('Valid examples:');
        logger.log('  NODE_ENV, LOG_LEVEL, DATABASE_URL, API_KEY');
        logger.newline();
        logger.info('Invalid examples:');
        logger.log('  node-env (lowercase/hyphen), 123ABC (starts with number)');
        process.exit(1);
      }

      variables[key] = value;
    }

    logger.section('Updating Environment Variables');
    logger.newline();

    // Show what will be updated
    logger.info('Variables to set:');
    for (const [key, value] of Object.entries(variables)) {
      const displayValue = maskSensitiveValue(key, value);
      logger.field(`  ${key}`, displayValue);
    }

    logger.newline();

    const spin = logger.spinner('Updating environment variables...').start();

    try {
      await api.updateEnvironmentVariables(applicationUuid, variables);

      spin.succeed('Environment variables updated successfully!');

      logger.newline();

      logger.success(`Set ${Object.keys(variables).length} variable(s)`);

      logger.newline();
      logger.warn('Changes require redeployment to take effect');
      logger.info('Run:');
      logger.log('  saac deploy');

    } catch (error) {
      spin.fail('Failed to update environment variables');

      if (error.response?.status === 400) {
        logger.newline();
        const data = error.response.data;
        if (data.error === 'QUOTA_EXCEEDED') {
          logger.warn('Maximum number of environment variables exceeded');
          logger.newline();
          logger.info('Details:');
          logger.field('  Limit', data.details?.limit || 50);
          logger.field('  Current', data.details?.current || 'unknown');
          logger.field('  Requested', data.details?.requested || vars.length);
        }
      }

      throw error;
    }

  } catch (error) {
    logger.error(error.response?.data?.message || error.message);
    process.exit(1);
  }
}

/**
 * Mask sensitive values for display
 * @param {string} key - Variable key
 * @param {string} value - Variable value
 * @returns {string} Masked value if sensitive, original otherwise
 */
function maskSensitiveValue(key, value) {
  const sensitivePatterns = [
    'PASSWORD', 'SECRET', 'KEY', 'TOKEN',
    'DATABASE_URL', 'DB_URL', 'PRIVATE', 'AUTH'
  ];

  const isSensitive = sensitivePatterns.some(pattern =>
    key.toUpperCase().includes(pattern)
  );

  if (!isSensitive) {
    return value;
  }

  // Mask sensitive values
  if (value.length <= 8) {
    return '***';
  }

  return value.substring(0, 4) + '***' + value.substring(value.length - 4);
}

module.exports = {
  get,
  list,
  set,
};
