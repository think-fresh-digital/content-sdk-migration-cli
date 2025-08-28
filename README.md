# content-sdk-migration-cli

AI-powered CLI to accelerate the migration of Sitecore JSS Next.js apps to the Content SDK.

## Development

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
