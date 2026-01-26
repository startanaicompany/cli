/**
 * Pretty logging with colors and symbols
 */

const chalk = require('chalk');
const ora = require('ora');
const boxen = require('boxen');

/**
 * Log success message
 */
function success(message) {
  console.log(chalk.green('✓'), message);
}

/**
 * Log error message
 */
function error(message) {
  console.log(chalk.red('✗'), message);
}

/**
 * Log warning message
 */
function warn(message) {
  console.log(chalk.yellow('⚠'), message);
}

/**
 * Log info message
 */
function info(message) {
  console.log(chalk.blue('ℹ'), message);
}

/**
 * Log plain message
 */
function log(message) {
  console.log(message);
}

/**
 * Create a spinner
 */
function spinner(text) {
  return ora({
    text,
    color: 'cyan',
  });
}

/**
 * Log a boxed message
 */
function box(message, options = {}) {
  console.log(
    boxen(message, {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan',
      ...options,
    })
  );
}

/**
 * Log section header
 */
function section(title) {
  console.log('\n' + chalk.bold.cyan(title));
  console.log(chalk.gray('─'.repeat(title.length)));
}

/**
 * Log key-value pair
 */
function field(key, value) {
  console.log(chalk.gray(`  ${key}:`), chalk.white(value));
}

/**
 * Log newline
 */
function newline() {
  console.log('');
}

module.exports = {
  success,
  error,
  warn,
  info,
  log,
  spinner,
  box,
  section,
  field,
  newline,
  chalk,
};
