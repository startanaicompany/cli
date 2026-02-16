/**
 * Logs command - View application runtime logs or deployment logs
 */

const api = require('../lib/api');
const { getProjectConfig, ensureAuthenticated } = require('../lib/config');
const logger = require('../lib/logger');

async function logs(deploymentUuidArg, options) {
  try {
    // Check authentication
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
      logger.info('Run this command from a project directory (must have .saac/config.json)');
      logger.newline();
      logger.info('Or initialize with:');
      logger.log('  saac init');
      process.exit(1);
    }

    const { applicationUuid, applicationName } = projectConfig;

    // Determine if we're fetching deployment logs or runtime logs
    if (options.deployment !== undefined) {
      // Deployment logs mode
      return await getDeploymentLogs(applicationUuid, applicationName, deploymentUuidArg || options.deployment, options);
    } else {
      // Runtime logs mode (not implemented yet)
      return await getRuntimeLogs(applicationUuid, applicationName, options);
    }

  } catch (error) {
    logger.error(error.response?.data?.message || error.message);
    process.exit(1);
  }
}

/**
 * Get deployment logs (build logs)
 */
async function getDeploymentLogs(applicationUuid, applicationName, deploymentUuid, options) {
  logger.section(`Deployment Logs: ${applicationName}`);
  logger.newline();

  const spin = logger.spinner('Fetching deployment logs...').start();

  try {
    // Build query parameters
    const params = {};
    if (deploymentUuid && deploymentUuid !== true) {
      params.deployment_uuid = deploymentUuid;
    }
    if (options.raw) {
      params.format = 'raw';
    }
    if (options.includeHidden) {
      params.include_hidden = true;
    }

    const result = await api.getDeploymentLogs(applicationUuid, params);

    // Update spinner with status
    if (result.status === 'finished') {
      spin.succeed('Deployment logs retrieved (finished)');
    } else if (result.status === 'failed') {
      spin.fail('Deployment logs retrieved (failed)');
    } else {
      spin.succeed(`Deployment logs retrieved (${result.status})`);
    }

    logger.newline();

    // Display header information
    logger.field('Deployment UUID', result.deployment_uuid || 'N/A');
    logger.field('Application', result.application_name || applicationName);

    // Status with color
    let statusDisplay;
    if (result.status === 'finished') {
      statusDisplay = logger.chalk.green(result.status);
    } else if (result.status === 'failed') {
      statusDisplay = logger.chalk.red(result.status);
    } else {
      statusDisplay = logger.chalk.yellow(result.status);
    }
    logger.field('Status', statusDisplay);

    if (result.commit) {
      logger.field('Commit', result.commit);
    }
    if (result.commit_message) {
      logger.field('Message', result.commit_message);
    }
    if (result.started_at) {
      logger.field('Started', new Date(result.started_at).toLocaleString());
    }
    if (result.finished_at) {
      logger.field('Finished', new Date(result.finished_at).toLocaleString());
    }
    if (result.duration_seconds !== undefined) {
      logger.field('Duration', `${result.duration_seconds}s`);
    }

    logger.newline();
    logger.info(`Log Output (${result.log_count || 0} lines):`);
    logger.log('─'.repeat(60));
    logger.newline();

    // Display logs
    if (options.raw || result.raw_logs) {
      // Raw format - just print the text
      console.log(result.raw_logs);
    } else if (result.logs && result.logs.length > 0) {
      // Parsed format - colorize stderr
      result.logs.forEach(entry => {
        if (entry.type === 'stderr') {
          console.log(logger.chalk.red(entry.output));
        } else {
          console.log(entry.output);
        }
      });
    } else {
      logger.warn('No logs available');
    }

    // Display errors summary if present
    if (result.errors && result.errors.length > 0) {
      logger.newline();
      logger.log('─'.repeat(60));
      logger.newline();
      logger.error('Errors Detected:');
      result.errors.forEach(err => {
        logger.log(`  ${logger.chalk.red(`[${err.type}]`)} ${err.message}`);
        if (err.detail) {
          logger.log(`    ${logger.chalk.gray(err.detail)}`);
        }
      });
    }

  } catch (error) {
    spin.fail('Failed to fetch deployment logs');

    if (error.response?.status === 404) {
      logger.newline();
      logger.warn('No deployments found for this application');
      logger.newline();
      logger.info('Deploy first with:');
      logger.log('  saac deploy');
    } else {
      throw error;
    }
  }
}

