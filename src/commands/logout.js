const api = require('../lib/api');
const { clearUser, getUser } = require('../lib/config');
const logger = require('../lib/logger');

async function logout() {
  try {
    const user = getUser();

    if (!user || (!user.sessionToken && !user.apiKey)) {
      logger.warn('You are not logged in');
      return;
    }

    logger.section('Logout from StartAnAiCompany');

    const spin = logger.spinner('Logging out...').start();

    try {
      // Try to revoke session on server
      const client = api.createClient();
      await client.post('/auth/logout');

      // Clear local config
      clearUser();

      spin.succeed('Logout successful!');
      logger.success('You have been logged out from this device');

    } catch (error) {
      // Even if server call fails, clear local config
      clearUser();

      if (error.response?.status === 401) {
        // Session already invalid
        spin.succeed('Logged out locally (session was expired)');
      } else {
        spin.warn('Logged out locally (server error)');
        logger.warn('Session may still be active on server');
      }
    }
  } catch (error) {
    logger.error(error.message);
    process.exit(1);
  }
}

module.exports = logout;
