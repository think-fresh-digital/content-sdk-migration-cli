#!/usr/bin/env node

// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();

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
  .argument('<path>', 'Path to the root of the JSS project')
  .action(async path => {
    try {
      console.log(chalk.blue(`🚀 Starting analysis of codebase at: ${path}`));
      await analyzeCodebase(path);
    } catch (error) {
      console.error(chalk.red('\n❌ Analysis failed:'));
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
