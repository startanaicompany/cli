/**
 * Logout All command - Revoke all sessions
 */

const inquirer = require('inquirer');
const api = require('../lib/api');
const { clearUser, isAuthenticated } = require('../lib/config');
const logger = require('../lib/logger');

async function logoutAll(options) {
  try {
    // Check authentication
    if (!isAuthenticated()) {
      logger.error('Not logged in');
      process.exit(1);
    }

    logger.section('Logout from All Devices');

    // Confirm unless --yes flag is provided
    if (!options.yes) {
      logger.warn('This will logout from ALL devices where you are logged in');
      logger.newline();

      const answers = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Are you sure you want to continue?',
          default: false,
        },
      ]);

      if (!answers.confirm) {
        logger.info('Cancelled');
        return;
      }
    }

    const spin = logger.spinner('Revoking all sessions...').start();

    try {
      const client = api.createClient();
      const response = await client.post('/auth/logout-all');

      // Clear local config
      clearUser();

      const count = response.data.sessions_revoked || 0;
      spin.succeed(`Logged out from ${count} device(s)!`);

      logger.newline();
      logger.success('All sessions have been revoked');
      logger.info('You will need to login again on all devices');

    } catch (error) {
      // Even if server call fails, clear local config
      clearUser();

      if (error.response?.status === 401) {
        spin.succeed('Logged out locally (session was expired)');
      } else {
        spin.fail('Failed to revoke sessions on server');
        logger.warn('Logged out locally, but server sessions may still be active');
        throw error;
      }
    }
  } catch (error) {
    logger.error(error.response?.data?.message || error.message);
    process.exit(1);
  }
}

module.exports = logoutAll;
