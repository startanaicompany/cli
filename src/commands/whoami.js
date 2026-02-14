/**
 * Whoami Command - Show current user information
 */

const api = require('../lib/api');
const { ensureAuthenticated } = require('../lib/config');
const logger = require('../lib/logger');

/**
 * Display current authenticated user information
 */
async function whoami() {
  try {
    // Check authentication
    if (!(await ensureAuthenticated())) {
      logger.error('Not logged in');
      logger.info('Run: saac login -e <email> -k <api-key>');
      logger.info('Or set: SAAC_USER_API_KEY and SAAC_USER_EMAIL');
      process.exit(1);
    }

    const spin = logger.spinner('Fetching user information...').start();

    try {
      const user = await api.getUserInfo();

      spin.succeed('User information retrieved');

      logger.newline();

      logger.section('Current User');
      logger.newline();

      logger.field('Email', user.email);
      logger.field('User ID', user.id);
      logger.field('Verified', user.verified ? logger.chalk.green('Yes ✓') : logger.chalk.red('No ✗'));
      logger.field('Member Since', formatDate(user.created_at));

      logger.newline();

      // Git Connections
      if (user.git_connections && user.git_connections.length > 0) {
        logger.info('Git Connections:');
        for (const conn of user.git_connections) {
          logger.log(`  • ${conn.gitUsername} @ ${conn.gitHost} (${conn.providerType})`);
          logger.log(`    Connected: ${formatDate(conn.connectedAt)}`);
        }
        logger.newline();
      }

      // Quotas
      logger.info('Quotas:');
      logger.field('  Applications', `${user.application_count} / ${user.max_applications}`);

      logger.newline();

      logger.info('Commands:');
      logger.log('  View applications: ' + logger.chalk.cyan('saac list'));
      logger.log('  View status:       ' + logger.chalk.cyan('saac status'));
      logger.log('  Logout:            ' + logger.chalk.cyan('saac logout'));

    } catch (error) {
      spin.fail('Failed to fetch user information');
      throw error;
    }

  } catch (error) {
    logger.error(error.response?.data?.message || error.message);
    process.exit(1);
  }
}

/**
 * Format ISO date string to readable format
 * @param {string} isoString - ISO 8601 date string
 * @returns {string} Formatted date
 */
function formatDate(isoString) {
  if (!isoString) return 'N/A';

  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

module.exports = whoami;
