/**
 * Error Display Utilities
 * Formats and displays deployment errors with actionable advice
 */

const chalk = require('chalk');

/**
 * Get actionable advice for specific error types
 */
function getErrorAdvice(errorType) {
  const advice = {
    PORT_CONFLICT: [
      'Fix: Remove host port bindings from your docker-compose.yml',
      '     Change "8080:8080" to just "8080"',
      '     Traefik will handle external routing automatically',
    ],
    BUILD_FAILED: [
      'Fix: Check your Dockerfile and build configuration',
      '     Run "docker build ." locally to debug',
      '     Verify all dependencies are properly specified',
    ],
    TIMEOUT: [
      'Note: Deployment may still be running in the background',
      '      Check status with: saac status',
      '      View logs with: saac logs --follow',
    ],
    UNKNOWN: [
      'Tip: Check the deployment logs for more details',
      '     Run: saac logs --follow',
    ],
    PARSE_ERROR: [
      'Note: Could not parse deployment logs',
      '      Contact support if this persists',
    ],
  };

  return advice[errorType] || advice.UNKNOWN;
}

/**
 * Format log lines for display
 */
function formatLogs(logs, maxLines = 10) {
  if (!logs || logs.length === 0) {
    return [];
  }

  // If logs is an array of objects with 'output' field
  if (logs[0] && typeof logs[0] === 'object' && logs[0].output) {
    return logs.slice(-maxLines).map(log => log.output);
  }

  // If logs is an array of strings
  return logs.slice(-maxLines);
}

/**
 * Display detailed deployment error information
 */
function displayDeploymentError(result, logger) {
  logger.newline();
  logger.error(`Deployment Error: ${result.message || 'Deployment failed'}`);
  logger.newline();

  // Display deployment info
  if (result.deployment_status || result.status) {
    logger.field('Status', result.deployment_status || result.status);
  }
  if (result.git_branch) {
    logger.field('Branch', result.git_branch);
  }
  if (result.deployment_uuid) {
    logger.field('Deployment ID', result.deployment_uuid);
  }

  logger.newline();

  // Display structured errors
  if (result.errors && result.errors.length > 0) {
    logger.info('Error Details:');
    result.errors.forEach(err => {
      logger.log(`  ${chalk.yellow(`[${err.type}]`)} ${err.message}`);
      if (err.detail) {
        const detailLines = err.detail.split('\n').slice(0, 3); // First 3 lines
        detailLines.forEach(line => {
          logger.log(`    ${chalk.gray(line)}`);
        });
      }
    });
    logger.newline();

    // Display actionable advice for the first error
    const firstError = result.errors[0];
    if (firstError && firstError.type) {
      const advice = getErrorAdvice(firstError.type);
      if (advice && advice.length > 0) {
        logger.info('Suggested Fix:');
        advice.forEach(line => {
          logger.log(`  ${chalk.cyan(line)}`);
        });
        logger.newline();
      }
    }
  }

  // Display relevant logs (filtered error logs)
  if (result.relevant_logs && result.relevant_logs.length > 0) {
    logger.info('Relevant Logs:');
    const logLines = formatLogs(result.relevant_logs, 5);
    logLines.forEach(line => {
      logger.log(`  ${chalk.gray(line)}`);
    });
    logger.newline();
  }

  // Display last logs (context)
  if (result.last_logs && result.last_logs.length > 0) {
    logger.info('Recent Log Output:');
    const logLines = formatLogs(result.last_logs, 5);
    logLines.forEach(line => {
      logger.log(`  ${chalk.gray(line)}`);
    });
    logger.newline();
  }

  // Suggest viewing full logs
  if (result.coolify_app_uuid || result.deployment_uuid) {
    const uuid = result.coolify_app_uuid || result.deployment_uuid;
    logger.info('View full logs:');
    logger.log(`  ${chalk.yellow('saac logs --follow')}`);
    logger.newline();
  }
}

/**
 * Display recovery instructions after failed create
 */
function displayCreateRecoveryInstructions(result, logger) {
  if (result.coolify_app_uuid) {
    logger.warn(`Application "${result.app_name}" was created but deployment failed.`);
    logger.info('Fix the issue in your repository, then redeploy:');
    logger.log(`  ${chalk.yellow('saac deploy')}`);
    logger.newline();
    logger.info('Or delete and recreate:');
    logger.log(`  ${chalk.yellow(`saac delete ${result.coolify_app_uuid}`)}`);
  }
}

/**
 * Display timeout-specific instructions
 */
function displayTimeoutInstructions(logger) {
  logger.warn('Deployment timed out after 5 minutes');
  logger.newline();
  logger.info('The deployment may still be running in the background.');
  logger.info('Check the status:');
  logger.log(`  ${chalk.yellow('saac status')}`);
  logger.newline();
  logger.info('Or view live logs:');
  logger.log(`  ${chalk.yellow('saac logs --follow')}`);
}

module.exports = {
  getErrorAdvice,
  formatLogs,
  displayDeploymentError,
  displayCreateRecoveryInstructions,
  displayTimeoutInstructions,
};
