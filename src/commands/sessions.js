/**
 * Sessions command - List active sessions
 */

const api = require('../lib/api');
const { isAuthenticated } = require('../lib/config');
const logger = require('../lib/logger');
const { table } = require('table');

async function sessions() {
  try {
    // Check authentication
    if (!isAuthenticated()) {
      logger.error('Not logged in');
      logger.newline();
      logger.info('Run:');
      logger.log('  saac login -e <email> -k <api-key>');
      process.exit(1);
    }

    logger.section('Active Sessions');

    const spin = logger.spinner('Fetching sessions...').start();

    try {
      const client = api.createClient();
      const response = await client.get('/auth/sessions');
      const { sessions: sessionList, total } = response.data;

      spin.succeed(`Found ${total} active session(s)`);

      if (total === 0) {
        logger.newline();
        logger.info('No active sessions');
        return;
      }

      logger.newline();

      // Format sessions as table
      const data = [
        ['Created', 'Last Used', 'IP Address', 'Expires'],
      ];

      sessionList.forEach((session) => {
        const created = new Date(session.created_at).toLocaleDateString();
        const lastUsed = new Date(session.last_used_at).toLocaleString();
        const expires = new Date(session.expires_at).toLocaleDateString();
        const ip = session.created_ip || 'Unknown';

        data.push([created, lastUsed, ip, expires]);
      });

      console.log(table(data, {
        header: {
          alignment: 'center',
          content: `${total} Active Session(s)`,
        },
      }));

      logger.newline();
      logger.info('Tip: Use `saac logout` to logout from current device');
      logger.info('     Use `saac logout-all` to logout from all devices');

    } catch (error) {
      spin.fail('Failed to fetch sessions');
      throw error;
    }
  } catch (error) {
    logger.error(error.response?.data?.message || error.message);
    process.exit(1);
  }
}

module.exports = sessions;
