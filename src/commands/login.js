/**
 * Login command - Two methods:
 * 1. With API key (fast): saac login -e email -k api_key
 * 2. With OTP (recovery): saac login -e email, then saac login -e email --otp code
 */

const inquirer = require('inquirer');
const validator = require('validator');
const api = require('../lib/api');
const { saveUser } = require('../lib/config');
const logger = require('../lib/logger');

async function login(options) {
  try {
    // Require email flag
    if (!options.email) {
      logger.error('Email is required');
      logger.newline();
      logger.info('Usage:');
      logger.log('  saac login -e <email> -k <api-key>           # Login with API key');
      logger.log('  saac login -e <email>                        # Request OTP via email');
      logger.log('  saac login -e <email> --otp <code>           # Verify OTP and login');
      logger.newline();
      logger.info('Examples:');
      logger.log('  saac login -e user@example.com -k cw_abc123  # Fast login');
      logger.log('  saac login -e user@example.com               # Send OTP to email');
      logger.log('  saac login -e user@example.com --otp 123456  # Verify OTP');
      process.exit(1);
    }

    const email = options.email;

    // Validate email format
    if (!validator.isEmail(email)) {
      logger.error('Invalid email address');
      process.exit(1);
    }

    logger.section('Login to StartAnAiCompany');
    logger.newline();

    // CASE 1: Login with API key (fast path)
    if (options.apiKey) {
      return await loginWithApiKey(email, options.apiKey);
    }

    // CASE 2: Verify OTP (second step)
    if (options.otp) {
      return await verifyOtpAndLogin(email, options.otp);
    }

    // CASE 3: Request OTP (first step)
    return await requestOtp(email);

  } catch (error) {
    logger.error(error.response?.data?.message || error.message);
    process.exit(1);
  }
}

/**
 * Login with API key (existing flow)
 */
async function loginWithApiKey(email, apiKey) {
  const spin = logger.spinner('Logging in with API key...').start();

  try {
    const result = await api.login(email, apiKey);

    spin.succeed('Login successful!');

    // Save session token
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

    if (result.expires_at) {
      const expirationDate = new Date(result.expires_at);
      logger.field('Session expires', expirationDate.toLocaleDateString());
    }

  } catch (error) {
    spin.fail('Login failed');
    throw error;
  }
}

/**
 * Request OTP via email (new flow - step 1)
 */
async function requestOtp(email) {
  const spin = logger.spinner('Sending verification code to email...').start();

  try {
    const result = await api.requestLoginOtp(email);

    spin.succeed('Verification code sent!');

    logger.newline();
    logger.success(`A verification code has been sent to ${logger.chalk.cyan(email)}`);
    logger.newline();
    logger.info('Check your email and run:');
    logger.log(`  ${logger.chalk.yellow(`saac login -e ${email} --otp <code>`)}`);
    logger.newline();
    logger.warn('Note: Check MailHog at https://mailhog.goryan.io for the verification code');
    logger.newline();

    if (result.otp_expires_at) {
      const expiresAt = new Date(result.otp_expires_at);
      const now = new Date();
      const minutesLeft = Math.ceil((expiresAt - now) / 60000);
      logger.info(`Code expires in ${minutesLeft} minutes`);
    }

  } catch (error) {
    spin.fail('Failed to send verification code');
    throw error;
  }
}

/**
 * Verify OTP and complete login (new flow - step 2)
 */
async function verifyOtpAndLogin(email, otpCode) {
  const spin = logger.spinner('Verifying code...').start();

  try {
    const result = await api.verifyLoginOtp(email, otpCode);

    spin.succeed('Verification successful!');

    // Save session token
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

    if (result.expires_at) {
      const expirationDate = new Date(result.expires_at);
      logger.field('Session expires', expirationDate.toLocaleDateString());
    }

    logger.newline();
    logger.info('💡 Tip: Generate an API key for faster future logins:');
    logger.log('  saac keys regenerate');

  } catch (error) {
    spin.fail('Verification failed');

    if (error.response?.status === 401) {
      logger.newline();
      logger.error('Invalid or expired verification code');
      logger.info('Request a new code:');
      logger.log(`  saac login -e ${email}`);
    }

    throw error;
  }
}

module.exports = login;
