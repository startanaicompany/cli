#!/usr/bin/env node

/**
 * SAAC CLI - StartAnAiCompany Official CLI
 * Deploy AI recruitment sites with ease
 */

const { program } = require('commander');
const chalk = require('chalk');
const pkg = require('../package.json');

// Import commands
const register = require('../src/commands/register');
const login = require('../src/commands/login');
const verify = require('../src/commands/verify');
const logout = require('../src/commands/logout');
const logoutAll = require('../src/commands/logoutAll');
const sessions = require('../src/commands/sessions');
const keys = require('../src/commands/keys');
const git = require('../src/commands/git');
const init = require('../src/commands/init');
const create = require('../src/commands/create');
const update = require('../src/commands/update');
const deploy = require('../src/commands/deploy');
const deployments = require('../src/commands/deployments');
const logs = require('../src/commands/logs');
const env = require('../src/commands/env');
const domain = require('../src/commands/domain');
const deleteCmd = require('../src/commands/delete');
const list = require('../src/commands/list');
const status = require('../src/commands/status');
const whoami = require('../src/commands/whoami');
const manual = require('../src/commands/manual');
const run = require('../src/commands/run');
const shell = require('../src/commands/shell');

// Configure CLI
program
  .name('saac')
  .description(chalk.cyan('Official CLI for StartAnAiCompany.com'))
  .version(pkg.version, '-v, --version', 'Output the current version')
  .helpOption('-h, --help', 'Display help for command')
  .addHelpText('after', `
${chalk.dim('For detailed documentation, visit:')}
  ${chalk.cyan('https://github.com/startanaicompany/cli')}

${chalk.dim('Or run:')}
  ${chalk.yellow('saac manual')}  ${chalk.dim('- Display full manual from GitHub')}
`);

// Authentication commands
program
  .command('register')
  .description('Register for a new account')
  .option('-e, --email <email>', 'Email address')
  .option('--git-username <username>', 'Git username (auto-detected if not provided)')
  .action(register);

program
  .command('login')
  .description('Login with existing account')
  .option('-e, --email <email>', 'Email address')
  .option('-k, --api-key <key>', 'API key (for fast login)')
  .option('--otp <code>', 'One-time password from email')
  .action(login);

program
  .command('verify <code>')
  .description('Verify email with verification code')
  .action(verify);

program
  .command('logout')
  .description('Logout from current device')
  .action(logout);

program
  .command('logout-all')
  .description('Logout from all devices (revoke all sessions)')
  .option('-y, --yes', 'Skip confirmation')
  .action(logoutAll);

program
  .command('sessions')
  .description('List all active sessions')
  .action(sessions);

// API Key management
const keysCommand = program
  .command('keys')
  .description('Manage API keys');

keysCommand
  .command('regenerate')
  .description('Generate a new API key (invalidates old one)')
  .action(keys.regenerate);

keysCommand
  .command('show')
  .alias('info')
  .description('Show API key information')
  .action(keys.show);

// Git OAuth commands
const gitCommand = program
  .command('git')
  .description('Manage Git account connections (OAuth)');

gitCommand
  .command('connect [host]')
  .description('Connect a Git account via OAuth')
  .action(git.connect);

gitCommand
  .command('list')
  .alias('ls')
  .description('List connected Git accounts')
  .action(git.list);

gitCommand
  .command('disconnect <host>')
  .description('Disconnect a Git account')
  .action(git.disconnect);

// Application management
program
  .command('init')
  .description('Initialize a new SAAC project in current directory')
  .option('-n, --name <name>', 'Application name')
  .option('-s, --subdomain <subdomain>', 'Subdomain')
  .option('-d, --domain-suffix <suffix>', 'Domain suffix', 'startanaicompany.com')
  .option('-r, --repository <url>', 'Git repository URL')
  .action(init);

program
  .command('create [name]')
  .description('Create a new application')
  // Required options
  .option('-s, --subdomain <subdomain>', 'Subdomain')
  .option('-r, --repository <url>', 'Git repository URL (SSH format)')
  // Basic options
  .option('-b, --branch <branch>', 'Git branch', 'master')
  .option('-d, --domain-suffix <suffix>', 'Domain suffix', 'startanaicompany.com')
  .option('-p, --port <port>', 'Port to expose (default: 3000)')
  // Build configuration
  .option('--build-pack <pack>', 'Build pack: dockercompose, nixpacks, dockerfile, static')
  .option('--install-cmd <command>', 'Install command')
  .option('--build-cmd <command>', 'Build command')
  .option('--start-cmd <command>', 'Start command')
  .option('--pre-deploy-cmd <command>', 'Pre-deployment command')
  .option('--post-deploy-cmd <command>', 'Post-deployment command')
  // Resource limits
  .option('--cpu-limit <limit>', 'CPU limit (e.g., "1", "2.5")')
  .option('--memory-limit <limit>', 'Memory limit (e.g., "512M", "2G")')
  // Health checks
  .option('--health-check', 'Enable health checks')
  .option('--health-path <path>', 'Health check path')
  .option('--health-interval <seconds>', 'Health check interval in seconds')
  .option('--health-timeout <seconds>', 'Health check timeout in seconds')
  .option('--health-retries <count>', 'Health check retries (1-10)')
  // Environment variables
  .option('--env <KEY=VALUE>', 'Environment variable (can be used multiple times)', (val, prev) => {
    return prev ? [...prev, val] : [val];
  }, [])
  .action(create);

