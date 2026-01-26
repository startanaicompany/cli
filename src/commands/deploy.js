/**
 * Deploy command
 */

const api = require('../lib/api');
const { getProjectConfig, isAuthenticated } = require('../lib/config');
const logger = require('../lib/logger');

async function deploy(options) {
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
      logger.info('Run: saac init or saac create');
      process.exit(1);
    }

    const { applicationUuid, applicationName } = projectConfig;

    logger.section(`Deploying ${applicationName}`);

    const spin = logger.spinner('Triggering deployment...').start();

    try {
      const result = await api.deployApplication(applicationUuid);

      spin.succeed('Deployment triggered!');

      logger.newline();
      logger.success('Deployment started successfully');
      logger.newline();
      logger.field('Application', applicationName);
      logger.field('Status', result.status);
      if (result.domain) {
        logger.field('Domain', result.domain);
      }
      logger.field('Deployment ID', result.deployment_id);
      logger.newline();
      logger.info(
        `View logs with: ${logger.chalk.yellow('saac logs --follow')}`
      );

    } catch (error) {
      spin.fail('Deployment failed');
      throw error;
    }
  } catch (error) {
    logger.error(error.response?.data?.message || error.message);
    process.exit(1);
  }
}

module.exports = deploy;
