/**
 * OAuth Helper Module
 * Handles Git OAuth authentication flow for SAAC CLI
 */

const axios = require('axios');
const open = require('open');
const crypto = require('crypto');
const logger = require('./logger');
const { getApiUrl } = require('./config');

/**
 * Extract git_host from repository URL
 * @param {string} gitUrl - Git repository URL (SSH or HTTPS)
 * @returns {string} - Git host domain
 */
function extractGitHost(gitUrl) {
  // SSH format: git@git.startanaicompany.com:user/repo.git
  const sshMatch = gitUrl.match(/git@([^:]+):/);
  if (sshMatch) {
    return sshMatch[1];
  }

  // HTTPS format: https://git.startanaicompany.com/user/repo.git
  const httpsMatch = gitUrl.match(/https?:\/\/([^/]+)/);
  if (httpsMatch) {
    return httpsMatch[1];
  }

  throw new Error('Invalid Git repository URL format. Expected SSH (git@host:user/repo.git) or HTTPS (https://host/user/repo.git)');
}

/**
 * Initiate OAuth flow for a git_host
 * @param {string} gitHost - Git host domain
 * @param {string} apiKey - User's API key
 * @returns {Promise<object>} - { gitUsername, gitHost }
 */
async function connectGitAccount(gitHost, apiKey) {
  const sessionId = crypto.randomBytes(16).toString('hex');

  logger.newline();
  logger.section(`Connecting to ${gitHost}`);
  logger.newline();
  logger.field('Session ID', sessionId);
  logger.newline();

  // Build authorization URL
  const baseUrl = getApiUrl().replace('/api/v1', ''); // Remove /api/v1 suffix
  const authUrl = `${baseUrl}/oauth/authorize?git_host=${encodeURIComponent(gitHost)}&session_id=${sessionId}&token=${encodeURIComponent(apiKey)}`;

  logger.info('Opening browser for authentication...');
  logger.newline();
  logger.warn('If browser doesn\'t open, visit:');
  logger.log(`  ${authUrl}`);
  logger.newline();

  // Open browser
  try {
    await open(authUrl);
  } catch (error) {
    logger.warn('Could not open browser automatically');
    logger.info('Please open the URL above manually');
  }

  const spin = logger.spinner('Waiting for authorization...').start();

  try {
    // Poll for completion
    const result = await pollForCompletion(sessionId, apiKey);

    spin.succeed(`Connected to ${gitHost} as ${result.gitUsername}`);

    return result;
  } catch (error) {
    spin.fail('Authorization failed');
    throw error;
  }
}

/**
 * Poll OAuth session until completed
 * @param {string} sessionId - Session ID
 * @param {string} apiKey - User's API key
 * @returns {Promise<object>} - { gitUsername, gitHost }
 */
async function pollForCompletion(sessionId, apiKey) {
  const pollInterval = 2000; // 2 seconds
  const maxAttempts = 150; // 5 minutes total (150 * 2s)

  const baseUrl = getApiUrl().replace('/api/v1', ''); // Remove /api/v1 suffix

  // Give user time to complete OAuth flow in browser (60 seconds)
  await sleep(60000);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(pollInterval);

    try {
      // Use correct header based on token type
      const headers = apiKey.startsWith('st_')
        ? { 'X-Session-Token': apiKey }
        : { 'X-API-Key': apiKey };

      const response = await axios.get(
        `${baseUrl}/oauth/poll/${sessionId}`,
        { headers }
      );

      const { status, gitUsername, gitHost } = response.data;

      if (status === 'completed') {
        return { gitUsername, gitHost };
      }

      if (status === 'failed') {
        throw new Error('OAuth authorization failed');
      }

      // Still pending, continue polling
      // Silent polling - spinner shows progress
    } catch (error) {
      // During polling, 401/404 errors are expected while user completes OAuth in browser
      // Only fail on other error types or after timeout
      const status = error.response?.status;

      if (status === 401 || status === 404) {
        // Session not found yet or not authorized yet - continue polling
        continue;
      }

      // For other errors (500, network errors, etc.), throw immediately
      throw error;
    }
  }

  throw new Error('OAuth authorization timed out (5 minutes). Please complete the authorization in your browser and try again.');
}

/**
 * Check if user has OAuth connection for git_host
 * @param {string} gitHost - Git host domain
 * @param {string} apiKey - User's API key
 * @returns {Promise<object|null>} - Connection object or null
 */
async function getConnection(gitHost, apiKey) {
  try {
    // Use correct header based on token type
    const headers = apiKey.startsWith('st_')
      ? { 'X-Session-Token': apiKey }
      : { 'X-API-Key': apiKey };

    const response = await axios.get(
      `${getApiUrl()}/users/me/oauth`,
      { headers }
    );

    const connection = response.data.connections.find(
      (conn) => conn.gitHost === gitHost
    );

    return connection || null;
  } catch (error) {
    return null;
  }
}

/**
 * List all OAuth connections
 * @param {string} apiKey - User's API key
 * @returns {Promise<array>} - Array of connection objects
 */
async function listConnections(apiKey) {
  // Use correct header based on token type
  const headers = apiKey.startsWith('st_')
    ? { 'X-Session-Token': apiKey }
    : { 'X-API-Key': apiKey };

  const response = await axios.get(
    `${getApiUrl()}/users/me/oauth`,
    { headers }
  );

  return response.data.connections || [];
}

/**
 * Revoke OAuth connection for git_host
 * @param {string} gitHost - Git host domain
 * @param {string} apiKey - User's API key
 */
async function revokeConnection(gitHost, apiKey) {
  // Use correct header based on token type
  const headers = apiKey.startsWith('st_')
    ? { 'X-Session-Token': apiKey }
    : { 'X-API-Key': apiKey };

  await axios.delete(
    `${getApiUrl()}/users/me/oauth/${encodeURIComponent(gitHost)}`,
    { headers }
  );
}

/**
 * Sleep utility
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  extractGitHost,
  connectGitAccount,
  getConnection,
  listConnections,
  revokeConnection,
};
