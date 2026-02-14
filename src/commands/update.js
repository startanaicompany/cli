/**
 * Update command - Update application configuration
 */

const api = require('../lib/api');
const { ensureAuthenticated, getProjectConfig } = require('../lib/config');
const logger = require('../lib/logger');

async function update(options) {
  try {
    // Check authentication (with auto-login support)
    if (!(await ensureAuthenticated())) {
      logger.error('Not logged in');
      logger.info('Run: saac login -e <email> -k <api-key>');
      logger.info('Or set: SAAC_USER_API_KEY and SAAC_USER_EMAIL');
      process.exit(1);
    }

    // Get project config
    const projectConfig = getProjectConfig();
    if (!projectConfig) {
      logger.error('Not in a SAAC project directory');
      logger.newline();
      logger.info('Run this command in a directory initialized with:');
      logger.log('  saac init');
      logger.log('  saac create <name>');
      process.exit(1);
    }

    logger.section(`Updating Application: ${projectConfig.applicationName}`);
    logger.newline();

    // Build update payload from options
    const updateData = {};
    let hasChanges = false;

    // Basic fields
    if (options.name) {
      updateData.name = options.name;
      hasChanges = true;
    }
    if (options.branch) {
      updateData.git_branch = options.branch;
      hasChanges = true;
    }

    // Port configuration
    if (options.port) {
      updateData.ports_exposes = options.port;
      hasChanges = true;
    }

    // Build pack
    if (options.buildPack) {
      const validBuildPacks = ['dockercompose', 'nixpacks', 'dockerfile', 'static'];
      if (!validBuildPacks.includes(options.buildPack)) {
        logger.error(`Invalid build pack: ${options.buildPack}`);
        logger.info(`Must be one of: ${validBuildPacks.join(', ')}`);
        process.exit(1);
      }
      updateData.build_pack = options.buildPack;
      hasChanges = true;
    }

    // Custom commands
    if (options.installCmd) {
      updateData.install_command = options.installCmd;
      hasChanges = true;
    }
    if (options.buildCmd) {
      updateData.build_command = options.buildCmd;
      hasChanges = true;
    }
    if (options.startCmd) {
      updateData.start_command = options.startCmd;
      hasChanges = true;
    }
    if (options.preDeployCmd) {
      updateData.pre_deployment_command = options.preDeployCmd;
      hasChanges = true;
    }
    if (options.postDeployCmd) {
      updateData.post_deployment_command = options.postDeployCmd;
      hasChanges = true;
    }

    // Resource limits
    if (options.cpuLimit) {
      updateData.cpu_limit = options.cpuLimit;
      hasChanges = true;
    }
    if (options.memoryLimit) {
      updateData.memory_limit = options.memoryLimit;
      hasChanges = true;
    }

    // Health check configuration
    if (options.healthCheck !== undefined) {
      updateData.health_check_enabled = options.healthCheck;
      hasChanges = true;
    }
    if (options.healthPath) {
      updateData.health_check_path = options.healthPath;
      hasChanges = true;
    }
    if (options.healthInterval) {
      updateData.health_check_interval = parseInt(options.healthInterval, 10);
      hasChanges = true;
    }
    if (options.healthTimeout) {
      updateData.health_check_timeout = parseInt(options.healthTimeout, 10);
      hasChanges = true;
    }
    if (options.healthRetries) {
      const retries = parseInt(options.healthRetries, 10);
      if (retries < 1 || retries > 10) {
        logger.error('Health check retries must be between 1 and 10');
        process.exit(1);
      }
      updateData.health_check_retries = retries;
      hasChanges = true;
    }

    // Restart policy
    if (options.restart) {
      const validRestartPolicies = ['always', 'on-failure', 'unless-stopped', 'no'];
      if (!validRestartPolicies.includes(options.restart)) {
        logger.error(`Invalid restart policy: ${options.restart}`);
        logger.info(`Must be one of: ${validRestartPolicies.join(', ')}`);
        process.exit(1);
      }
      updateData.restart = options.restart;
      hasChanges = true;
    }

    // Environment variables
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

      updateData.environment_variables = envVars;
      hasChanges = true;
    }

    // Check if any changes were provided
    if (!hasChanges) {
      logger.error('No configuration changes specified');
      logger.newline();
      logger.info('Usage:');
      logger.log('  saac update [options]');
      logger.newline();
      logger.info('Available options:');
      logger.log('  -n, --name <name>                    Application name');
      logger.log('  -b, --branch <branch>                Git branch');
      logger.log('  -p, --port <port>                    Port to expose');
      logger.log('  --build-pack <pack>                  Build pack: dockercompose, nixpacks, dockerfile, static');
      logger.log('  --install-cmd <command>              Install command');
      logger.log('  --build-cmd <command>                Build command');
      logger.log('  --start-cmd <command>                Start command');
      logger.log('  --pre-deploy-cmd <command>           Pre-deployment command');
      logger.log('  --post-deploy-cmd <command>          Post-deployment command');
      logger.log('  --cpu-limit <limit>                  CPU limit (e.g., "1", "2.5")');
      logger.log('  --memory-limit <limit>               Memory limit (e.g., "512M", "2G")');
      logger.log('  --health-check                       Enable health checks');
      logger.log('  --no-health-check                    Disable health checks');
      logger.log('  --health-path <path>                 Health check path');
      logger.log('  --health-interval <seconds>          Health check interval in seconds');
      logger.log('  --health-timeout <seconds>           Health check timeout in seconds');
      logger.log('  --health-retries <count>             Health check retries (1-10)');
      logger.log('  --restart <policy>                   Restart policy: always, on-failure, unless-stopped, no');
      logger.log('  --env <KEY=VALUE>                    Environment variable (can be used multiple times)');
      logger.newline();
      logger.info('Example:');
      logger.log('  saac update --port 8080 --health-check --health-path /api/health');
      logger.log('  saac update --build-pack nixpacks --cpu-limit 2 --memory-limit 2G');
      process.exit(1);
    }

    // Show configuration changes
    logger.info('Configuration changes:');
    Object.entries(updateData).forEach(([key, value]) => {
      const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      let displayValue = value;
      if (typeof value === 'object' && !Array.isArray(value)) {
        displayValue = `${Object.keys(value).length} variable(s)`;
      }
      logger.field(displayKey, displayValue);
    });

    logger.newline();

    const spin = logger.spinner('Updating application configuration...').start();

    try {
      const result = await api.updateApplication(projectConfig.applicationUuid, updateData);

      spin.succeed('Configuration updated successfully!');

      logger.newline();

      if (result.updated_fields && result.updated_fields.length > 0) {
        logger.success(`Updated ${result.updated_fields.length} field(s)`);
        logger.newline();
      }

      // Warn if tier limits were applied
      if (result.applied_tier_limits) {
        logger.warn('Resource limits were capped at your tier maximum');
        logger.info('Free tier: 1 vCPU, 1024M RAM');
        logger.newline();
      }

      // Show next steps
      logger.info('Next steps:');
      logger.log('  1. Review changes above');
      logger.log(`  2. Deploy to apply: ${logger.chalk.cyan('saac deploy')}`);
      logger.log(`  3. Monitor deployment: ${logger.chalk.cyan('saac logs --follow')}`);
      logger.newline();

      logger.warn('Note: Configuration changes require redeployment to take effect');

    } catch (error) {
      spin.fail('Configuration update failed');

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
      } else if (error.response?.status === 404) {
        logger.newline();
        logger.error('Application not found');
        logger.info('The application may have been deleted');
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

module.exports = update;
