#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';

const program = new Command();

program
  .name('content-sdk-migration-cli')
  .description(
    'AI-powered CLI to accelerate the migration of Sitecore JSS Next.js apps to the Content SDK'
  )
  .version('0.1.0');

program
  .command('analyse')
  .description('Analyse a local codebase')
  .action(() => {
    console.log(chalk.green('Starting analysis...'));
    // TODO: Implement analysis logic
  });

program.parse();
