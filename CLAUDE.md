# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build          # Compile TypeScript to dist/ (excludes test files)
npm run test           # Run tests once
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Run tests with coverage (80% threshold enforced)
npm run lint           # Lint TypeScript files
npm run lint:fix       # Lint and auto-fix
npm run format         # Format with Prettier
npm run commit         # Commitizen-guided conventional commit
```

Run a single test file:

```bash
npx vitest run src/lib/classifyFileType.test.ts
```

## Architecture

This is an ESM TypeScript CLI (`"type": "module"`) that ships as a single `content-sdk-migrate` binary via `dist/index.js`.

**Entry point:** `src/index.ts` — registers the `report` command via Commander and exports `handleReportCommand` for testing (Commander's `parse()` is skipped in test environments).

**Core flow in `analyzeCodebase` (`src/analyser.ts`):**

1. Glob `**/*.{ts,tsx}` and `**/package.json` from the target project path
2. Filter via `ignore` (respects `.gitignore` + hardcoded defaults)
3. Classify each file using `classifyFileType` — only `Plugin`, `Middleware`, `Package`, `Component`, `Page`, `API Route`, `Config` types are sent to the backend
4. POST to `jobs-initiate` → get `jobId`
5. Enqueue files concurrently (concurrency: 10) via `jobs-enqueue`
6. Poll `jobs/{jobId}/status` every 3s (30 min timeout, 3 consecutive error tolerance)
7. POST `jobs/{jobId}/finalise` (10 min timeout) → receive `reportUrl`, `pdfUrl`, `llmPromptUrl`

**Service URL construction (`src/lib/buildServiceUrl.ts`):** Debug mode hits `localhost:7071/api/{route}`; production hits `https://api-think-fresh-digital.azure-api.net/content-sdk/{serviceVersion}/{route}?code={apiKey}`.

**Config (`src/lib/getConfig.ts`):** Thin wrapper that assembles `ServiceConfig` from CLI flags. Debug mode skips API key validation and routes to localhost.

**Migration options (`src/lib/migrationOptions.ts`):** `MIGRATION_RULES` defines the valid product/version combinations. The three products are `jss-to-jss`, `jss-to-content-sdk`, and `content-sdk-to-content-sdk`. If `--product`, `--fromVersion`, `--toVersion` are not all provided, the CLI prompts interactively via `promptMigrationOptions`.

**Key interfaces** (`src/interfaces/`):

- `migrationInterfaces.ts` — `Product` union type, `MigrationSelection`
- `jobInterfaces.ts` — request/response shapes for the backend job API
- `configInterfaces.ts` — `ServiceConfig`

**Build note:** `tsconfig.build.json` extends `tsconfig.json` and excludes `*.test.ts` files. The `dist/` output must have `.js` extensions on all imports (they are already written that way in source).

**Coverage:** 80% threshold on statements, branches, functions, and lines. The `sleep` function and some error paths are excluded with `/* v8 ignore */` comments.
