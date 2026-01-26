/**
 * Verify email command
 */

const api = require('../lib/api');
const { getUser, saveUser } = require('../lib/config');
const logger = require('../lib/logger');

async function verify(code) {
  try {
    if (!code) {
      logger.error('Verification code is required');
      logger.newline();
      logger.info('Usage:');
      logger.log('  saac verify <code>');
      logger.newline();
      logger.info('Example:');
      logger.log('  saac verify 123456');
      process.exit(1);
    }

    const user = getUser();

    if (!user || !user.userId) {
      logger.error('No user found. Please register first');
      logger.newline();
      logger.info('Run:');
      logger.log('  saac register -e <email>');
      process.exit(1);
    }

    if (user.verified) {
      logger.warn('Email already verified!');
      return;
    }

    logger.section('Verify Email');

    const spin = logger.spinner('Verifying email...').start();

    try {
      const result = await api.verifyEmail(user.userId, code);

      spin.succeed('Email verified successfully!');

      // Update user verification status and save API key
      const updatedUser = {
        ...user,
        verified: true,
      };

      // Save API key if returned (only returned once on verification)
      if (result.api_key) {
        updatedUser.apiKey = result.api_key;
      }

      // If backend returns session token after verification, update it
      if (result.session_token) {
        updatedUser.sessionToken = result.session_token;
        updatedUser.expiresAt = result.expires_at;
      }

      saveUser(updatedUser);

      logger.newline();
      logger.success('Your account is now verified!');
      logger.info('You can now create and deploy applications.');

      // Show API key if provided
      if (result.api_key) {
        logger.newline();
        logger.field('API Key', result.api_key.substring(0, 20) + '...');
        logger.warn('Save your API key securely. It will not be shown again.');
      }

      // Show expiration if session token was updated
      if (result.expires_at) {
        const expirationDate = new Date(result.expires_at);
        logger.field('Session expires', expirationDate.toLocaleDateString());
      }

    } catch (error) {
      spin.fail('Verification failed');
      throw error;
    }
  } catch (error) {
    logger.error(
      error.response?.data?.message || 'Invalid verification code'
    );
    process.exit(1);
  }
}

module.exports = verify;
