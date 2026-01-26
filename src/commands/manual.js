/**
 * Manual command - Display full documentation from GitHub
 */

const axios = require('axios');
const logger = require('../lib/logger');

async function manual() {
  try {
    logger.section('SAAC CLI Manual');
    logger.newline();

    const spin = logger.spinner('Fetching documentation from GitHub...').start();

    try {
      // Fetch README from GitHub
      const response = await axios.get(
        'https://raw.githubusercontent.com/startanaicompany/cli/master/README.md',
        { timeout: 10000 }
      );

      spin.succeed('Documentation loaded');
      logger.newline();

      // Display the README content
      console.log(response.data);

      logger.newline();
      logger.info('Online documentation: https://github.com/startanaicompany/cli');

    } catch (error) {
      spin.fail('Failed to fetch documentation');

      logger.newline();
      logger.error('Could not fetch README from GitHub');
      logger.newline();
      logger.info('Visit the documentation online:');
      logger.log('  https://github.com/startanaicompany/cli');
      logger.newline();
      logger.info('Or run:');
      logger.log('  saac --help');

      process.exit(1);
    }
  } catch (error) {
    logger.error(error.message);
    process.exit(1);
  }
}

module.exports = manual;
