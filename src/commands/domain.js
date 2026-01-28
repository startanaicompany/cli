/**
 * Domain Management Commands - Manage application domain and subdomain
 */

const api = require('../lib/api');
const { getProjectConfig, isAuthenticated, saveProjectConfig } = require('../lib/config');
const logger = require('../lib/logger');

/**
 * Set/change application subdomain
 * @param {string} subdomain - New subdomain
 * @param {object} options - Command options
 */
async function set(subdomain, options) {
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

    // Validate subdomain format
    const subdomainRegex = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
    if (!subdomainRegex.test(subdomain)) {
      logger.error('Invalid subdomain format');
      logger.newline();
      logger.info('Subdomain must:');
      logger.log('  • Be 3-63 characters long');
      logger.log('  • Contain only lowercase letters, numbers, and hyphens');
      logger.log('  • Not start or end with a hyphen');
      logger.newline();
      logger.info('Valid examples:');
      logger.log('  my-app, johnsmith, app-123');
      logger.newline();
      logger.info('Invalid examples:');
      logger.log('  My-App (uppercase), -myapp (starts with hyphen), a (too short)');
      process.exit(1);
    }

    const domainSuffix = options.domainSuffix || 'startanaicompany.com';

    logger.section('Updating Domain');
    logger.newline();

    logger.info('Configuration:');
    logger.field('  Application', applicationName);
    logger.field('  New Subdomain', subdomain);
    logger.field('  Domain Suffix', domainSuffix);
    logger.field('  New Domain', `https://${subdomain}.${domainSuffix}`);

    logger.newline();

    const spin = logger.spinner('Updating domain...').start();

    try {
      const result = await api.updateDomain(applicationUuid, subdomain, domainSuffix);

      spin.succeed('Domain updated successfully!');

      logger.newline();

      logger.field('Old Domain', result.old_domain);
      logger.field('New Domain', result.new_domain);

      logger.newline();
      logger.info('DNS propagation may take 1-5 minutes');
      logger.info('Your application will be accessible at the new domain shortly.');

      // Update local config
      projectConfig.subdomain = subdomain;
      projectConfig.domain = result.new_domain;
      saveProjectConfig(projectConfig);

      logger.newline();
      logger.success('Local configuration updated');

    } catch (error) {
      spin.fail('Failed to update domain');

      if (error.response?.status === 409) {
        logger.newline();
        const data = error.response.data;

        if (data.error === 'SUBDOMAIN_TAKEN') {
          logger.warn('Subdomain is already taken');
          logger.newline();

          if (data.suggestions && data.suggestions.length > 0) {
            logger.info('Try these alternatives:');
            data.suggestions.forEach(suggestion => {
              logger.log(`  • ${suggestion}`);
            });
          }
        } else if (data.error === 'SUBDOMAIN_BLOCKED') {
          logger.warn('Subdomain is reserved and cannot be used');
          logger.newline();
          logger.info('Reserved subdomains:');
          if (data.blocklist) {
            data.blocklist.forEach(blocked => {
              logger.log(`  • ${blocked}`);
            });
          }
        }
      } else if (error.response?.status === 403) {
        logger.newline();
        const data = error.response.data;

        if (data.error === 'DOMAIN_SUFFIX_NOT_ALLOWED') {
          logger.warn('Custom domain suffix not available on your plan');
          logger.newline();
          logger.info('Allowed suffixes:');
          if (data.allowed_suffixes) {
            data.allowed_suffixes.forEach(suffix => {
              logger.log(`  • ${suffix}`);
            });
          }
          logger.newline();
          if (data.upgrade_required) {
            logger.info('Upgrade to Pro plan for custom domain support');
          }
        }
      }

      throw error;
    }

  } catch (error) {
    logger.error(error.response?.data?.message || error.message);
    process.exit(1);
  }
}

/**
 * Show current domain information
 */
async function show() {
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

    const spin = logger.spinner('Fetching application details...').start();

    try {
      const app = await api.getApplication(applicationUuid);

      spin.succeed('Application details retrieved');

      logger.newline();

      logger.section(`Domain Information: ${app.name}`);
      logger.newline();

      logger.field('Domain', app.domain || `https://${app.subdomain}.startanaicompany.com`);
      logger.field('Subdomain', app.subdomain);
      logger.field('Domain Suffix', 'startanaicompany.com');
      logger.field('Status', app.status);

      logger.newline();
      logger.info('To change domain:');
      logger.log('  saac domain set <new-subdomain>');

    } catch (error) {
      spin.fail('Failed to fetch application details');
      throw error;
    }

  } catch (error) {
    logger.error(error.response?.data?.message || error.message);
    process.exit(1);
  }
}

module.exports = {
  set,
  show,
};
