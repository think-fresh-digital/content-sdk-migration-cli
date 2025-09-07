# content-sdk-migration-cli

AI-powered CLI to accelerate the migration of Sitecore JSS Next.js apps to the Content SDK.

## Installation

Use whichever approach you prefer:

1. Global install

```bash
npm i -g @think-fresh-digital/content-sdk-migrate
content-sdk-migrate --help
```

2. Run with npx (no install)

```bash
npx @think-fresh-digital/content-sdk-migrate --help
```

3. Project local install (e.g., CI)

```bash
npm i -D @think-fresh-digital/content-sdk-migrate
npx content-sdk-migrate --help
```

## Usage

Generate a migration report by analyzing a local JSS Next.js project:

```bash
content-sdk-migrate report --path <path-to-jss-project> --apiKey <api-key>
```

Common examples:

```bash
# Analyze current directory with verbose output
content-sdk-migrate report --path . --apiKey <api-key> --verbose

# Dry run (no backend/API calls) – useful for testing file discovery
content-sdk-migrate report --path . --whatIf

# Use local debug service (no API key required when --debug is used)
content-sdk-migrate report --path . --debug

# Tune request throttling
content-sdk-migrate report \
  --path . \
  --apiKey <api-key> \
  --maxConcurrent 8 \
  --intervalCap 16 \
  --intervalMs 1000
```

### Options

- `-p, --path <path>`: Path to the root of the JSS project (required)
- `--apiKey <key>`: API key for authentication (required unless `--debug`)
- `-d, --debug`: Use local debug service (`http://localhost:7071`)
- `-v, --verbose`: Verbose logging
- `--whatIf`: Skip backend calls; discover and list files only
- `--serviceVersion <version>`: Service version to use (default: `v1`)
- `--maxConcurrent <number>`: Max in-flight requests (default safe value is used)
- `--intervalCap <number>`: Max requests per interval window (default safe value is used)
- `--intervalMs <number>`: Interval window in milliseconds (default safe value is used)

Note: The CLI warns when throttle overrides are potentially unsafe.

### Passing the API key via environment variables

```powershell
# PowerShell
$env:API_KEY = "<your-api-key>"
content-sdk-migrate report --path . --apiKey $env:API_KEY
```

```bash
# bash/zsh
export API_KEY="<your-api-key>"
content-sdk-migrate report --path . --apiKey "$API_KEY"
```

## Development

### Run locally (from source)

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run the CLI directly
node dist/index.js report --path . --apiKey <api-key>

# (Optional) Link the CLI to use the global command name locally
npm link
content-sdk-migrate --help
```

### Code Quality

This project uses ESLint and Prettier for code quality and formatting:

```bash
# Check for linting issues
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Format code with Prettier
npm run format

# Check if code is properly formatted
npm run format:check
```

### Conventional Commits

This project follows the [Conventional Commits](https://www.conventionalcommits.org/) specification. All commit messages must follow this format:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

#### Commit Types

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (white-space, formatting, etc)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `build`: Changes that affect the build system or external dependencies
- `ci`: Changes to CI configuration files and scripts
- `chore`: Other changes that don't modify src or test files
- `revert`: Reverts a previous commit

#### Making Commits

Use the interactive commit tool:

```bash
# Stage your changes
git add .

# Create a conventional commit
npm run commit
```

This will guide you through creating a properly formatted commit message.

#### Commit Validation

All commits are automatically validated using commitlint. Invalid commit messages will be rejected.
