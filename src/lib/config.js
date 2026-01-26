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
  isTokenExpired,
  isTokenExpiringSoon,
  getUser,
  saveUser,
  clearUser,
  getApiUrl,
  getGitUrl,
};
