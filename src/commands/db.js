/**
 * Database management commands
 */

const api = require('../lib/api');
const { getProjectConfig, ensureAuthenticated } = require('../lib/config');
const logger = require('../lib/logger');
const { table } = require('table');

/**
 * Poll for command result with timeout
 */
async function pollForResult(applicationUuid, commandId, commandType, maxWaitSeconds = 120) {
  const startTime = Date.now();
  const pollInterval = 1000; // 1 second

  while (true) {
    const elapsed = (Date.now() - startTime) / 1000;

    if (elapsed > maxWaitSeconds) {
      throw new Error(`Command timed out after ${maxWaitSeconds} seconds`);
    }

    try {
      const result = await api.getDbCommandResult(applicationUuid, commandType, commandId);

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
 * List database containers
 */
async function list(options) {
  try {
    if (!(await ensureAuthenticated())) {
      logger.error('Not logged in');
      logger.info('Run: saac login -e <email> -k <api-key>');
      process.exit(1);
    }

    const projectConfig = getProjectConfig();
    if (!projectConfig || !projectConfig.applicationUuid) {
      logger.error('No application found in current directory');
      logger.info('Run: saac init or saac create');
      process.exit(1);
    }

    const { applicationUuid, applicationName } = projectConfig;

    logger.section(`Database Containers for ${applicationName}`);
    logger.newline();

    const spin = logger.spinner('Fetching database containers...').start();

    try {
      const response = await api.listDbContainers(applicationUuid);
      const commandId = response.command_id;

      spin.text = 'Waiting for daemon to respond...';
      const result = await pollForResult(applicationUuid, commandId, 'containers');

      spin.succeed('Database containers retrieved');
      logger.newline();

      if (result.result && result.result.containers) {
        const containers = result.result.containers;

        if (containers.length === 0) {
          logger.info('No database containers found');
          return;
        }

        // Display as table
        const tableData = [
          ['Container Name', 'Type', 'Status', 'Image']
        ];

        containers.forEach(container => {
          tableData.push([
            container.name || 'N/A',
            container.type || 'N/A',
            container.status || 'N/A',
            container.image || 'N/A'
          ]);
        });

        console.log(table(tableData, {
          header: {
            alignment: 'center',
            content: 'Database Containers'
          }
        }));
      } else {
        logger.warn('No container data in response');
      }
    } catch (error) {
      spin.fail('Failed to fetch database containers');
      throw error;
    }
  } catch (error) {
    logger.error(error.response?.data?.message || error.message);
    process.exit(1);
  }
}

/**
 * Execute SQL query
 */
async function sql(query, options) {
  try {
    if (!(await ensureAuthenticated())) {
      logger.error('Not logged in');
      logger.info('Run: saac login -e <email> -k <api-key>');
      process.exit(1);
    }

    const projectConfig = getProjectConfig();
    if (!projectConfig || !projectConfig.applicationUuid) {
      logger.error('No application found in current directory');
      logger.info('Run: saac init or saac create');
      process.exit(1);
    }

    const { applicationUuid, applicationName } = projectConfig;

    logger.section(`Executing SQL Query on ${applicationName}`);
    logger.newline();

    const spin = logger.spinner('Executing query...').start();

    try {
      const requestBody = {
        query: query,
        allow_writes: options.write || false
      };

      if (options.db) {
        requestBody.db_name = options.db;
      }

      const response = await api.executeSql(applicationUuid, requestBody);
      const commandId = response.command_id;

      spin.text = 'Waiting for daemon to execute query...';
      const result = await pollForResult(applicationUuid, commandId, 'sql');

      spin.succeed('Query executed');
      logger.newline();

      if (result.result && result.result.output) {
        // Display CSV output as table
        const csvData = result.result.output;
        const rows = csvData.trim().split('\n').map(row => row.split(','));

        if (rows.length > 0) {
          console.log(table(rows));
          logger.newline();
          logger.info(`Rows returned: ${rows.length - 1}`); // -1 for header
        } else {
          logger.info('Query returned no results');
        }
      } else if (result.result && result.result.error) {
        logger.error('Query error:');
        logger.log(result.result.error);
      } else {
        logger.info('Query completed (no output)');
      }
    } catch (error) {
      spin.fail('Query execution failed');
      throw error;
    }
  } catch (error) {
    logger.error(error.response?.data?.message || error.message);
    process.exit(1);
  }
}

/**
 * Execute Redis command
 */
async function redis(commandArgs, options) {
  try {
    if (!(await ensureAuthenticated())) {
      logger.error('Not logged in');
      logger.info('Run: saac login -e <email> -k <api-key>');
      process.exit(1);
    }

    const projectConfig = getProjectConfig();
    if (!projectConfig || !projectConfig.applicationUuid) {
      logger.error('No application found in current directory');
      logger.info('Run: saac init or saac create');
      process.exit(1);
    }

    const { applicationUuid, applicationName } = projectConfig;

    // Join command args into a single string
    const command = commandArgs.join(' ');

    logger.section(`Executing Redis Command on ${applicationName}`);
    logger.newline();
    logger.info(`Command: ${command}`);
    logger.newline();

    const spin = logger.spinner('Executing command...').start();

    try {
      const response = await api.executeRedis(applicationUuid, { command });
      const commandId = response.command_id;

      spin.text = 'Waiting for daemon to execute command...';
      const result = await pollForResult(applicationUuid, commandId, 'redis');

      spin.succeed('Command executed');
      logger.newline();

      if (result.result && result.result.output) {
        logger.success('Result:');
        logger.log(result.result.output);
      } else if (result.result && result.result.error) {
        logger.error('Command error:');
        logger.log(result.result.error);
      } else {
        logger.info('Command completed (no output)');
      }
    } catch (error) {
      spin.fail('Command execution failed');
      throw error;
    }
  } catch (error) {
    logger.error(error.response?.data?.message || error.message);
    process.exit(1);
  }
}

/**
 * Show database connection info
 */
async function info(options) {
  try {
    if (!(await ensureAuthenticated())) {
      logger.error('Not logged in');
      logger.info('Run: saac login -e <email> -k <api-key>');
      process.exit(1);
    }

    const projectConfig = getProjectConfig();
    if (!projectConfig || !projectConfig.applicationUuid) {
      logger.error('No application found in current directory');
      logger.info('Run: saac init or saac create');
      process.exit(1);
    }

    const { applicationUuid, applicationName } = projectConfig;

    logger.section(`Database Connection Info for ${applicationName}`);
    logger.newline();

    const spin = logger.spinner('Fetching connection info...').start();

    try {
      const result = await api.getDbInfo(applicationUuid);

      spin.succeed('Connection info retrieved');
      logger.newline();

      if (result.postgres) {
        logger.success('PostgreSQL:');
        logger.field('  Host', result.postgres.host || 'postgres.internal');
        logger.field('  Port', result.postgres.port || '5432');
        logger.field('  Database', result.postgres.database || 'N/A');
        logger.newline();
      }

      if (result.redis) {
        logger.success('Redis:');
        logger.field('  Host', result.redis.host || 'redis.internal');
        logger.field('  Port', result.redis.port || '6379');
        logger.newline();
      }

      if (!result.postgres && !result.redis) {
        logger.warn('No database connection info available');
      }

      logger.info('Note: These are internal network addresses (only accessible within the application network)');
    } catch (error) {
      spin.fail('Failed to fetch connection info');
      throw error;
    }
  } catch (error) {
    logger.error(error.response?.data?.message || error.message);
    process.exit(1);
  }
}

module.exports = {
  list,
  sql,
  redis,
  info
};
