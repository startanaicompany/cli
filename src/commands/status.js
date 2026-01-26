/**
 * Status command - Show current login and account status
 */

const api = require('../lib/api');
const { getUser, isAuthenticated, isTokenExpiringSoon } = require('../lib/config');
const logger = require('../lib/logger');
const { table } = require('table');

async function status() {
  try {
    logger.section('SAAC Status');
    logger.newline();

    // Check if logged in locally (silently)
    if (!isAuthenticated()) {
      logger.error('Not logged in');
      logger.newline();
      logger.info('Run:');
      logger.log('  saac login -e <email> -k <api-key>');
      process.exit(1);
    }

    const user = getUser();

    // Verify session with server first
    const spin = logger.spinner('Verifying session...').start();

    try {
      const client = api.createClient();
      const [userInfo, appsResponse] = await Promise.all([
        client.get('/users/me'),
        client.get('/applications')
      ]);

      spin.succeed('Session verified');

      const userData = userInfo.data;
      const applicationsData = appsResponse.data;
      const applications = Array.isArray(applicationsData) ? applicationsData :
                          (applicationsData.applications || []);

      logger.newline();

      // NOW show login status (after successful verification)
      logger.field('Status', logger.chalk.green('✓ Logged in'));
      logger.field('Email', user.email);
      logger.field('Verified', user.verified ? logger.chalk.green('Yes') : logger.chalk.red('No'));

      // Show session info
      if (user.sessionToken) {
        const expiresAt = new Date(user.expiresAt);
        const now = new Date();
        const daysUntilExpiry = Math.floor((expiresAt - now) / (1000 * 60 * 60 * 24));

        logger.field('Session expires', expiresAt.toLocaleDateString());

        if (isTokenExpiringSoon()) {
          logger.field('Warning', logger.chalk.yellow(`⚠ Session expires in ${daysUntilExpiry} days`));
        } else {
          logger.field('Days until expiry', daysUntilExpiry);
        }
      }

      logger.newline();

      // Show account info
      logger.field('User ID', userData.id);

      // Show OAuth connections (new system) or legacy git_username
      if (userData.git_connections && userData.git_connections.length > 0) {
        // Show all OAuth connections
        userData.git_connections.forEach((conn, index) => {
          const label = index === 0 ? 'Git Connection' : '               '; // Align subsequent connections
          logger.field(label, `${conn.gitUsername} @ ${conn.gitHost}`);
        });
      } else if (userData.git_username) {
        // Legacy system - user has git_username but no OAuth
        logger.field('Git Username', userData.git_username + ' (legacy)');
      } else {
        logger.field('Git Connection', 'Not connected (use OAuth to connect)');
      }

      logger.field('Applications', `${userData.application_count} / ${userData.max_applications}`);

      logger.newline();

      // Show applications (max 5)
      if (applications.length === 0) {
        logger.info('No applications yet');
        logger.newline();
        logger.info('Create one with: ' + logger.chalk.cyan('saac create <name>'));
      } else {
        const displayApps = applications.slice(0, 5);
        const hasMore = applications.length > 5;

        const data = [
          ['Name', 'Domain', 'Status', 'Created'],
        ];

        displayApps.forEach((app) => {
          const created = new Date(app.created_at).toLocaleDateString();
          const status = app.status || 'unknown';

          // Status with icons (handle both Coolify format and documented format)
          let statusDisplay;
          if (status.startsWith('running')) {
            statusDisplay = logger.chalk.green('Running ✓');
          } else if (status.startsWith('stopped')) {
            statusDisplay = logger.chalk.yellow('Stopped');
          } else {
            switch (status) {
              case 'active':
                statusDisplay = logger.chalk.green('Active ✓');
                break;
              case 'creating':
                statusDisplay = logger.chalk.yellow('Creating...');
                break;
              case 'error':
                statusDisplay = logger.chalk.red('Error ✗');
                break;
              case 'suspended':
                statusDisplay = logger.chalk.yellow('Suspended ⚠');
                break;
              default:
                statusDisplay = logger.chalk.gray(status);
            }
          }

          data.push([
            app.name,
            app.domain || `${app.subdomain}.startanaicompany.com`,
            statusDisplay,
            created
          ]);
        });

        console.log(table(data, {
          header: {
            alignment: 'center',
            content: `Applications (showing ${displayApps.length} of ${applications.length})`,
          },
        }));

        if (hasMore) {
          logger.warn(`Showing first 5 applications only. You have ${applications.length - 5} more.`);
          logger.info('Run ' + logger.chalk.cyan('saac list') + ' to see all applications');
        }
      }

    } catch (error) {
      spin.fail('Session verification failed');

      logger.newline();

      if (error.response?.status === 401) {
        logger.error('Your session has expired or is invalid');
        logger.newline();
        logger.field('Email', user.email);
        logger.field('Local session expires', new Date(user.expiresAt).toLocaleDateString());
        logger.newline();
        logger.warn('The session token is no longer valid on the server');
        logger.info('Please login again:');
        logger.log('  saac login -e ' + user.email + ' -k <api-key>');
      } else {
        logger.error('Failed to connect to server');
        logger.error(error.message);
      }
      process.exit(1);
    }

  } catch (error) {
    logger.error(error.response?.data?.message || error.message);
    process.exit(1);
  }
}

module.exports = status;
