/**
 * API Client for SAAC Wrapper API
 */

const axios = require('axios');
const os = require('os');
const { getApiUrl, getUser } = require('./config');
const pkg = require('../../package.json');

/**
 * Create axios instance with base configuration
 * @param {number} timeout - Timeout in milliseconds (default: 30000)
 */
function createClient(timeout = 30000) {
  const user = getUser();
  const envApiKey = process.env.SAAC_API_KEY; // For CI/CD

  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': `saac-cli/${pkg.version} (${os.platform()}; ${os.arch()})`,
  };

  // Priority order:
  // 1. Environment variable (for CI/CD, scripts)
  // 2. Session token (for CLI users)
  // 3. API key (backward compatibility)
  if (envApiKey) {
    headers['X-API-Key'] = envApiKey;
  } else if (user?.sessionToken) {
    headers['X-Session-Token'] = user.sessionToken;
  } else if (user?.apiKey) {
    headers['X-API-Key'] = user.apiKey;
  }

  return axios.create({
    baseURL: getApiUrl(),
    timeout: timeout,
    headers,
  });
}

/**
 * Login and get session token
 */
async function login(email, apiKey) {
  const client = axios.create({
    baseURL: getApiUrl(),
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey, // Use API key for login
    },
  });

  const response = await client.post('/auth/login', { email });
  return response.data;
}

/**
 * Register a new user
 * Note: git_username no longer required - users connect Git via OAuth separately
 */
async function register(email) {
  const client = createClient();
  const response = await client.post('/users/register', { email });
  return response.data;
}

/**
 * Verify email with code
 */
async function verifyEmail(userId, code) {
  const client = createClient();
  const response = await client.post('/users/verify', {
    user_id: userId,
    verification_code: code,
  });
  return response.data;
}

/**
 * Get current user info
 */
async function getUserInfo() {
  const client = createClient();
  const response = await client.get('/users/me');
  return response.data;
}

/**
 * Create a new application
 * Note: This waits for deployment to complete (up to 5 minutes)
 */
async function createApplication(appData) {
  // Use 5-minute timeout for deployment waiting
  const client = createClient(300000); // 5 minutes
  const response = await client.post('/applications', appData);
  return response.data;
}

/**
 * List all applications
 */
async function listApplications() {
  const client = createClient();
  const response = await client.get('/applications');
  return response.data;
}

/**
 * Get application details
 */
async function getApplication(uuid) {
  const client = createClient();
  const response = await client.get(`/applications/${uuid}`);
  return response.data;
}

/**
 * Deploy application
 * Note: This waits for deployment to complete (up to 5 minutes)
 */
async function deployApplication(uuid) {
  // Use 5-minute timeout for deployment waiting
  const client = createClient(300000); // 5 minutes
  const response = await client.post(`/applications/${uuid}/deploy`);
  return response.data;
}

/**
 * Get application logs
 */
async function getApplicationLogs(uuid, params = {}) {
  const client = createClient();
  const response = await client.get(`/applications/${uuid}/logs`, { params });
  return response.data;
}

/**
 * Update application configuration
 */
async function updateApplication(uuid, updateData) {
  const client = createClient();
  const response = await client.patch(`/applications/${uuid}`, updateData);
  return response.data;
}

/**
 * Update environment variables
 */
async function updateEnvironmentVariables(uuid, variables) {
  const client = createClient();
  const response = await client.patch(`/applications/${uuid}/env`, {
    variables,
  });
  return response.data;
}

/**
 * Update application domain
 */
async function updateDomain(uuid, subdomain, domainSuffix) {
  const client = createClient();
  const response = await client.patch(`/applications/${uuid}/domain`, {
    subdomain,
    domain_suffix: domainSuffix,
  });
  return response.data;
}

/**
 * Delete application
 */
async function deleteApplication(uuid) {
  const client = createClient();
  const response = await client.delete(`/applications/${uuid}`);
  return response.data;
}

/**
 * Health check
 */
async function healthCheck() {
  const client = createClient();
  const response = await client.get('/health');
  return response.data;
}

/**
 * Request login OTP (no API key required)
 */
async function requestLoginOtp(email) {
  const client = axios.create({
    baseURL: getApiUrl(),
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': `saac-cli/${pkg.version} (${os.platform()}; ${os.arch()})`,
    },
  });

  const response = await client.post('/auth/login-otp', { email });
  return response.data;
}

/**
 * Verify login OTP and get session token
 */
async function verifyLoginOtp(email, otpCode) {
  const client = axios.create({
    baseURL: getApiUrl(),
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': `saac-cli/${pkg.version} (${os.platform()}; ${os.arch()})`,
    },
  });

  const response = await client.post('/auth/verify-otp', {
    email,
    otp_code: otpCode,
  });
  return response.data;
}

/**
 * Regenerate API key (requires authentication)
 */
async function regenerateApiKey() {
  const client = createClient();
  const response = await client.post('/users/regenerate-key');
  return response.data;
}

/**
 * Get API key info (prefix, created date, last used)
 */
async function getApiKeyInfo() {
  const client = createClient();
  const response = await client.get('/users/api-key');
  return response.data;
}

module.exports = {
  createClient,
  login,
  register,
  verifyEmail,
  getUserInfo,
  createApplication,
  updateApplication,
  listApplications,
  getApplication,
  deployApplication,
  getApplicationLogs,
  updateEnvironmentVariables,
  updateDomain,
  deleteApplication,
  healthCheck,
  requestLoginOtp,
  verifyLoginOtp,
  regenerateApiKey,
  getApiKeyInfo,
};
