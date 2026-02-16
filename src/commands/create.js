/**
 * Create command - Create a new application
 */

const api = require('../lib/api');
const { ensureAuthenticated, saveProjectConfig, getUser, getProjectConfig } = require('../lib/config');
const logger = require('../lib/logger');
const oauth = require('../lib/oauth');
const inquirer = require('inquirer');
const { execSync } = require('child_process');
const errorDisplay = require('../lib/errorDisplay');

async function create(name, options) {
  try {
    // Check authentication (with auto-login support)
    if (!(await ensureAuthenticated())) {
      logger.error('Not logged in');
      logger.info('Run: saac login -e <email> -k <api-key>');
      logger.info('Or set: SAAC_USER_API_KEY and SAAC_USER_EMAIL');
      process.exit(1);
    }

    // Check if application already exists in this directory
    const existingConfig = getProjectConfig();
    if (existingConfig) {
      logger.error('Application already published');
      logger.newline();
      logger.info('This directory is already linked to an application:');
      if (existingConfig.applicationName) {
        logger.field('Name', existingConfig.applicationName);
      }
      if (existingConfig.subdomain && existingConfig.domainSuffix) {
        const domain = `https://${existingConfig.subdomain}.${existingConfig.domainSuffix}`;
        logger.field('Domain', domain);
        logger.newline();
        logger.info(`Your application should be available at: ${domain}`);
      }
      logger.newline();
      logger.info('To manage this application, use:');
      logger.log('  saac deploy              Deploy changes');
      logger.log('  saac update [options]    Update configuration');
      logger.log('  saac env set KEY=VALUE   Set environment variables');
      logger.log('  saac logs --follow       View logs');
      logger.log('  saac status              Check status');
      logger.newline();
      logger.warn('To create a new application, use a different directory');
      process.exit(1);
    }

    // Check current git branch
    let currentBranch = null;
    try {
      currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
      }).trim();
    } catch (error) {
      // Not in a git repository or git not available - continue anyway
    }

    if (currentBranch && currentBranch !== 'master' && currentBranch !== 'main') {
      const specifiedBranch = options.branch;

      if (!specifiedBranch || specifiedBranch !== currentBranch) {
        logger.error(`You are currently on branch: ${logger.chalk.yellow(currentBranch)}`);
        logger.newline();
        logger.warn('This is not the master or main branch!');
        logger.newline();
        logger.info('If you really want to use this branch, confirm by specifying it explicitly:');
        logger.log(`  saac create ${name} -s ${options.subdomain || '<subdomain>'} -r ${options.repository || '<repository>'} --branch ${currentBranch}`);
        logger.newline();
        logger.info('Or switch to master/main branch:');
        logger.log('  git checkout master');
        logger.log('  git checkout main');
        process.exit(1);
      } else {
        logger.warn(`Using branch: ${logger.chalk.yellow(currentBranch)}`);
        logger.newline();
      }
    }

    // Validate required fields
    if (!name) {
      logger.error('Application name is required');
      logger.newline();
      logger.info('Usage:');
      logger.log('  saac create <name> [options]');
      logger.newline();
      logger.info('Required options:');
      logger.log('  -s, --subdomain <subdomain>          Subdomain for your app');
      logger.log('  -r, --repository <url>               Git repository URL (SSH format)');
      logger.log('  --org <organization_id>              Organization ID');
      logger.newline();
      logger.info('Optional options:');
      logger.log('  -b, --branch <branch>                Git branch (default: master)');
      logger.log('  -d, --domain-suffix <suffix>         Domain suffix (default: startanaicompany.com)');
      logger.log('  -p, --port <port>                    Port to expose (default: 3000)');
      logger.log('  --build-pack <pack>                  Build pack: dockercompose, nixpacks, dockerfile, static');
      logger.log('  --install-cmd <command>              Install command (e.g., "pnpm install")');
      logger.log('  --build-cmd <command>                Build command (e.g., "npm run build")');
      logger.log('  --start-cmd <command>                Start command (e.g., "node server.js")');
      logger.log('  --pre-deploy-cmd <command>           Pre-deployment command (e.g., "npm run migrate")');
      logger.log('  --post-deploy-cmd <command>          Post-deployment command (e.g., "npm run seed")');
      logger.log('  --health-check                       Enable health checks');
      logger.log('  --health-path <path>                 Health check path (default: /health)');
      logger.log('  --health-interval <seconds>          Health check interval in seconds');
      logger.log('  --health-timeout <seconds>           Health check timeout in seconds');
      logger.log('  --health-retries <count>             Health check retries (1-10)');
      logger.log('  --cpu-limit <limit>                  CPU limit (e.g., "1", "2.5")');
      logger.log('  --memory-limit <limit>               Memory limit (e.g., "512M", "2G")');
      logger.log('  --env <KEY=VALUE>                    Environment variable (can be used multiple times)');
      logger.newline();
      logger.info('Example:');
      logger.log('  saac create my-app -s myapp -r git@git.startanaicompany.com:user/repo.git --org <org_id>');
      logger.log('  saac create api -s api -r git@git... --org <org_id> --build-pack nixpacks --port 8080');
      logger.log('  saac create web -s web -r git@git... --org <org_id> --health-check --pre-deploy-cmd "npm run migrate"');
      process.exit(1);
    }

    if (!options.subdomain || !options.repository || !options.org) {
      logger.error('Missing required options: subdomain, repository, and organization ID are required');
      logger.newline();
      logger.info('Example:');
      logger.log(`  saac create ${name} -s myapp -r git@git.startanaicompany.com:user/repo.git --org <org_id>`);
      logger.newline();
      logger.info('Note: Git OAuth connection required. Connect with: saac git connect');
      process.exit(1);
    }

    logger.section(`Creating Application: ${name}`);
    logger.newline();

    // OAuth: Check if user has connected Git account for this repository
    const user = getUser();
    const gitHost = oauth.extractGitHost(options.repository);
    const connection = await oauth.getConnection(gitHost, user.sessionToken || user.apiKey);

    if (connection) {
      logger.success(`Using connected account: ${connection.gitUsername}@${connection.gitHost}`);
      logger.newline();
    } else {
      // No OAuth connection - must connect
      logger.error(`Git account not connected for ${gitHost}`);
      logger.newline();
      logger.info('Git OAuth connection is required to create applications');
      logger.newline();
      logger.info('Connect now:');
      logger.log('  saac git connect');
      logger.newline();
      process.exit(1);
    }

    // Build application payload
    const appData = {
      name: name,
      subdomain: options.subdomain,
      domain_suffix: options.domainSuffix || 'startanaicompany.com',
      git_repository: options.repository,
      git_branch: options.branch || 'master',
      organization_id: options.org,
    };

    // OAuth tokens are retrieved from database by wrapper
    // No manual git_api_token field needed

    // Optional: Port configuration
    if (options.port) {
      appData.ports_exposes = options.port;
    }

    // Optional: Build pack (defaults to dockercompose)
    const validBuildPacks = ['dockercompose', 'nixpacks', 'dockerfile', 'static'];
    const buildPack = options.buildPack || 'dockercompose';

    if (!validBuildPacks.includes(buildPack)) {
      logger.error(`Invalid build pack: ${buildPack}`);
      logger.info(`Must be one of: ${validBuildPacks.join(', ')}`);
      process.exit(1);
    }
    appData.build_pack = buildPack;

    // Optional: Custom commands
    if (options.installCmd) {
      appData.install_command = options.installCmd;
    }
    if (options.buildCmd) {
      appData.build_command = options.buildCmd;
    }
    if (options.startCmd) {
      appData.start_command = options.startCmd;
    }
    if (options.preDeployCmd) {
      appData.pre_deployment_command = options.preDeployCmd;
    }
    if (options.postDeployCmd) {
      appData.post_deployment_command = options.postDeployCmd;
    }

    // Optional: Resource limits
    if (options.cpuLimit) {
      appData.cpu_limit = options.cpuLimit;
    }
    if (options.memoryLimit) {
      appData.memory_limit = options.memoryLimit;
    }

    // Optional: Health check configuration
    if (options.healthCheck) {
      appData.health_check_enabled = true;
      if (options.healthPath) {
        appData.health_check_path = options.healthPath;
      }
      if (options.healthInterval) {
        appData.health_check_interval = parseInt(options.healthInterval, 10);
      }
      if (options.healthTimeout) {
        appData.health_check_timeout = parseInt(options.healthTimeout, 10);
      }
      if (options.healthRetries) {
        const retries = parseInt(options.healthRetries, 10);
        if (retries < 1 || retries > 10) {
          logger.error('Health check retries must be between 1 and 10');
          process.exit(1);
        }
        appData.health_check_retries = retries;
      }
    }

    // Optional: Environment variables
    if (options.env) {
      const envVars = {};
      const envArray = Array.isArray(options.env) ? options.env : [options.env];

      for (const envStr of envArray) {
        const [key, ...valueParts] = envStr.split('=');
        const value = valueParts.join('='); // Handle values with '=' in them

        if (!key || value === undefined) {
          logger.error(`Invalid environment variable format: ${envStr}`);
          logger.info('Use format: KEY=VALUE');
          process.exit(1);
        }

        envVars[key] = value;
      }

      if (Object.keys(envVars).length > 50) {
        logger.error('Maximum 50 environment variables allowed');
        process.exit(1);
      }

      appData.environment_variables = envVars;
    }

    // Show configuration summary
    logger.info('Configuration:');
    logger.field('Name', appData.name);
    logger.field('Subdomain', `${appData.subdomain}.${appData.domain_suffix}`);
    logger.field('Repository', appData.git_repository);
    logger.field('Branch', appData.git_branch);
    if (appData.ports_exposes) {
      logger.field('Port', appData.ports_exposes);
    }
    if (appData.build_pack) {
      logger.field('Build Pack', appData.build_pack);
    }
    if (appData.cpu_limit || appData.memory_limit) {
      const limits = [];
      if (appData.cpu_limit) limits.push(`CPU: ${appData.cpu_limit}`);
      if (appData.memory_limit) limits.push(`Memory: ${appData.memory_limit}`);
      logger.field('Resource Limits', limits.join(', '));
      logger.warn('Note: Free tier limited to 1 vCPU, 1024M RAM');
    }
    if (appData.health_check_enabled) {
      logger.field('Health Check', `Enabled on ${appData.health_check_path || '/health'}`);
    }
    if (appData.pre_deployment_command) {
      logger.field('Pre-Deploy Hook', appData.pre_deployment_command);
    }
    if (appData.environment_variables) {
      logger.field('Environment Vars', `${Object.keys(appData.environment_variables).length} variable(s)`);
    }

    logger.newline();

    const spin = logger.spinner('Creating application and deploying (this may take up to 5 minutes)...').start();

    try {
      const result = await api.createApplication(appData);

      // Always save project configuration (even if deployment failed)
      saveProjectConfig({
        applicationUuid: result.coolify_app_uuid,
        applicationName: result.app_name,
        subdomain: result.subdomain,
        domainSuffix: appData.domain_suffix,
        gitRepository: appData.git_repository,
      });

      // Check if deployment failed
      if (result.success === false) {
        spin.fail('Deployment failed');

        // Display detailed error information
        errorDisplay.displayDeploymentError(result, logger);

        // Show recovery instructions
        errorDisplay.displayCreateRecoveryInstructions(result, logger);

        process.exit(1);
      }

      // SUCCESS: Application created and deployed
      spin.succeed('Application created and deployed successfully!');

      logger.newline();
      logger.success('Your application is live!');
      logger.newline();
      logger.field('Name', result.app_name);
      logger.field('Domain', result.domain);
      logger.field('UUID', result.coolify_app_uuid);
      logger.field('Status', result.deployment_status || 'finished');
      if (result.git_branch) {
        logger.field('Branch', result.git_branch);
      }
      if (result.deployment_uuid) {
        logger.field('Deployment ID', result.deployment_uuid);
      }
      logger.newline();

      // Show next steps
      if (result.next_steps && result.next_steps.length > 0) {
        logger.info('Next Steps:');
        result.next_steps.forEach((step, index) => {
          logger.log(`  ${index + 1}. ${step}`);
        });
        logger.newline();
      }

      logger.info('Useful commands:');
      logger.log(`  saac deploy              Deploy your application`);
      logger.log(`  saac logs --follow       View deployment logs`);
      logger.log(`  saac status              Check application status`);
      logger.log(`  saac env set KEY=VALUE   Set environment variables`);

    } catch (error) {
      spin.fail('Application creation failed');

      if (error.response?.status === 403) {
        const data = error.response.data;
        logger.newline();
        logger.error('Quota exceeded');
        if (data.current_tier) {
          logger.field('Current Tier', data.current_tier);
        }
        logger.newline();
        logger.warn(data.error || data.message);
        if (data.upgrade_info) {
          logger.info(data.upgrade_info);
        }
      } else if (error.response?.status === 400) {
        const data = error.response.data;
        logger.newline();
        logger.error('Validation failed');
        if (data.details) {
          logger.newline();
          // Backend sends details as array: [{field, message, type}, ...]
          if (Array.isArray(data.details)) {
            data.details.forEach((detail) => {
              logger.log(`  ${logger.chalk.yellow(detail.field)}: ${detail.message}`);
            });
          } else {
            // Fallback for object format: {field: message, ...}
            Object.entries(data.details).forEach(([field, message]) => {
              logger.log(`  ${logger.chalk.yellow(field)}: ${message}`);
            });
          }
        } else {
          logger.log(`  ${data.message || data.error}`);
        }
      } else {
        throw error;
      }
      process.exit(1);
    }

  } catch (error) {
    logger.error(error.response?.data?.message || error.message);
    process.exit(1);
  }
}

module.exports = create;
