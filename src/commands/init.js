/**
 * Init command - Initialize SAAC project in current directory
 *
 * Two modes:
 * 1. Interactive: Select from existing applications (no options provided)
 * 2. Create: Create new application and link to directory (options provided)
 */

const api = require('../lib/api');
const { isAuthenticated, saveProjectConfig, getProjectConfig } = require('../lib/config');
const logger = require('../lib/logger');
const inquirer = require('inquirer');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function init(options) {
  try {
    // Check authentication
    if (!isAuthenticated()) {
      logger.error('Not logged in');
      logger.newline();
      logger.info('Run:');
      logger.log('  saac login -e <email> -k <api-key>');
      process.exit(1);
    }

    logger.section('Initialize SAAC Project');
    logger.newline();

    // Check if already initialized
    const existingConfig = getProjectConfig();
    if (existingConfig) {
      logger.warn('This directory is already linked to an application');
      logger.newline();
      logger.field('Application', existingConfig.applicationName);
      logger.field('UUID', existingConfig.applicationUuid);
      logger.field('Domain', `${existingConfig.subdomain}.${existingConfig.domainSuffix}`);
      logger.newline();

      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: 'Do you want to re-initialize this directory?',
          default: false,
        },
      ]);

      if (!overwrite) {
        logger.info('Keeping existing configuration');
        process.exit(0);
      }

      logger.newline();
    }

    // Determine mode: Create new app OR link existing app
    const hasCreateOptions = options.name || options.subdomain || options.repository;

    if (hasCreateOptions) {
      // CREATE MODE: Create a new application
      await createAndInitialize(options);
    } else {
      // INTERACTIVE MODE: Link existing application
      await linkExistingApplication();
    }

  } catch (error) {
    logger.error(error.response?.data?.message || error.message);
    process.exit(1);
  }
}

/**
 * Create a new application and initialize directory
 */
async function createAndInitialize(options) {
  logger.error('Create mode not yet implemented');
  logger.newline();
  logger.info('To create a new application, use:');
  logger.log('  saac create <name> -s <subdomain> -r <repository> -t <git-token>');
  logger.newline();
  logger.info('To link an existing application, run:');
  logger.log('  saac init');
  process.exit(1);

  // TODO: Implement create-and-init flow
  // This would call the create command functionality, then save the config
}

/**
 * Get Git remote URL from current directory
 * @returns {string|null} - Git remote URL or null if not a git repo
 */
function getGitRemoteUrl() {
  try {
    // Check if .git directory exists
    if (!fs.existsSync(path.join(process.cwd(), '.git'))) {
      return null;
    }

    // Get remote.origin.url
    const remoteUrl = execSync('git config --get remote.origin.url', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'] // Suppress stderr
    }).trim();

    return remoteUrl || null;
  } catch (error) {
    // Not a git repo or no remote configured
    return null;
  }
}

/**
 * Normalize Git URLs for comparison
 * Converts both SSH and HTTPS URLs to a comparable format
 */
function normalizeGitUrl(url) {
  if (!url) return '';

  // Remove .git suffix
  let normalized = url.replace(/\.git$/, '');

  // Convert SSH to HTTPS-like format for comparison
  // git@github.com:user/repo -> github.com/user/repo
  normalized = normalized.replace(/^git@([^:]+):/, '$1/');

  // Remove https:// or http://
  normalized = normalized.replace(/^https?:\/\//, '');

  return normalized.toLowerCase();
}

/**
 * Link an existing application to current directory (interactive)
 */
async function linkExistingApplication() {

  // Try to auto-detect Git repository
  const gitRemoteUrl = getGitRemoteUrl();

  // Fetch user's applications
  const spin = logger.spinner('Fetching your applications...').start();

  try {
    const result = await api.listApplications();
    const applications = Array.isArray(result) ? result : (result.applications || []);

    spin.succeed(`Found ${applications.length} application(s)`);

    if (applications.length === 0) {
      logger.newline();
      logger.warn('You have no applications yet');
      logger.newline();
      logger.info('Create one with:');
      logger.log('  saac create <name> -s <subdomain> -r <repository> -t <git-token>');
      process.exit(1);
    }

    logger.newline();

    let selectedApp = null;

    // Try to auto-match based on Git remote URL
    if (gitRemoteUrl) {
      const normalizedRemote = normalizeGitUrl(gitRemoteUrl);

      const matchedApp = applications.find(app => {
        if (!app.git_repository) return false;
        const normalizedAppRepo = normalizeGitUrl(app.git_repository);
        return normalizedAppRepo === normalizedRemote;
      });

      if (matchedApp) {
        // Found matching application!
        logger.info(`Auto-detected Git repository: ${gitRemoteUrl}`);
        logger.newline();
        logger.field('Matched Application', matchedApp.name);
        logger.field('Domain', matchedApp.domain || `${matchedApp.subdomain}.startanaicompany.com`);
        logger.field('Status', matchedApp.status);
        logger.newline();

        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Link this application to the current directory?',
            default: true,
          },
        ]);

        if (confirm) {
          selectedApp = matchedApp;
        } else {
          logger.newline();
          logger.info('Please select a different application:');
          logger.newline();
        }
      } else {
        logger.warn(`No application found matching Git remote: ${gitRemoteUrl}`);
        logger.newline();
      }
    }

    // If no auto-match or user declined, show interactive selection
    if (!selectedApp) {
      const choices = applications.map(app => ({
        name: `${app.name} - ${app.domain || `${app.subdomain}.startanaicompany.com`} (${app.status})`,
        value: app,
      }));

      const answer = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedApp',
          message: 'Select application to link to this directory:',
          choices: choices,
        },
      ]);

      selectedApp = answer.selectedApp;
    }

    logger.newline();

    // Save project configuration
    saveProjectConfig({
      applicationUuid: selectedApp.uuid,
      applicationName: selectedApp.name,
      subdomain: selectedApp.subdomain,
      domainSuffix: selectedApp.domain_suffix || 'startanaicompany.com',
      gitRepository: selectedApp.git_repository,
    });

    logger.success('Project initialized!');
    logger.newline();
    logger.field('Application', selectedApp.name);
    logger.field('UUID', selectedApp.uuid);
    logger.field('Domain', selectedApp.domain || `${selectedApp.subdomain}.startanaicompany.com`);
    logger.field('Status', selectedApp.status);
    logger.newline();

    logger.info('You can now use:');
    logger.log('  saac deploy              Deploy your application');
    logger.log('  saac logs --follow       View deployment logs');
    logger.log('  saac status              Check application status');
    logger.log('  saac update --port 8080  Update configuration');

  } catch (error) {
    spin.fail('Failed to fetch applications');
    throw error;
  }
}

module.exports = init;
