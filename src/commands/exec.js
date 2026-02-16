/**
 * Exec Command - Execute commands in remote container
 */

const api = require('../lib/api');
const { getProjectConfig, ensureAuthenticated } = require('../lib/config');
const logger = require('../lib/logger');
const { table } = require('table');

/**
 * Poll for command result with timeout
 */
async function pollForResult(applicationUuid, commandId, maxWaitSeconds = 120) {
  const startTime = Date.now();
  const pollInterval = 1000; // 1 second

  while (true) {
    const elapsed = (Date.now() - startTime) / 1000;

    if (elapsed > maxWaitSeconds) {
      throw new Error(`Command timed out after ${maxWaitSeconds} seconds`);
    }

    try {
      const result = await api.getDbCommandResult(applicationUuid, 'exec', commandId);

      if (result.status === 'completed') {
        return result;
      }

      if (result.status === 'failed') {
        const errorMsg = result.result?.error || result.error || 'Command failed';
        throw new Error(errorMsg);
      }

      // Still pending, wait and retry
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    } catch (error) {
      // If error is not a 404 (command not found yet), rethrow
      if (error.response?.status !== 404) {
        throw error;
      }
      // 404 means command not processed yet, keep polling
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }
}

/**
 * Execute a command in the remote container
 * @param {string} command - Command to execute
 * @param {object} options - Command options
 */
async function exec(command, options = {}) {
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

    // Build exec request
    const execRequest = {
      command,
      workdir: options.workdir || '/app',
      timeout: parseInt(options.timeout) || 30
    };

    // Validate timeout
    if (execRequest.timeout > 300) {
      logger.error('Timeout cannot exceed 300 seconds (5 minutes)');
      process.exit(1);
    }

    logger.newline();
    logger.section(`Executing Command: ${applicationName}`);
    logger.newline();
    logger.field('  Command', command);
    logger.field('  Working Directory', execRequest.workdir);
    logger.field('  Timeout', `${execRequest.timeout}s`);
    logger.newline();

    const spin = logger.spinner('Queueing command...').start();

    let response;
    let result;
    try {
      // Queue the command
      response = await api.executeCommand(applicationUuid, execRequest);
      const commandId = response.command_id;

      spin.text = 'Waiting for daemon to execute command...';

      // Poll for result with timeout buffer
      result = await pollForResult(applicationUuid, commandId, execRequest.timeout + 30);

      spin.succeed('Command executed');
    } catch (error) {
      spin.fail('Command execution failed');

      if (error.response?.status === 400) {
        const data = error.response.data;
        logger.newline();

        if (data.error === 'VALIDATION_ERROR') {
          logger.error('Command validation failed');
          logger.newline();
          logger.warn(data.message);

          if (data.message.includes('not in allowlist')) {
            logger.newline();
            logger.info('Allowed commands include:');
            logger.log('  Node.js: npm, node, npx, yarn, pnpm');
            logger.log('  Python: python, python3, pip, poetry');
            logger.log('  Ruby: bundle, rake, rails');
            logger.log('  Shell: sh, bash, echo, cat, ls, pwd');
            logger.log('  Database: psql, mysql, mongosh');
          }
        }
      } else if (error.response?.status === 408) {
        logger.newline();
        logger.error('Command execution timed out');
        logger.info(`Try increasing timeout with: --timeout ${execRequest.timeout * 2}`);
      } else if (error.response?.status === 429) {
        logger.newline();
        logger.error('Rate limit exceeded');
        logger.info('Limit: 30 exec commands per 5 minutes');
        logger.info('Please wait a few minutes and try again');
      } else if (error.response?.status === 503) {
        logger.newline();
        logger.error('Container is not running');
        logger.info('Check application status with: saac status');
      }

      throw error;
    }

    logger.newline();

    // Display execution results
    const execResult = result.result || {};

    // Calculate duration
    let duration = 'N/A';
    if (result.created_at && result.completed_at) {
      const start = new Date(result.created_at);
      const end = new Date(result.completed_at);
      duration = `${end - start}ms`;
    }

    logger.field('Exit Code', execResult.exit_code !== undefined
      ? (execResult.exit_code === 0
          ? logger.chalk.green(execResult.exit_code)
          : logger.chalk.red(execResult.exit_code))
      : 'N/A'
    );
    logger.field('Duration', duration);
    if (result.created_at) {
      logger.field('Started', new Date(result.created_at).toLocaleString());
    }
    if (result.completed_at) {
      logger.field('Completed', new Date(result.completed_at).toLocaleString());
    }

    // Display stdout
    if (execResult.stdout) {
      logger.newline();
      logger.info('Standard Output:');
      logger.section('─'.repeat(60));
      console.log(execResult.stdout.trim());
      logger.section('─'.repeat(60));
    }

    // Display stderr
    if (execResult.stderr) {
      logger.newline();
      logger.warn('Standard Error:');
      logger.section('─'.repeat(60));
      console.error(execResult.stderr.trim());
      logger.section('─'.repeat(60));
    }

    // If no output
    if (!execResult.stdout && !execResult.stderr) {
      logger.newline();
      logger.info('(No output)');
    }

    logger.newline();

    // Exit with same code as remote command
    process.exit(result.exit_code);

  } catch (error) {
    logger.error(error.response?.data?.message || error.message);
    process.exit(1);
  }
}

