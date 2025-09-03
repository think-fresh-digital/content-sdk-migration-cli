#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { analyzeCodebase } from './analyser.js';

const program = new Command();

program
  .name('content-sdk-migration-cli')
  .description(
    'AI-powered CLI to accelerate the migration of Sitecore JSS Next.js apps to the Content SDK'
  )
  .version('0.1.0');

program
  .command('report')
  .description(
    'Analyse a local codebase and generate a Content SDK migration report'
  )
  .option('-p, --path <path>', 'Path to the root of the JSS project')
  .option('--apiKey <key>', 'API key for authentication', '')
  .option('-d, --debug', 'Enable debug mode', false)
  .option('-v, --verbose', 'Enable verbose output', false)
  .option('--whatIf', 'Run without making changes (dry run mode)', false)
  .option(
    '--serviceVersion <version>',
    'Service version to use (defaults to v1)',
    'v1'
  )
  .action(async options => {
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

      console.log(
        chalk.blue(`Starting analysis of codebase at: ${options.path}`)
      );

      await analyzeCodebase(
        options.path,
        options.apiKey,
        options.debug,
        options.verbose,
        options.whatIf,
        options.serviceVersion
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
  });

program.parse();
