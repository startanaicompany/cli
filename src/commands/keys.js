/**
 * API Key management commands
 */

const api = require('../lib/api');
const { getUser, isAuthenticated } = require('../lib/config');
const logger = require('../lib/logger');
const inquirer = require('inquirer');

/**
 * Regenerate API key
 */
async function regenerate() {
  try {
    // Must be authenticated (via session token)
    if (!isAuthenticated()) {
      logger.error('Not logged in');
      logger.newline();
      logger.info('You must be logged in to regenerate your API key');
      logger.newline();
      logger.info('Login using email verification:');
      logger.log('  saac login -e <email>           # Request OTP');
      logger.log('  saac login -e <email> --otp <code>  # Verify OTP');
      process.exit(1);
    }

    const user = getUser();

    logger.section('Regenerate API Key');
    logger.newline();

    logger.warn('This will generate a new API key and invalidate your current one.');
    logger.warn('Your active session tokens will continue to work.');
    logger.newline();

    // Confirmation prompt
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Are you sure you want to regenerate your API key?',
        default: false,
      },
    ]);

    if (!confirm) {
      logger.info('Cancelled');
      return;
    }

    const spin = logger.spinner('Generating new API key...').start();

    try {
      const result = await api.regenerateApiKey();

      spin.succeed('New API key generated!');

      logger.newline();
      logger.success('Your new API key:');
      logger.newline();

      // Show FULL API key (it's only shown once)
      logger.field('API Key', result.api_key);

      logger.newline();
      logger.warn('Save this key securely. It will not be shown again.');
      logger.newline();

      logger.info('Your existing sessions remain active.');
      logger.info('Use this new key for future logins or CI/CD.');
      logger.newline();

      logger.info('To login with the new key:');
      logger.log(`  saac login -e ${user.email} -k ${result.api_key}`);

    } catch (error) {
      spin.fail('Failed to regenerate API key');
      throw error;
    }
  } catch (error) {
    logger.error(error.response?.data?.message || error.message);
    process.exit(1);
  }
}

/**
 * Show API key info (without revealing full key)
 */
async function show() {
  try {
    if (!isAuthenticated()) {
      logger.error('Not logged in');
      logger.newline();
      logger.info('Login first:');
      logger.log('  saac login -e <email>');
      process.exit(1);
    }

    logger.section('API Key Information');
    logger.newline();

    const spin = logger.spinner('Fetching API key info...').start();

    try {
      const result = await api.getApiKeyInfo();

      spin.succeed('API key info retrieved');

      logger.newline();
      logger.field('Key Prefix', result.key_prefix); // e.g., "cw_RJ1gH8..."
      logger.field('Created', new Date(result.created_at).toLocaleDateString());
      logger.field('Last Used', result.last_used_at
        ? new Date(result.last_used_at).toLocaleString()
        : 'Never');

      logger.newline();
      logger.info('Commands:');
      logger.log('  saac keys regenerate    Generate new API key');
      logger.log('  saac sessions           View active sessions');

    } catch (error) {
      spin.fail('Failed to fetch API key info');

      // If endpoint doesn't exist yet, show helpful message
      if (error.response?.status === 404) {
        logger.newline();
        logger.warn('API key info endpoint not available yet');
        logger.info('You can still regenerate your key with:');
        logger.log('  saac keys regenerate');
      } else {
        throw error;
      }
    }
  } catch (error) {
    logger.error(error.response?.data?.message || error.message);
    process.exit(1);
  }
}

module.exports = {
  regenerate,
  show,
};
