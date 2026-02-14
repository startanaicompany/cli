/**
 * Configuration management
 * Handles both global (~/.config/startanaicompany/config.json) and project (.saac/config.json) configs
 */

const Conf = require('conf');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Global configuration (user credentials, API settings)
const globalConfig = new Conf({
  cwd: path.join(os.homedir(), '.config', 'startanaicompany'),
  configName: 'config',
  defaults: {
    apiUrl: 'https://apps.startanaicompany.com/api/v1',
    gitUrl: 'https://git.startanaicompany.com/api/v1',
  },
});

/**
 * Get project configuration (from .saac/config.json in current directory)
 */
function getProjectConfig() {
  const configPath = path.join(process.cwd(), '.saac', 'config.json');

  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const data = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

/**
 * Save project configuration
 */
function saveProjectConfig(config) {
  const configDir = path.join(process.cwd(), '.saac');
  const configPath = path.join(configDir, 'config.json');

  // Create .saac directory if it doesn't exist
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

/**
 * Check if user is authenticated and token is valid
 */
function isAuthenticated() {
  const user = getUser();

  if (!user || !user.email) {
    return false;
  }

  // Check for session token
  if (user.sessionToken) {
    // Check if token is expired
    if (user.expiresAt) {
      const expirationDate = new Date(user.expiresAt);
      const now = new Date();

      if (now >= expirationDate) {
        return false; // Token expired
      }
    }
    return true;
  }

  // Fallback: Check for API key (for backward compatibility)
  return !!user.apiKey;
}

/**
 * Check if session token is expired
 */
function isTokenExpired() {
  const user = getUser();
  if (!user?.expiresAt) return false;

  const expirationDate = new Date(user.expiresAt);
  const now = new Date();

  return now >= expirationDate;
}

/**
 * Check if token expires soon (within 7 days)
 */
function isTokenExpiringSoon() {
  const user = getUser();
  if (!user?.expiresAt) return false;

  const expirationDate = new Date(user.expiresAt);
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  return expirationDate <= sevenDaysFromNow && !isTokenExpired();
}

/**
 * Ensure user is authenticated, with auto-login support via environment variables
 * Checks for SAAC_USER_API_KEY and SAAC_USER_EMAIL environment variables
 * If present and user is not authenticated, attempts automatic login
 *
 * @returns {Promise<boolean>} - True if authenticated, false otherwise
 */
async function ensureAuthenticated() {
  // Step 1: Check if already authenticated (fast path)
  if (isAuthenticated()) {
    return true;
  }

  // Step 2: Check for environment variables
  const apiKey = process.env.SAAC_USER_API_KEY;
  const email = process.env.SAAC_USER_EMAIL;

  if (!apiKey || !email) {
    // No environment variables - cannot auto-login
    return false;
  }

  // Step 3: Attempt auto-login via API
  try {
    // Dynamically require to avoid circular dependency
    const api = require('./api');
    const result = await api.login(email, apiKey);

    // Step 4: Save session token to config
    saveUser({
      email: result.user.email,
      userId: result.user.id,
      sessionToken: result.session_token,
      expiresAt: result.expires_at,
      verified: result.user.verified,
    });

    // Auto-login successful
    return true;

  } catch (error) {
    // Auto-login failed (invalid key, network error, etc.)
    return false;
  }
}

/**
 * Get user info
 */
function getUser() {
  return globalConfig.get('user') || null;
}

/**
 * Save user info
 */
function saveUser(user) {
  globalConfig.set('user', user);
}

/**
 * Clear user info (logout)
 */
function clearUser() {
  globalConfig.delete('user');
}

/**
 * Get API URL
 */
function getApiUrl() {
  return globalConfig.get('apiUrl');
}

/**
 * Get Git URL
 */
function getGitUrl() {
  return globalConfig.get('gitUrl');
}

module.exports = {
  globalConfig,
  getProjectConfig,
  saveProjectConfig,
  isAuthenticated,
  ensureAuthenticated,
  isTokenExpired,
  isTokenExpiringSoon,
  getUser,
  saveUser,
  clearUser,
  getApiUrl,
  getGitUrl,
};
