// src/analyzer.ts
import path from 'path';
import fs from 'fs';
import glob from 'fast-glob';
import ignore from 'ignore';
import chalk from 'chalk';

export async function analyzeCodebase(projectPath: string) {
  // 1. Define file patterns and what to ignore
  const targetExtensions = ['ts', 'tsx'];
  const globPattern = `**/*.{${targetExtensions.join(',')}}`;

  // 2. Load and parse the .gitignore file
  const ig = ignore();
  const gitignorePath = path.join(projectPath, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    ig.add(fs.readFileSync(gitignorePath).toString());
  }
  // Add default ignores as a fallback
  ig.add([
    'node_modules',
    '.next',
    'dist',
    'build',
    '.vscode',
    '.github',
    '.sitecore',
    '.config',
    '.env',
    '.env.local',
  ]);

  // 3. Find all matching files using glob
  const allFiles = await glob(globPattern, {
    cwd: projectPath, // Search within the user's project directory
    absolute: true, // Get absolute paths for easier reading
    dot: true, // Include dotfiles if any (unlikely for src)
  });

  // 4. Filter out ignored files
  const relevantFiles = allFiles.filter(file => {
    const relativePath = path.relative(projectPath, file);
    return !ig.ignores(relativePath);
  });

  console.log(
    chalk.green(`✅ Found ${relevantFiles.length} relevant source files.`)
  );

  relevantFiles.forEach(file => {
    console.log(file);
  });

  // Next step: Read file contents and send for analysis
  // readAndAnalyzeFiles(relevantFiles);
}
