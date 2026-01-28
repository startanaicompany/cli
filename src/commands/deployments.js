/**
 * Deployments command - List deployment history
 */

const api = require('../lib/api');
const { getProjectConfig, isAuthenticated } = require('../lib/config');
const logger = require('../lib/logger');
const { table } = require('table');

async function deployments(options) {
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

    logger.section(`Deployment History: ${applicationName}`);
    logger.newline();

    const spin = logger.spinner('Fetching deployment history...').start();

    try {
      // Build query parameters
      const params = {};
      if (options.limit) {
        params.limit = parseInt(options.limit, 10);
      }
      if (options.offset) {
        params.offset = parseInt(options.offset, 10);
      }

      const result = await api.getDeployments(applicationUuid, params);

      spin.succeed('Deployment history retrieved');

      if (!result.deployments || result.deployments.length === 0) {
        logger.newline();
        logger.warn('No deployments found for this application');
        logger.newline();
        logger.info('Deploy your application with:');
        logger.log('  saac deploy');
        return;
      }

      logger.newline();

      // Build table data
      const data = [
        ['UUID', 'Status', 'Branch', 'Commit', 'Duration', 'Trigger', 'Date'],
      ];

      result.deployments.forEach((d) => {
        const uuid = d.deployment_uuid ? d.deployment_uuid.substring(0, 23) + '...' : 'N/A';

        // Colorize status
        let statusDisplay;
        if (d.status === 'finished') {
          statusDisplay = logger.chalk.green('finished');
        } else if (d.status === 'failed') {
          statusDisplay = logger.chalk.red('failed');
        } else if (d.status === 'running' || d.status === 'queued') {
          statusDisplay = logger.chalk.yellow(d.status);
        } else {
          statusDisplay = logger.chalk.gray(d.status || 'unknown');
        }

        const branch = d.git_branch || 'N/A';
        const commit = d.git_commit ? d.git_commit.substring(0, 7) : 'N/A';
        const duration = d.duration_seconds ? `${d.duration_seconds}s` : '-';
        const trigger = d.triggered_by || 'api';
        const date = d.started_at ? new Date(d.started_at).toLocaleString() : 'N/A';

        data.push([
          uuid,
          statusDisplay,
          branch,
          commit,
          duration,
          trigger,
          date,
        ]);
      });

      console.log(table(data, {
        header: {
          alignment: 'center',
          content: `Showing ${result.deployments.length} of ${result.total} deployments`,
        },
      }));

      // Show pagination info
      if (result.total > result.deployments.length) {
        const remaining = result.total - result.deployments.length;
        logger.info(`${remaining} more deployment(s) available`);
        logger.newline();
        logger.info('View more with:');
        logger.log(`  saac deployments --limit ${options.limit || 20} --offset ${(options.offset || 0) + (options.limit || 20)}`);
      }

      logger.newline();
      logger.info('View deployment logs:');
      logger.log('  saac logs --deployment              # Latest deployment');
      logger.log('  saac logs --deployment <uuid>       # Specific deployment');

    } catch (error) {
      spin.fail('Failed to fetch deployment history');
      throw error;
    }

  } catch (error) {
    logger.error(error.response?.data?.message || error.message);
    process.exit(1);
  }
}

module.exports = deployments;
