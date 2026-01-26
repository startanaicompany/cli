/**
 * Git command - Manage Git account connections (OAuth)
 */

const oauth = require('../lib/oauth');
const { isAuthenticated, getUser } = require('../lib/config');
const logger = require('../lib/logger');
const { table } = require('table');
const inquirer = require('inquirer');

/**
 * Connect Git account via OAuth
 */
async function connect(host) {
  try {
    // Check authentication
    if (!isAuthenticated()) {
      logger.error('Not logged in');
      logger.newline();
      logger.info('Run:');
      logger.log('  saac login -e <email> -k <api-key>');
      process.exit(1);
    }

    const user = getUser();
    let gitHost;

    if (!host) {
      // No argument - ask user which provider
      logger.section('Connect Git Account');
      logger.newline();

      const { choice } = await inquirer.prompt([
        {
          type: 'list',
          name: 'choice',
          message: 'Select Git provider:',
          choices: [
            { name: 'git.startanaicompany.com (Git StartanAICompany)', value: 'git.startanaicompany.com' },
            { name: 'github.com', value: 'github.com' },
            { name: 'gitlab.com', value: 'gitlab.com' },
            { name: 'Custom host', value: 'custom' },
          ],
        },
      ]);

      if (choice === 'custom') {
        const { customHost } = await inquirer.prompt([
          {
            type: 'input',
            name: 'customHost',
            message: 'Enter Git host domain:',
            validate: (input) => input.length > 0 || 'Host cannot be empty',
          },
        ]);
        gitHost = customHost;
      } else {
        gitHost = choice;
      }
    } else if (host.includes('git@') || host.includes('http')) {
      // Repository URL provided
      gitHost = oauth.extractGitHost(host);
    } else {
      // Host domain provided
      gitHost = host;
    }

    // Check if already connected
    const existing = await oauth.getConnection(gitHost, user.sessionToken || user.apiKey);
    if (existing) {
      logger.warn(`Already connected to ${gitHost}`);
      logger.newline();
      logger.field('Username', existing.gitUsername);
      logger.field('Provider', existing.providerType);
      logger.field('Expires', new Date(existing.expiresAt).toLocaleString());
      logger.newline();

      const { reconnect } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'reconnect',
          message: 'Do you want to reconnect?',
          default: false,
        },
      ]);

      if (!reconnect) {
        logger.info('Keeping existing connection');
        return;
      }

      // Revoke and reconnect
      await oauth.revokeConnection(gitHost, user.sessionToken || user.apiKey);
      logger.newline();
    }

    // Initiate OAuth flow
    const result = await oauth.connectGitAccount(gitHost, user.sessionToken || user.apiKey);

    logger.newline();
    logger.success('Git account connected successfully!');
    logger.newline();
    logger.info('You can now create applications without providing --git-token:');
    logger.log(`  saac create my-app -s myapp -r git@${gitHost}:${result.gitUsername}/repo.git`);

  } catch (error) {
    logger.error(error.message);
    process.exit(1);
  }
}

/**
 * List connected Git accounts
 */
async function list() {
  try {
    // Check authentication
    if (!isAuthenticated()) {
      logger.error('Not logged in');
      logger.newline();
      logger.info('Run:');
      logger.log('  saac login -e <email> -k <api-key>');
      process.exit(1);
    }

    const user = getUser();
    const spin = logger.spinner('Fetching Git connections...').start();

    try {
      const connections = await oauth.listConnections(user.sessionToken || user.apiKey);

      spin.succeed(`Found ${connections.length} connection(s)`);

      if (connections.length === 0) {
        logger.newline();
        logger.warn('No Git accounts connected');
        logger.newline();
        logger.info('Connect an account with:');
        logger.log('  saac git connect');
        logger.log('  saac git connect git.startanaicompany.com');
        logger.log('  saac git connect git@git.startanaicompany.com:user/repo.git');
        return;
      }

      logger.newline();

      // Build table data
      const data = [
        ['Git Host', 'Username', 'Provider', 'Expires', 'Last Used'],
      ];

      connections.forEach((conn) => {
        const expires = new Date(conn.expiresAt).toLocaleDateString();
        const lastUsed = conn.lastUsedAt
          ? new Date(conn.lastUsedAt).toLocaleDateString()
          : 'Never';

        data.push([
          conn.gitHost,
          conn.gitUsername,
          conn.providerType,
          expires,
          lastUsed,
        ]);
      });

      console.log(table(data, {
        header: {
          alignment: 'center',
          content: `Connected Git Accounts (${connections.length} total)`,
        },
      }));

      logger.info('Commands:');
      logger.log('  saac git connect <host>     Connect another account');
      logger.log('  saac git disconnect <host>  Disconnect account');

    } catch (error) {
      spin.fail('Failed to fetch connections');
      throw error;
    }

  } catch (error) {
    logger.error(error.response?.data?.message || error.message);
    process.exit(1);
  }
}

/**
 * Disconnect Git account
 */
async function disconnect(host) {
  try {
    // Check authentication
    if (!isAuthenticated()) {
      logger.error('Not logged in');
      logger.newline();
      logger.info('Run:');
      logger.log('  saac login -e <email> -k <api-key>');
      process.exit(1);
    }

    if (!host) {
      logger.error('Git host is required');
      logger.newline();
      logger.info('Usage:');
      logger.log('  saac git disconnect <host>');
      logger.newline();
      logger.info('Example:');
      logger.log('  saac git disconnect git.startanaicompany.com');
      logger.newline();
      logger.info('To see connected accounts:');
      logger.log('  saac git list');
      process.exit(1);
    }

    const user = getUser();
    const spin = logger.spinner(`Disconnecting from ${host}...`).start();

    try {
      await oauth.revokeConnection(host, user.sessionToken || user.apiKey);

      spin.succeed(`Disconnected from ${host}`);

      logger.newline();
      logger.info('To reconnect:');
      logger.log(`  saac git connect ${host}`);

    } catch (error) {
      spin.fail('Disconnect failed');

      if (error.response?.status === 404) {
        logger.newline();
        logger.error(`No connection found for ${host}`);
        logger.newline();
        logger.info('To see connected accounts:');
        logger.log('  saac git list');
      } else {
        throw error;
      }
      process.exit(1);
    }

  } catch (error) {
    logger.error(error.response?.data?.message || error.message);
    process.exit(1);
  }
}

module.exports = {
  connect,
  list,
  disconnect,
};
