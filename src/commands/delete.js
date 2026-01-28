/**
 * Delete Command - Permanently delete application
 */

const api = require('../lib/api');
const { getProjectConfig, isAuthenticated } = require('../lib/config');
const logger = require('../lib/logger');
const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');

/**
 * Delete application with confirmation
 * @param {object} options - Command options
 */
async function deleteApp(options) {
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

    const { applicationUuid } = projectConfig;

    // Fetch application details for confirmation
    const fetchSpin = logger.spinner('Fetching application details...').start();

    let app;
    try {
      app = await api.getApplication(applicationUuid);
      fetchSpin.succeed('Application details retrieved');
    } catch (error) {
      fetchSpin.fail('Failed to fetch application details');
      throw error;
    }

    logger.newline();

    // Show confirmation prompt (unless --yes flag)
    if (!options.yes) {
      logger.warn('WARNING: This will permanently delete your application!');
      logger.newline();

      logger.field('Application', app.name);
      logger.field('Domain', app.domain || `https://${app.subdomain}.startanaicompany.com`);
      logger.field('UUID', app.uuid);
      logger.field('Status', app.status);

      logger.newline();

      logger.error('This action cannot be undone. All data will be lost:');
      logger.log('  • Application configuration');
      logger.log('  • All deployments');
      logger.log('  • Environment variables');
      logger.log('  • All logs');
      logger.log('  • DNS records');

      logger.newline();

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'confirmation',
          message: 'Type \'yes\' to confirm deletion:',
          validate: (input) => {
            if (input === 'yes') {
              return true;
            }
            return 'Please type \'yes\' to confirm';
          }
        }
      ]);

      if (answers.confirmation !== 'yes') {
        logger.error('Deletion cancelled');
        process.exit(0);
      }

      logger.newline();
    }

    // Delete application
    const deleteSpin = logger.spinner('Deleting application...').start();

    try {
      const result = await api.deleteApplication(app.uuid);

      deleteSpin.succeed('Application deleted successfully!');

      logger.newline();

      logger.info('Resources deleted:');
      for (const [resource, deleted] of Object.entries(result.resources_deleted || {})) {
        const icon = deleted ? '✓' : '✗';
        const name = resource.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const color = deleted ? logger.chalk.green : logger.chalk.red;
        logger.log(`  ${color(icon)} ${name}`);
      }

      logger.newline();

      logger.success(`Application '${result.application_name}' has been permanently deleted.`);

      logger.newline();

      logger.info('Next steps:');
      logger.log('  • Remove local project: rm -rf .saac/');
      logger.log('  • Create new application: saac create');
      logger.log('  • View other applications: saac list');

      // Remove local config
      const configDir = path.join(process.cwd(), '.saac');
      if (fs.existsSync(configDir)) {
        fs.rmSync(configDir, { recursive: true, force: true });
        logger.newline();
        logger.success('Local configuration removed');
      }

    } catch (error) {
      deleteSpin.fail('Failed to delete application');

      if (error.response?.status === 404) {
        logger.newline();
        logger.warn('Application not found or already deleted');
      } else if (error.response?.status === 409) {
        logger.newline();
        const data = error.response.data;

        if (data.error === 'DEPLOYMENT_IN_PROGRESS') {
          logger.warn('Cannot delete application while deployment is in progress');
          logger.newline();
          logger.info('Details:');
          logger.field('  Deployment Status', data.current_deployment_status);
          if (data.deployment_uuid) {
            logger.field('  Deployment UUID', data.deployment_uuid);
          }
          logger.newline();
          logger.info('Suggestion:');
          logger.log('  Wait for deployment to finish or fail before deleting');
          logger.newline();
          logger.info('Check deployment status:');
          logger.log('  saac deployments');
        }
      } else if (error.response?.status === 500) {
        logger.newline();
        const data = error.response.data;

        if (data.error === 'PARTIAL_DELETION') {
          logger.warn('Application partially deleted. Some resources may remain.');
          logger.newline();
          logger.info('Cleanup status:');
          if (data.details) {
            for (const [resource, deleted] of Object.entries(data.details)) {
              if (resource !== 'error') {
                const icon = deleted ? '✓' : '✗';
                const name = resource.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                logger.log(`  ${icon} ${name}`);
              }
            }
            if (data.details.error) {
              logger.newline();
              logger.error('Error: ' + data.details.error);
            }
          }
          logger.newline();
          logger.info('Please contact support to complete cleanup');
        }
      }

      throw error;
    }

  } catch (error) {
    logger.error(error.response?.data?.message || error.message);
    process.exit(1);
  }
}

module.exports = deleteApp;
