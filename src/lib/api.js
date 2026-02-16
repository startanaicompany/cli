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
async function deployApplication(uuid, options = {}) {
  // Use 5-minute timeout for deployment waiting
  const client = createClient(300000); // 5 minutes
  const response = await client.post(`/applications/${uuid}/deploy`, options);
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
 * Get deployment history for an application
 */
async function getDeployments(uuid, params = {}) {
  const client = createClient();
  const response = await client.get(`/applications/${uuid}/deployments`, { params });
  return response.data;
}

/**
 * Get deployment logs (build logs, not runtime logs)
 */
async function getDeploymentLogs(uuid, params = {}) {
  const client = createClient();
  const response = await client.get(`/applications/${uuid}/deployment-logs`, { params });
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

/**
 * Get environment variables for an application
 */
async function getEnvironmentVariables(uuid) {
  const client = createClient();
  const response = await client.get(`/applications/${uuid}/env`);
  return response.data;
}

/**
 * Execute a command in the application container
 * @param {string} uuid - Application UUID
 * @param {object} execRequest - { command, workdir, timeout }
 */
async function executeCommand(uuid, execRequest) {
  const client = createClient();
  const response = await client.post(`/applications/${uuid}/exec`, execRequest);
  return response.data;
}

/**
 * Get execution history for an application
 * @param {string} uuid - Application UUID
 * @param {object} params - { limit, offset }
 */
async function getExecutionHistory(uuid, params = {}) {
  const client = createClient();
  const response = await client.get(`/applications/${uuid}/exec/history`, { params });
  return response.data;
}

/**
 * List repositories from a connected Git host
 * @param {string} gitHost - Git host domain (e.g., 'github.com', 'git.startanaicompany.com')
 * @param {object} options - Query options
 * @param {number} options.page - Page number for pagination (default: 1)
 * @param {number} options.perPage - Results per page (default: 100, max: 100)
 * @param {string} options.sort - Sort order: 'updated', 'created', 'name' (default: 'updated')
 * @param {string} options.visibility - Filter: 'all', 'public', 'private' (default: 'all')
 * @param {boolean} options.includeCommits - Include latest commit info (default: false)
 * @returns {Promise<object>} - Repository listing response
 */
async function listGitRepositories(gitHost, options = {}) {
  const client = createClient();

  // Build query parameters
  const params = {};
  if (options.page) params.page = options.page;
  if (options.perPage) params.per_page = options.perPage;
  if (options.sort) params.sort = options.sort;
  if (options.visibility) params.visibility = options.visibility;
  if (options.includeCommits) params.include_commits = true;

  // URL encode the git host
  const encodedHost = encodeURIComponent(gitHost);

  const response = await client.get(`/git/connections/${encodedHost}/repos`, { params });
  return response.data;
}

/**
 * List database containers for an application
 * @param {string} uuid - Application UUID
 * @returns {Promise<object>} - { command_id, status }
 */
async function listDbContainers(uuid) {
  const client = createClient();
  const response = await client.get(`/applications/${uuid}/db/containers`);
  return response.data;
}

/**
 * Execute SQL query on application database
 * @param {string} uuid - Application UUID
 * @param {object} queryData - { query, db_name?, allow_writes? }
 * @returns {Promise<object>} - { command_id, status }
 */
async function executeSql(uuid, queryData) {
  const client = createClient();
  const response = await client.post(`/applications/${uuid}/db/sql`, queryData);
  return response.data;
}

/**
 * Get result of a database command (universal endpoint for all command types)
 * @param {string} uuid - Application UUID
 * @param {string} commandType - 'sql', 'redis', 'containers' (not used, kept for API compatibility)
 * @param {string} commandId - Command ID
 * @returns {Promise<object>} - { status, result, command_type, created_at, completed_at }
 */
async function getDbCommandResult(uuid, commandType, commandId) {
  const client = createClient();
  const response = await client.get(`/applications/${uuid}/db/result/${commandId}`);
  return response.data;
}

/**
 * Execute Redis command on application database
 * @param {string} uuid - Application UUID
 * @param {object} commandData - { command }
 * @returns {Promise<object>} - { command_id, status }
 */
async function executeRedis(uuid, commandData) {
  const client = createClient();
  const response = await client.post(`/applications/${uuid}/db/redis`, commandData);
  return response.data;
}

/**
 * Get database connection information
 * @param {string} uuid - Application UUID
 * @returns {Promise<object>} - { postgres: {...}, redis: {...} }
 */
async function getDbInfo(uuid) {
  const client = createClient();
  const response = await client.get(`/applications/${uuid}/db/info`);
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
  getEnvironmentVariables,
  updateDomain,
  deleteApplication,
  healthCheck,
  requestLoginOtp,
  verifyLoginOtp,
  regenerateApiKey,
  getApiKeyInfo,
  getDeployments,
  getDeploymentLogs,
  executeCommand,
  getExecutionHistory,
  listGitRepositories,
  listDbContainers,
  executeSql,
  getDbCommandResult,
  executeRedis,
  getDbInfo,
};
