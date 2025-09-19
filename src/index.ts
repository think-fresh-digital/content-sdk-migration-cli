#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { analyzeCodebase } from './analyser.js';
import { DEFAULT_THROTTLE } from './lib/throttleDefaults.js';

const program = new Command();

program
  .name('content-sdk-migration-cli')
  .description(
    'AI-powered CLI to accelerate the migration of Sitecore JSS Next.js apps to the Content SDK'
  )
  .version('0.1.4-beta.2');

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
    '--maxConcurrent <number>',
    'Max in-flight requests',
    (value: string) => parseInt(value, 10),
    DEFAULT_THROTTLE.maxConcurrent
  )
  .option(
    '--intervalCap <number>',
    'Max requests per interval',
    (value: string) => parseInt(value, 10),
    DEFAULT_THROTTLE.intervalCap
  )
  .option(
    '--intervalMs <number>',
    'Interval window in ms',
    (value: string) => parseInt(value, 10),
    DEFAULT_THROTTLE.intervalMs
  )
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

      const defaultMaxConcurrent = DEFAULT_THROTTLE.maxConcurrent;
      const defaultIntervalCap = DEFAULT_THROTTLE.intervalCap;
      const defaultIntervalMs = DEFAULT_THROTTLE.intervalMs;

      // Warnings for unsafe overrides
      if (options.maxConcurrent > defaultMaxConcurrent) {
        console.warn(
          chalk.bgYellow.black(
            `WARNING: --maxConcurrent=${options.maxConcurrent} exceeds safe default (${defaultMaxConcurrent}). This can cause service timeouts.`
          )
        );
      }
      if (options.intervalMs < defaultIntervalMs) {
        console.warn(
          chalk.bgYellow.black(
            `WARNING: --intervalMs=${options.intervalMs} is below safe default (${defaultIntervalMs}). This increases rate-limit risk.`
          )
        );
      }
      if (options.intervalCap > defaultIntervalCap) {
        console.warn(
          chalk.bgYellow.black(
            `WARNING: --intervalCap=${options.intervalCap} exceeds safe default (${defaultIntervalCap}). This increases rate-limit risk.`
          )
        );
      }

      await analyzeCodebase(
        options.path,
        options.apiKey,
        options.debug,
        options.verbose,
        options.whatIf,
        options.serviceVersion,
        {
          maxConcurrent: options.maxConcurrent,
          intervalCap: options.intervalCap,
          intervalMs: options.intervalMs,
        },
        options.gitignore
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
