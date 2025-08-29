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
  .argument('<path>', 'Path to the root of the JSS project')
  .action(async path => {
    console.log(chalk.blue(`🚀 Starting analysis of codebase at: ${path}`));
    await analyzeCodebase(path);
  });

program.parse();
