# Publishing Guide for @startanaicompany/cli

## Prerequisites

1. **npm account** created
2. **Organization @startanaicompany** created on npm
3. Logged in to npm: `npm login`

## Publishing Steps

### 1. First Time Setup

```bash
cd ~/projects/saac-cli

# Login to npm
npm login

# Test the package locally first
npm link

# Test the CLI
saac --help
saac register --help
```

### 2. Publish to npm

```bash
# Make sure everything is committed
git status

# Publish as public package
npm publish --access public
```

### 3. Verify Publication

```bash
# Check on npm
open https://www.npmjs.com/package/@startanaicompany/cli

# Test global installation
npm install -g @startanaicompany/cli

# Test it works
saac --help
```

## Updating the Package

```bash
# Update version in package.json
npm version patch  # or minor, or major

# Publish update
npm publish
```

## Version Numbers

- **patch** (1.0.0 → 1.0.1): Bug fixes
- **minor** (1.0.0 → 1.1.0): New features (backwards compatible)
- **major** (1.0.0 → 2.0.0): Breaking changes

## Current Status

- ✅ Package structure created
- ✅ Core commands implemented (register, login, verify, deploy)
- ✅ Beautiful CLI with colors and spinners
- ✅ Configuration management
- ✅ API client
- ✅ Comprehensive README
- ⏳ Ready to publish!

## Testing Before Publishing

```bash
# Link locally
npm link

# Test all commands
saac --help
saac register
saac login
saac deploy

# Unlink when done
npm unlink -g @startanaicompany/cli
```

## Post-Publishing

After publishing, users can install with:

```bash
npm install -g @startanaicompany/cli
```

Then use:

```bash
saac register
saac create my-site
saac deploy
```

Perfect! 🚀
