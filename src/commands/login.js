/**
 * Login command
 */

const inquirer = require('inquirer');
const validator = require('validator');
const api = require('../lib/api');
const { saveUser } = require('../lib/config');
const logger = require('../lib/logger');

async function login(options) {
  try {
    // Require both email and API key flags (no interactive prompts)
    if (!options.email || !options.apiKey) {
      logger.error('Email and API key are required');
      logger.newline();
      logger.info('Usage:');
      logger.log('  saac login -e <email> -k <api-key>');
      logger.log('  saac login --email <email> --api-key <api-key>');
      logger.newline();
      logger.info('Example:');
      logger.log('  saac login -e user@example.com -k cw_your_api_key');
      process.exit(1);
    }

    const email = options.email;
    const apiKey = options.apiKey;

    // Validate email format
    if (!validator.isEmail(email)) {
      logger.error('Invalid email address');
      process.exit(1);
    }

    logger.section('Login to StartAnAiCompany');

    // Login and get session token
    const spin = logger.spinner('Logging in...').start();

    try {
      // Call /auth/login endpoint to get session token
      const result = await api.login(email, apiKey);

      spin.succeed('Login successful!');

      // Save session token and expiration
      saveUser({
        email: result.user.email || email,
        userId: result.user.id,
        sessionToken: result.session_token,
        expiresAt: result.expires_at,
        verified: result.user.verified,
      });

      logger.newline();
      logger.success('You are now logged in!');
      logger.newline();
      logger.field('Email', result.user.email || email);
      logger.field('Verified', result.user.verified ? 'Yes' : 'No');

      // Show expiration date
      if (result.expires_at) {
        const expirationDate = new Date(result.expires_at);
        logger.field('Session expires', expirationDate.toLocaleDateString());
      }

    } catch (error) {
      spin.fail('Login failed');
      throw error;
    }
  } catch (error) {
    logger.error(
      error.response?.data?.message || 'Invalid credentials'
    );
    process.exit(1);
  }
}

module.exports = login;
