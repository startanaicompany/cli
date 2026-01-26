/**
 * Register command - Create a new account
 */

const inquirer = require('inquirer');
const validator = require('validator');
const api = require('../lib/api');
const { saveUser } = require('../lib/config');
const logger = require('../lib/logger');

async function register(options) {
  try {
    // Require email flag (no interactive prompt)
    if (!options.email) {
      logger.error('Email is required');
      logger.newline();
      logger.info('Usage:');
      logger.log('  saac register -e <email>');
      logger.log('  saac register --email <email> [--git-username <username>]');
      logger.newline();
      logger.info('Example:');
      logger.log('  saac register -e user@example.com');
      logger.log('  saac register -e user@example.com --git-username myuser');
      process.exit(1);
    }

    const email = options.email;

    // Validate email format
    if (!validator.isEmail(email)) {
      logger.error('Invalid email address');
      process.exit(1);
    }

    const gitUsername = options.gitUsername || undefined;

    logger.section('Register for StartAnAiCompany');

    // Register via API
    const spin = logger.spinner('Creating account...').start();

    try {
      const result = await api.register(email, gitUsername);

      spin.succeed('Account created successfully!');

      // Save user info
      // If backend returns session_token, use it; otherwise fall back to api_key
      const userData = {
        email: result.email || email,
        userId: result.user_id,
        verified: result.verified || false,
      };

      if (result.session_token) {
        userData.sessionToken = result.session_token;
        userData.expiresAt = result.expires_at;
      } else {
        // Backward compatibility: use API key if session token not provided
        userData.apiKey = result.api_key;
      }

      saveUser(userData);

      logger.newline();
      logger.success('Registration complete!');
      logger.newline();

      if (!result.verified) {
        logger.info(
          `A verification code has been sent to ${logger.chalk.cyan(email)}`
        );
        logger.info(
          `Check your email and run: ${logger.chalk.yellow(
            'saac verify <code>'
          )}`
        );
        logger.newline();
        logger.warn(
          'Note: Check MailHog at https://mailhog.goryan.io for the verification code'
        );
      }

      logger.newline();
      logger.field('Email', email);

      // Show session token or API key info
      if (result.session_token) {
        logger.field('Session Token', result.session_token.substring(0, 20) + '...');
        if (result.expires_at) {
          const expirationDate = new Date(result.expires_at);
          logger.field('Expires', expirationDate.toLocaleDateString());
        }
      } else if (result.api_key) {
        logger.field('API Key', result.api_key.substring(0, 20) + '...');
      }

    } catch (error) {
      spin.fail('Registration failed');
      throw error;
    }
  } catch (error) {
    logger.error(error.response?.data?.message || error.message);
    process.exit(1);
  }
}

module.exports = register;