/**
 * View execution history
 * @param {object} options - Command options
 */
async function history(options = {}) {
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

    const params = {
      limit: options.limit || 20,
      offset: options.offset || 0
    };

    // Validate params
    if (params.limit > 100) {
      logger.error('Limit cannot exceed 100');
      process.exit(1);
    }

    logger.newline();
    const spin = logger.spinner('Fetching execution history...').start();

    let result;
    try {
      result = await api.getExecutionHistory(applicationUuid, params);
      spin.succeed('Execution history retrieved');
    } catch (error) {
      spin.fail('Failed to fetch execution history');
      throw error;
    }

    logger.newline();

    if (result.executions.length === 0) {
      logger.warn('No execution history found');
      logger.newline();
      logger.info('Run a command first:');
      logger.log('  saac exec "npm run db:migrate"');
      return;
    }

    logger.section(`Execution History: ${applicationName}`);
    logger.newline();

    // Create table data
    const data = [
      ['ID', 'Command', 'Status', 'Exit Code', 'Duration', 'Started'],
    ];

    for (const execution of result.executions) {
      const shortId = execution.id.substring(0, 8);
      const command = execution.command.length > 40
        ? execution.command.substring(0, 37) + '...'
        : execution.command;

      let statusDisplay;
      if (execution.status === 'completed') {
        statusDisplay = execution.exit_code === 0
          ? logger.chalk.green('✓ completed')
          : logger.chalk.red('✗ completed');
      } else if (execution.status === 'failed') {
        statusDisplay = logger.chalk.red('✗ failed');
      } else if (execution.status === 'timeout') {
        statusDisplay = logger.chalk.yellow('⏱ timeout');
      } else if (execution.status === 'running') {
        statusDisplay = logger.chalk.blue('▸ running');
      } else {
        statusDisplay = logger.chalk.gray('○ pending');
      }

      const exitCode = execution.exit_code !== null && execution.exit_code !== undefined
        ? (execution.exit_code === 0 ? logger.chalk.green(execution.exit_code) : logger.chalk.red(execution.exit_code))
        : logger.chalk.gray('-');

      const duration = execution.duration_seconds !== null && execution.duration_seconds !== undefined
        ? `${execution.duration_seconds}s`
        : logger.chalk.gray('-');

      const startedAt = execution.started_at
        ? new Date(execution.started_at).toLocaleString()
        : logger.chalk.gray('Not started');

      data.push([shortId, command, statusDisplay, exitCode, duration, startedAt]);
    }

    console.log(table(data));

    logger.info(`Showing ${result.executions.length} of ${result.total} executions`);

    if (result.offset + result.limit < result.total) {
      logger.newline();
      logger.info('View more:');
      logger.log(`  saac exec --history --offset ${result.offset + result.limit} --limit ${result.limit}`);
    }

    logger.newline();
    logger.info('View details of a specific execution:');
    logger.log('  saac logs  # View application logs');

  } catch (error) {
    logger.error(error.response?.data?.message || error.message);
    process.exit(1);
  }
}

module.exports = {
  exec,
  history,
};