program
  .command('update')
  .description('Update application configuration')
  // Basic options
  .option('-n, --name <name>', 'Application name')
  .option('-b, --branch <branch>', 'Git branch')
  .option('-p, --port <port>', 'Port to expose')
  // Build configuration
  .option('--build-pack <pack>', 'Build pack: dockercompose, nixpacks, dockerfile, static')
  .option('--install-cmd <command>', 'Install command')
  .option('--build-cmd <command>', 'Build command')
  .option('--start-cmd <command>', 'Start command')
  .option('--pre-deploy-cmd <command>', 'Pre-deployment command')
  .option('--post-deploy-cmd <command>', 'Post-deployment command')
  // Resource limits
  .option('--cpu-limit <limit>', 'CPU limit (e.g., "1", "2.5")')
  .option('--memory-limit <limit>', 'Memory limit (e.g., "512M", "2G")')
  // Health checks
  .option('--health-check', 'Enable health checks')
  .option('--no-health-check', 'Disable health checks')
  .option('--health-path <path>', 'Health check path')
  .option('--health-interval <seconds>', 'Health check interval in seconds')
  .option('--health-timeout <seconds>', 'Health check timeout in seconds')
  .option('--health-retries <count>', 'Health check retries (1-10)')
  // Restart policy
  .option('--restart <policy>', 'Restart policy: always, on-failure, unless-stopped, no')
  // Environment variables
  .option('--env <KEY=VALUE>', 'Environment variable (can be used multiple times)', (val, prev) => {
    return prev ? [...prev, val] : [val];
  }, [])
  .action(update);

program
  .command('deploy')
  .description('Deploy current application')
  .option('-f, --force', 'Force deployment')
  .action(deploy);

program
  .command('deployments')
  .alias('deploys')
  .description('List deployment history')
  .option('-l, --limit <number>', 'Number of deployments to show', '20')
  .option('-o, --offset <number>', 'Offset for pagination', '0')
  .action(deployments);

program
  .command('logs [deploymentUuid]')
  .description('View application logs (runtime or deployment logs)')
  .option('-d, --deployment [uuid]', 'View deployment logs (build logs)')
  .option('--raw', 'Show raw log output (deployment logs only)')
  .option('--include-hidden', 'Include hidden log lines (deployment logs only)')
  .option('-t, --tail <lines>', 'Number of lines to show (runtime logs only)', '100')
  .option('-f, --follow', 'Follow log output (runtime logs only)')
  .option('--since <time>', 'Show logs since timestamp (runtime logs only)')
  .action(logs);

// Local development commands
program
  .command('run <command>')
  .description('Run local command with remote environment variables')
  .option('--sync', 'Force refresh environment variables (skip cache)')
  .option('-q, --quiet', 'Quiet mode (suppress warnings)')
  .action(run);

program
  .command('shell')
  .description('Open interactive shell with remote environment variables')
  .option('--cmd <shell>', 'Shell to use (default: $SHELL or /bin/bash)')
  .option('--sync', 'Force refresh environment variables (skip cache)')
  .action(shell);

// Environment variable commands
const envCommand = program
  .command('env')
  .description('Manage environment variables');

envCommand
  .command('set <vars...>')
  .description('Set environment variables (KEY=VALUE format)')
  .action(env.set);

envCommand
  .command('get [key]')
  .description('Get environment variable(s)')
  .action(env.get);

envCommand
  .command('list')
  .alias('ls')
  .description('List all environment variables')
  .action(env.list);

// Domain management
const domainCommand = program
  .command('domain')
  .description('Manage application domain');

domainCommand
  .command('set <subdomain>')
  .description('Change subdomain')
  .option('-d, --domain-suffix <suffix>', 'Domain suffix', 'startanaicompany.com')
  .action(domain.set);

domainCommand
  .command('show')
  .description('Show current domain')
  .action(domain.show);

// Application info
program
  .command('list')
  .alias('ls')
  .description('List all your applications')
  .action(list);

program
  .command('status')
  .description('Show current application status')
  .action(status);

program
  .command('whoami')
  .description('Show current user information')
  .action(whoami);

// Documentation
program
  .command('manual')
  .description('Display full documentation from GitHub')
  .action(manual);

// Deletion
program
  .command('delete')
  .alias('rm')
  .description('Delete current application')
  .option('-y, --yes', 'Skip confirmation')
  .action(deleteCmd);

// Error handling
program.on('command:*', function () {
  console.error(chalk.red('\n  Invalid command: %s\n'), program.args.join(' '));
  console.log(chalk.yellow('  Run'), chalk.cyan('saac --help'), chalk.yellow('to see available commands'));
  process.exit(1);
});

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
