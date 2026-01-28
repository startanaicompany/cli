/**
 * Exec Command - Execute commands in remote container
 */

const api = require('../lib/api');
const { getProjectConfig, isAuthenticated } = require('../lib/config');
const logger = require('../lib/logger');
const { table } = require('table');

/**
 * Execute a command in the remote container
 * @param {string} command - Command to execute
 * @param {object} options - Command options
 */
async function exec(command, options = {}) {
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

    // Build exec request
    const execRequest = {
      command,
      workdir: options.workdir || '/app',
      timeout: options.timeout || 30
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

    const spin = logger.spinner('Executing command in container...').start();

    let result;
    try {
      result = await api.executeCommand(applicationUuid, execRequest);
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
    logger.success(`✓ Execution ID: ${result.execution_id}`);
    logger.newline();

    logger.field('Exit Code', result.exit_code === 0
      ? logger.chalk.green(result.exit_code)
      : logger.chalk.red(result.exit_code)
    );
    logger.field('Duration', `${result.duration_ms}ms`);
    logger.field('Started', new Date(result.started_at).toLocaleString());
    logger.field('Completed', new Date(result.completed_at).toLocaleString());

    // Display stdout
    if (result.stdout) {
      logger.newline();
      logger.info('Standard Output:');
      logger.section('─'.repeat(60));
      console.log(result.stdout.trim());
      logger.section('─'.repeat(60));
    }

    // Display stderr
    if (result.stderr) {
      logger.newline();
      logger.warn('Standard Error:');
      logger.section('─'.repeat(60));
      console.error(result.stderr.trim());
      logger.section('─'.repeat(60));
    }

    // If no output
    if (!result.stdout && !result.stderr) {
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
