/**
 * API Key management commands
 */

const api = require('../lib/api');
const { getUser, ensureAuthenticated } = require('../lib/config');
const logger = require('../lib/logger');
const inquirer = require('inquirer');

/**
 * Regenerate API key
 */
async function regenerate() {
  try {
    // Must be authenticated (via session token)
    if (!(await ensureAuthenticated())) {
      logger.error('Not logged in');
      logger.newline();
      logger.info('You must be logged in to regenerate your API key');
      logger.newline();
      logger.info('Login using email verification:');
      logger.log('  saac login -e <email>           # Request OTP');
      logger.log('  saac login -e <email> --otp <code>  # Verify OTP');
      logger.newline();
      logger.info('Or set environment variables:');
      logger.log('  export SAAC_USER_API_KEY=your_api_key');
      logger.log('  export SAAC_USER_EMAIL=your_email');
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

module.exports = {
  regenerate,
};
