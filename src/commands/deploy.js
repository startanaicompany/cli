/**
 * Deploy command with streaming support
 */

const api = require('../lib/api');
const { getProjectConfig, ensureAuthenticated, getUser } = require('../lib/config');
const logger = require('../lib/logger');
const errorDisplay = require('../lib/errorDisplay');

async function deploy(options) {
  try {
    // Check authentication (with auto-login support)
    if (!(await ensureAuthenticated())) {
      logger.error('Not logged in');
      logger.info('Run: saac login -e <email> -k <api-key>');
      logger.info('Or set: SAAC_USER_API_KEY and SAAC_USER_EMAIL');
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

    // Default to streaming mode (agents and users need visibility)
    // Use fire-and-forget mode only if --no-stream is explicitly set
    if (options.stream !== false) {
      return await deployWithStreaming(applicationUuid, applicationName, options);
    }

    // Fire-and-forget mode (only when --no-stream is used)
    const spin = logger.spinner('Queueing deployment...').start();

    try {
      const deployOptions = {};
      if (options.noCache) {
        deployOptions.no_cache = true;
      }

      const result = await api.deployApplication(applicationUuid, deployOptions);

      // Check if deployment failed
      if (result.success === false) {
        spin.fail('Deployment failed');
        errorDisplay.displayDeploymentError(result, logger);
        process.exit(1);
      }

      // SUCCESS: Deployment queued
      spin.succeed('Deployment queued');

      logger.newline();
      logger.success('Deployment has been queued!');
      logger.newline();
      logger.field('Application', applicationName);
      logger.field('Status', 'queued (daemon will build within 30 seconds)');
      if (result.git_branch) {
        logger.field('Branch', result.git_branch);
      }
      if (result.domain) {
        logger.field('Domain', result.domain);
      }
      if (options.noCache) {
        logger.field('Build Mode', 'No cache (full rebuild)');
      }
      logger.newline();

      logger.info('The daemon will pick up this deployment shortly and begin building.');
      logger.newline();
      logger.info('Monitor deployment progress:');
      logger.log(`  saac deploy                  Stream build logs in real-time (default)`);
      logger.log(`  saac logs --deployment       View deployment logs after completion`);
      logger.log(`  saac status                  Check application status`);

    } catch (error) {
      spin.fail('Deployment request failed');
      throw error;
    }
  } catch (error) {
    logger.error(error.response?.data?.message || error.message);
    process.exit(1);
  }
}

/**
 * Deploy with SSE streaming
 */
async function deployWithStreaming(applicationUuid, applicationName, options) {
  const user = getUser();
  const config = require('../lib/config');
  const baseUrl = config.getApiUrl();

  logger.info('Initiating deployment with build log streaming...');
  logger.newline();

  try {
    const headers = {
      'Accept': 'text/event-stream',
      'Content-Type': 'application/json',
    };

    // Add authentication header
    if (process.env.SAAC_API_KEY) {
      headers['X-API-Key'] = process.env.SAAC_API_KEY;
    } else if (user.sessionToken) {
      headers['X-Session-Token'] = user.sessionToken;
    } else if (user.apiKey) {
      headers['X-API-Key'] = user.apiKey;
    }

    const body = { stream: true };
    if (options.noCache) {
      body.no_cache = true;
    }

    const url = `${baseUrl}/applications/${applicationUuid}/deploy`;
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let deploymentQueued = false;

    // Handle Ctrl+C gracefully
    const cleanup = () => {
      reader.cancel();
      logger.newline();
      logger.info('Stream closed');
      process.exit(0);
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        // Skip empty lines and comments (keepalive)
        if (!line.trim() || line.startsWith(':')) {
          continue;
        }

        // Parse SSE data lines
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));

            // Handle deploy_queued event
            if (data.event === 'deploy_queued') {
              logger.success('✓ Deployment queued');
              logger.newline();
              logger.field('Application', applicationName);
              logger.field('Branch', data.git_branch || 'master');
              if (data.domain) {
                logger.field('Domain', data.domain);
              }
              if (options.noCache) {
                logger.field('Build Mode', 'No cache (full rebuild)');
              }
              logger.newline();
              logger.info('Waiting for daemon to start build...');
              logger.newline();
              deploymentQueued = true;
              continue;
            }

            // Handle deploy_finished event
            if (data.event === 'deploy_finished') {
              logger.newline();
              logger.log('─'.repeat(60));
              logger.newline();

              if (data.status === 'running') {
                logger.success('✓ Deployment completed successfully!');
              } else if (data.status === 'failed') {
                logger.error('✗ Deployment failed');
              } else {
                logger.info(`Deployment status: ${data.status}`);
              }

              logger.newline();
              logger.field('Final Status', data.status);
              if (data.deployment_uuid) {
                logger.field('Deployment UUID', data.deployment_uuid);
              }
              logger.newline();

              if (data.status === 'running') {
                logger.info('Your application is now running!');
                logger.newline();
                logger.info('Next steps:');
                logger.log(`  saac status                  Check application status`);
                logger.log(`  saac logs --follow           View live application logs`);
              } else if (data.status === 'failed') {
                logger.info('View full deployment logs:');
                logger.log(`  saac logs --deployment       View complete build logs`);
              }

              // Clean exit
              process.removeListener('SIGINT', cleanup);
              process.removeListener('SIGTERM', cleanup);
              process.exit(data.status === 'running' ? 0 : 1);
            }

            // Handle build log messages
            if (data.type === 'build' && data.message) {
              const timestamp = new Date(data.timestamp).toLocaleTimeString();
              const service = logger.chalk.cyan(`[${data.service}]`);
              console.log(`${logger.chalk.gray(timestamp)} ${service} ${data.message}`);
            }
          } catch (parseError) {
            logger.warn(`Failed to parse event: ${line}`);
          }
        }
      }
    }

    // Stream ended without deploy_finished event
    logger.newline();
    logger.warn('Build stream ended unexpectedly');
    logger.info('Check deployment status with: saac status');

  } catch (error) {
    logger.error('Failed to stream deployment');
    logger.error(error.message);
    process.exit(1);
  }
}

module.exports = deploy;
