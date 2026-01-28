/**
 * Deploy command
 */

const api = require('../lib/api');
const { getProjectConfig, isAuthenticated } = require('../lib/config');
const logger = require('../lib/logger');
const errorDisplay = require('../lib/errorDisplay');

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
    logger.newline();

    const spin = logger.spinner('Deploying application (waiting for completion, up to 5 minutes)...').start();

    try {
      const result = await api.deployApplication(applicationUuid);

      // Check if deployment failed
      if (result.success === false) {
        spin.fail('Deployment failed');

        // Display detailed error information
        errorDisplay.displayDeploymentError(result, logger);

        // Handle timeout specifically
        if (result.status === 'timeout') {
          errorDisplay.displayTimeoutInstructions(logger);
        }

        process.exit(1);
      }

      // SUCCESS: Deployment completed
      spin.succeed('Deployment completed successfully!');

      logger.newline();
      logger.success('Your application has been deployed!');
      logger.newline();
      logger.field('Application', applicationName);
      logger.field('Status', result.status);
      if (result.git_branch) {
        logger.field('Branch', result.git_branch);
      }
      if (result.domain) {
        logger.field('Domain', result.domain);
      }
      if (result.deployment_uuid || result.deployment_id) {
        logger.field('Deployment ID', result.deployment_uuid || result.deployment_id);
      }
      logger.newline();

      // Show Traefik status if present
      if (result.traefik_status === 'queued') {
        logger.info('Routing configuration is being applied (may take a few seconds)');
        logger.newline();
      } else if (result.traefik_status === 'failed') {
        logger.warn('Routing configuration failed - application may not be accessible');
        logger.newline();
      }

      logger.info('Useful commands:');
      logger.log(`  saac logs --follow       View live deployment logs`);
      logger.log(`  saac status              Check application status`);

    } catch (error) {
      spin.fail('Deployment request failed');
      throw error;
    }
  } catch (error) {
    logger.error(error.response?.data?.message || error.message);
    process.exit(1);
  }
}

module.exports = deploy;
