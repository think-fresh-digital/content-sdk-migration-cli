#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { analyzeCodebase } from './analyser.js';
import { resolveMigrationSelection } from './lib/promptMigrationOptions.js';

const program = new Command();

program
  .name('content-sdk-migration-cli')
  .description(
    'AI-powered CLI to accelerate the migration of Sitecore JSS Next.js apps to the SitecoreAI Content SDK'
  )
  .version('1.0.3');

// Export the handler function for testing
export async function handleReportCommand(options: {
  path?: string;
  gitignore?: string;
  apiKey: string;
  debug: boolean;
  verbose: boolean;
  whatIf: boolean;
  serviceVersion: string;
  modelType: 'deepseek' | 'claude' | 'gpt' | 'auto';
  product?: string;
  fromVersion?: string;
  toVersion?: string;
}) {
  try {
    if (!options.path) {
      console.error(
        chalk.red(
          'Path is required. Use --path <path> to specify the project directory.'
        )
      );
      process.exit(1);
    }

    if (options.apiKey === '' && !options.debug) {
      console.error(
        chalk.red(
          'API key is required. Use --apiKey <key> to specify the API key. Or use --debug to run in debug mode.'
        )
      );
      process.exit(1);
    }

    // Validate modelType
    const validModelTypes = ['deepseek', 'claude', 'gpt', 'auto'];
    if (!validModelTypes.includes(options.modelType)) {
      console.error(
        chalk.red(
          `Invalid modelType: ${options.modelType}. Must be one of: ${validModelTypes.join(', ')}`
        )
      );
      process.exit(1);
    }

    console.log(
      chalk.blue(`Starting analysis of codebase at: ${options.path}`)
    );

    const migrationSelection = await resolveMigrationSelection({
      product: options.product,
      fromVersion: options.fromVersion,
      toVersion: options.toVersion,
    });

    await analyzeCodebase(
      options.path,
      options.apiKey,
      options.debug,
      options.verbose,
      options.whatIf,
      options.serviceVersion,
      migrationSelection.product,
      migrationSelection.fromVersion,
      migrationSelection.toVersion,
      options.gitignore,
      options.modelType as 'deepseek' | 'claude' | 'gpt' | 'auto'
    );
  } catch (error) {
    console.error(chalk.red('\nAnalysis failed:'));
    if (error instanceof Error) {
      console.error(chalk.red(`Error: ${error.message}`));
      if (process.env.NODE_ENV === 'development') {
        console.error(chalk.red(`Stack trace: ${error.stack}`));
      }
    } else {
      console.error(chalk.red(`Unknown error: ${String(error)}`));
    }
    process.exit(1);
  }
}

program
  .command('report')
  .description(
    'Analyse a local codebase and generate a Content SDK migration report'
  )
  .option('-p, --path <path>', 'Path to the root of the JSS project')
  .option('--gitignore <path>', 'Path to a .gitignore file to apply')
  .option('--apiKey <key>', 'API key for authentication', '')
  .option('-d, --debug', 'Enable debug mode', false)
  .option('-v, --verbose', 'Enable verbose output', false)
  .option('--whatIf', 'Run without making changes (dry run mode)', false)
  .option(
    '--product <product>',
    'Migration product: jss-to-jss | jss-to-content-sdk | content-sdk-to-content-sdk'
  )
  .option(
    '--fromVersion <version>',
    'Source version for selected product (e.g. 22.5, 22.8, 1.3.1)'
  )
  .option(
    '--toVersion <version>',
    'Target version for selected product and fromVersion (e.g. 22.6, 1.4.1)'
  )
  .option(
    '--serviceVersion <version>',
    'Service version to use (defaults to v1)',
    'v1'
  )
  .option(
    '--modelType <type>',
    'Model type to use: deepseek, claude, gpt, or auto (defaults to deepseek)',
    'deepseek'
  )
  .action(handleReportCommand);

// Only parse if not in test environment
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  program.parse();
}