/**
 * Get runtime logs (container logs)
 */
async function getRuntimeLogs(applicationUuid, applicationName, options) {
  logger.section(`Runtime Logs: ${applicationName}`);
  logger.newline();

  // Follow mode - use SSE streaming
  if (options.follow) {
    return await streamRuntimeLogs(applicationUuid, applicationName, options);
  }

  // Regular mode - fetch logs once
  const spin = logger.spinner('Fetching runtime logs...').start();

  try {
    // Build query parameters
    const params = {};
    if (options.tail) {
      params.tail = parseInt(options.tail, 10);
    }
    if (options.since) {
      params.since = options.since;
    }
    if (options.type) {
      params.type = options.type;
    }

    const result = await api.getApplicationLogs(applicationUuid, params);

    spin.succeed('Runtime logs retrieved');

    logger.newline();

    // Display logs
    if (result.logs) {
      if (Array.isArray(result.logs)) {
        // Logs is an array of objects
        result.logs.forEach(log => {
          if (log.message) {
            // Format: [timestamp] [service] message
            const timestamp = new Date(log.timestamp).toLocaleTimeString();
            const service = logger.chalk.cyan(`[${log.service}]`);
            console.log(`${logger.chalk.gray(timestamp)} ${service} ${log.message}`);
          } else {
            console.log(log);
          }
        });
      } else if (typeof result.logs === 'string') {
        // Logs is a string (most common format from backend)
        console.log(result.logs);
      } else {
        logger.warn('Unexpected log format');
      }
    } else if (typeof result === 'string') {
      // Entire result is a string
      console.log(result);
    } else {
      logger.warn('No logs available');
      logger.newline();
      logger.info('Make sure your application is deployed:');
      logger.log('  saac deploy');
    }

  } catch (error) {
    spin.fail('Failed to fetch runtime logs');

    if (error.response?.status === 404) {
      logger.newline();
      logger.warn('Application not found or no logs available');
      logger.newline();
      logger.info('Deploy first with:');
      logger.log('  saac deploy');
    } else if (error.response?.status === 501) {
      logger.newline();
      logger.warn('Runtime logs endpoint not implemented yet');
      logger.newline();
      logger.info('Use deployment logs instead:');
      logger.log('  saac logs --deployment');
    } else {
      throw error;
    }
  }
}

/**
 * Stream runtime logs via SSE (Server-Sent Events)
 */
async function streamRuntimeLogs(applicationUuid, applicationName, options) {
  const { getUser } = require('../lib/config');
  const user = getUser();
  const config = require('../lib/config');

  // Get base URL from config
  const baseUrl = config.getApiUrl();

  // Build query parameters
  const params = new URLSearchParams();
  params.set('follow', 'true');
  if (options.tail) {
    params.set('tail', options.tail);
  }
  if (options.since) {
    params.set('since', options.since);
  }
  if (options.type) {
    params.set('type', options.type);
  }

  const url = `${baseUrl}/applications/${applicationUuid}/logs?${params.toString()}`;

  logger.info('Streaming live logs... (Press Ctrl+C to stop)');
  logger.newline();

  try {
    const headers = {
      'Accept': 'text/event-stream',
    };

    // Add authentication header
    if (process.env.SAAC_API_KEY) {
      headers['X-API-Key'] = process.env.SAAC_API_KEY;
    } else if (user.sessionToken) {
      headers['X-Session-Token'] = user.sessionToken;
    } else if (user.apiKey) {
      headers['X-API-Key'] = user.apiKey;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

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

            // Skip connection event
            if (data.event === 'connected') {
              logger.success('Connected to log stream');
              logger.newline();
              continue;
            }

            // Display log message
            if (data.message) {
              const timestamp = new Date(data.timestamp).toLocaleTimeString();
              const service = logger.chalk.cyan(`[${data.service}]`);
              console.log(`${logger.chalk.gray(timestamp)} ${service} ${data.message}`);
            }
          } catch (parseError) {
            logger.warn(`Failed to parse log entry: ${line}`);
          }
        }
      }
    }

    logger.newline();
    logger.info('Stream ended');

  } catch (error) {
    logger.error('Failed to stream logs');
    logger.error(error.message);
    process.exit(1);
  }
}

module.exports = logs;
