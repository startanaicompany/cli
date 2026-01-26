/**
 * List command - List all user applications
 */

const api = require('../lib/api');
const { isAuthenticated } = require('../lib/config');
const logger = require('../lib/logger');
const { table } = require('table');

async function list() {
  try {
    // Check authentication
    if (!isAuthenticated()) {
      logger.error('Not logged in');
      logger.newline();
      logger.info('Run:');
      logger.log('  saac login -e <email> -k <api-key>');
      process.exit(1);
    }

    const spin = logger.spinner('Fetching applications...').start();

    try {
      const result = await api.listApplications();
      const applications = Array.isArray(result) ? result : (result.applications || []);

      spin.succeed(`Found ${applications.length} application(s)`);

      if (applications.length === 0) {
        logger.newline();
        logger.info('No applications yet');
        logger.newline();
        logger.info('Create one with:');
        logger.log('  saac create <name> -s <subdomain> -r <repository> -t <git-token>');
        logger.newline();
        logger.info('Example:');
        logger.log('  saac create my-app -s myapp -r git@git.startanaicompany.com:user/repo.git -t abc123');
        return;
      }

      logger.newline();

      // Build table data
      const data = [
        ['Name', 'Domain', 'Status', 'Branch', 'Created'],
      ];

      applications.forEach((app) => {
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
          app.git_branch || 'master',
          created
        ]);
      });

      console.log(table(data, {
        header: {
          alignment: 'center',
          content: `Your Applications (${applications.length} total)`,
        },
      }));

      logger.info('Commands:');
      logger.log('  saac init                Link application to current directory');
      logger.log('  saac status              Show detailed status');
      logger.log('  saac create <name> ...   Create new application');

    } catch (error) {
      spin.fail('Failed to fetch applications');
      throw error;
    }

  } catch (error) {
    logger.error(error.response?.data?.message || error.message);
    process.exit(1);
  }
}

module.exports = list;
