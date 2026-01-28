/**
 * Shell Command - Interactive remote shell via WebSocket (Project Aurora)
 *
 * This command provides a TRUE remote shell experience - you're actually inside
 * the container, not just a local shell with env vars loaded.
 */

const WebSocket = require('ws');
const readline = require('readline');
const { getProjectConfig, isAuthenticated, getUser, getApiUrl } = require('../lib/config');
const logger = require('../lib/logger');

/**
 * WebSocket Shell Client
 * Connects to backend WebSocket server and provides interactive shell
 */
class ShellClient {
  constructor(serverUrl, token, applicationUuid) {
    this.serverUrl = serverUrl;
    this.token = token;
    this.applicationUuid = applicationUuid;
    this.ws = null;
    this.sessionId = null;
    this.connected = false;
    this.rl = null;
    this.lastScreen = '';
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
    this.shouldReconnect = true;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      // Build WebSocket URL
      const wsUrl = this.buildWebSocketUrl();

      logger.info('Connecting to remote shell...');

      this.ws = new WebSocket(wsUrl, {
        headers: {
          'X-Session-Token': this.token,
        },
        // Handle HTTPS/WSS
        rejectUnauthorized: process.env.NODE_ENV === 'production'
      });

      // Connection timeout
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
        if (this.ws) {
          this.ws.close();
        }
      }, 30000); // 30 second timeout for container creation

      this.ws.on('open', () => {
        clearTimeout(timeout);
        this.connected = true;
        this.reconnectAttempts = 0;
        logger.success('Connected to remote container');
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (err) {
          logger.error('Error parsing message:', err.message);
        }
      });

      this.ws.on('close', (code, reason) => {
        this.connected = false;
        const reasonText = reason ? reason.toString() : '';

        if (code === 1000) {
          // Normal closure
          logger.info('Disconnected from remote shell');
        } else {
          logger.warn(`Disconnected: ${code}${reasonText ? ' - ' + reasonText : ''}`);

          if (this.shouldReconnect && code !== 4001 && code !== 4003) {
            this.handleReconnect();
          }
        }
      });

      this.ws.on('error', (error) => {
        clearTimeout(timeout);

        // Check for specific error codes
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          logger.error('Authentication failed');
          reject(new Error('Authentication failed'));
        } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
          logger.error('Access denied - you do not own this application');
          reject(new Error('Access denied'));
        } else {
          logger.error('WebSocket error:', error.message);
          reject(error);
        }
      });
    });
  }

  buildWebSocketUrl() {
    // Convert HTTP(S) URL to WS(S) URL
    const apiUrl = this.serverUrl;
    let wsUrl = apiUrl.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://');

    // Remove /api/v1 suffix if present
    wsUrl = wsUrl.replace(/\/api\/v1$/, '');

    // Build shell connect endpoint
    wsUrl = `${wsUrl}/api/v1/shell/connect?app=${this.applicationUuid}&token=${this.token}`;

    return wsUrl;
  }

  handleMessage(message) {
    switch (message.type) {
      case 'control':
        this.handleControlMessage(message);
        break;

      case 'output':
        this.handleOutputMessage(message);
        break;

      case 'pong':
        // Heartbeat response
        break;

      default:
        logger.warn('Unknown message type:', message.type);
    }
  }

  handleControlMessage(message) {
    if (message.action === 'session_ready') {
      this.sessionId = message.data.session_id;
      const status = message.data.status;

      if (status === 'creating') {
        logger.info('Container is being created, please wait...');
      } else if (status === 'active') {
        logger.success('Shell session ready!');
        logger.info('Type commands below. Press Ctrl+D or type "exit" to quit.');
        logger.newline();

        // Start terminal interface
        this.startTerminal();
      }
    } else if (message.action === 'session_active') {
      logger.success('Container is ready!');
      logger.info('Type commands below. Press Ctrl+D or type "exit" to quit.');
      logger.newline();

      // Start terminal interface
      if (!this.rl) {
        this.startTerminal();
      }
    } else if (message.action === 'error') {
      logger.error('Server error:', message.data.message);
    }
  }

  handleOutputMessage(message) {
    const screen = message.data.screen;

    // Only update if screen changed
    if (screen !== this.lastScreen) {
      // Clear current readline prompt
      if (this.rl) {
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
      }

      // Display full screen content
      // For better UX, only show last 40 lines
      const lines = screen.split('\n');
      const displayLines = lines.slice(-40);

      console.log(displayLines.join('\n'));

      this.lastScreen = screen;
    }

    // Show prompt again
    if (this.rl) {
      this.rl.prompt(true);
    }
  }

  startTerminal() {
    // Create readline interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '',  // No prompt - we get it from the container
      terminal: true,
      historySize: 1000
    });

    // Handle user input
    this.rl.on('line', (input) => {
      const command = input.trim();

      // Local exit command
      if (command === 'exit' || command === 'quit') {
        this.cleanup();
        return;
      }

      // Send command to server
      if (this.connected && this.ws.readyState === WebSocket.OPEN) {
        this.sendCommand(command);
      } else {
        logger.error('Not connected to server');
      }
    });

    // Handle Ctrl+C (SIGINT)
    this.rl.on('SIGINT', () => {
      // Send Ctrl+C to remote shell
      if (this.connected) {
        this.sendCommand('\x03'); // ASCII ETX (Ctrl+C)
      }
      this.rl.prompt();
    });

    // Handle Ctrl+D (EOF) - exit
    process.stdin.on('keypress', (str, key) => {
      if (key && key.ctrl && key.name === 'd') {
        this.cleanup();
      }
    });

    // Enable keypress events
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false); // Keep cooked mode for line editing
    }
  }

  sendCommand(command) {
    if (!this.connected || this.ws.readyState !== WebSocket.OPEN) {
      logger.error('Not connected to server');
      return false;
    }

    const message = {
      type: 'command',
      data: {
        command: command
      }
    };

    this.ws.send(JSON.stringify(message));
    return true;
  }

  async handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached. Exiting.');
      this.cleanup();
      return;
    }

    this.reconnectAttempts++;
    const delay = 2000 * this.reconnectAttempts; // Exponential backoff

    logger.info(`Reconnecting in ${delay/1000}s... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      await this.connect();
    } catch (err) {
      logger.error('Reconnection failed:', err.message);
    }
  }

  cleanup() {
    logger.newline();
    logger.info('Disconnecting from remote shell...');

    this.shouldReconnect = false;

    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client closing');
      this.ws = null;
    }

    // Restore terminal
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }

    process.exit(0);
  }

  startHeartbeat() {
    // Send ping every 30 seconds to keep connection alive
    setInterval(() => {
      if (this.connected && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
    }, 30000);
  }
}

/**
 * Shell command main function
 */
async function shell(options = {}) {
  try {
    // Check authentication
    if (!isAuthenticated()) {
      logger.error('Not logged in. Run: saac login');
      process.exit(1);
    }

    // Check for project config
    const projectConfig = getProjectConfig();
    if (!projectConfig || !projectConfig.applicationUuid) {
      logger.error('No application found in current directory');
      logger.info('Run this command from a project directory (must have .saac/config.json)');
      logger.newline();
      logger.info('Or initialize with:');
      logger.log('  saac init');
      process.exit(1);
    }

    const { applicationUuid, applicationName } = projectConfig;

    // Get user and token
    const user = getUser();
    const token = user.sessionToken || user.apiKey;

    if (!token) {
      logger.error('No authentication token found. Please login again.');
      process.exit(1);
    }

    // Get server URL
    const serverUrl = getApiUrl();

    // Show banner
    logger.newline();
    logger.section(`Remote Shell: ${applicationName}`);
    logger.newline();
    logger.info('Connecting to container...');
    logger.info('This may take up to 30 seconds for container creation.');
    logger.newline();

    // Create shell client
    const client = new ShellClient(serverUrl, token, applicationUuid);

    // Handle process termination
    process.on('SIGTERM', () => {
      client.cleanup();
    });

    process.on('SIGINT', () => {
      // Let readline handle SIGINT
    });

    // Connect to server
    try {
      await client.connect();

      // Start heartbeat
      client.startHeartbeat();

    } catch (err) {
      if (err.message === 'Authentication failed') {
        logger.error('Authentication failed. Please login again:');
        logger.log('  saac login');
      } else if (err.message === 'Access denied') {
        logger.error('Access denied. You do not own this application.');
      } else if (err.message === 'Connection timeout') {
        logger.error('Connection timeout. The server may be unavailable or the container failed to start.');
        logger.info('Please try again later or check application status:');
        logger.log('  saac status');
      } else {
        logger.error('Failed to connect:', err.message);
        logger.info('Please check your network connection and try again.');
      }
      process.exit(1);
    }

  } catch (error) {
    logger.error(error.message);
    process.exit(1);
  }
}

module.exports = shell;
