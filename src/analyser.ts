import path from 'path';
import fs from 'fs';
import glob from 'fast-glob';
import ignore from 'ignore';
import chalk from 'chalk';
import axios from 'axios';

// --- Configuration ---
// The URL for the deployed backend service. Use an environment variable for this.
const SERVICE_HOST = process.env.SERVICE_HOST || 'http://localhost:7071';
const INITIALISE_JOB_SERVICE_KEY = process.env.INITIALISE_JOB_SERVICE_KEY;
const ANALYSE_FILE_SERVICE_KEY = process.env.ANALYSE_FILE_SERVICE_KEY;
const FINALISE_JOB_SERVICE_KEY = process.env.FINALISE_JOB_SERVICE_KEY;

export async function analyzeCodebase(projectPath: string) {
  // Check if SERVICE_HOST is not localhost and any service keys are missing
  if (SERVICE_HOST !== 'http://localhost:7071') {
    const missingKeys: string[] = [];
    if (!INITIALISE_JOB_SERVICE_KEY)
      missingKeys.push('INITIALISE_JOB_SERVICE_KEY');
    if (!ANALYSE_FILE_SERVICE_KEY) missingKeys.push('ANALYSE_FILE_SERVICE_KEY');
    if (!FINALISE_JOB_SERVICE_KEY) missingKeys.push('FINALISE_JOB_SERVICE_KEY');

    if (missingKeys.length > 0) {
      throw new Error(
        `Service keys are required when not using localhost. Missing keys: ${missingKeys.join(', ')}`
      );
    }
  }

  // 1. Define file patterns and what to ignore
  const targetExtensions = ['ts', 'tsx'];
  const globPattern = `**/*.{${targetExtensions.join(',')}}`;
  // Add specific pattern for package.json files
  const packageJsonPattern = '**/package.json';
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
    'local-containers',
    'spa-starters',
    'byoc',
    'feaas',
    'temp',
    'api',
    'next-env.d.ts',
    'generate-component-builder',
    'scaffold-component',
    'sitemap-fetcher',
    'site-resolver',
    'extract-path',
  ]);
  // 3. Find all matching files using glob
  const sourceFiles = await glob(globPattern, {
    cwd: projectPath, // Search within the user's project directory
    absolute: true, // Get absolute paths for easier reading
    dot: true, // Include dotfiles if any (unlikely for src)
  });
  const packageJsonFiles = await glob(packageJsonPattern, {
    cwd: projectPath,
    absolute: true,
    dot: true,
  });
  const allFiles = [...sourceFiles, ...packageJsonFiles];
  // 4. Filter out ignored files
  const relevantFiles = allFiles.filter(file => {
    const relativePath = path.relative(projectPath, file);
    return !ig.ignores(relativePath);
  });
  console.log(
    chalk.green(`✅ Found ${relevantFiles.length} relevant source files.`)
  );

  // Next step: Read file contents and send for analysis
  readAndAnalyzeFiles(projectPath, relevantFiles);
}

/**
 * Reads each file and sends it to the backend for analysis.
 */
async function readAndAnalyzeFiles(projectPath: string, filePaths: string[]) {
  try {
    // 1. Start a new job to get a jobId
    console.log(chalk.blue('🚀 Initializing new analysis job...'));
    const jobResponse = await axios.get(
      `${SERVICE_HOST}/api/jobs-initiate?code=${INITIALISE_JOB_SERVICE_KEY}`
    );
    const { jobId } = jobResponse.data;
    console.log(chalk.gray(`Job ID: ${jobId}`));

    // 2. Send all files for analysis concurrently
    console.log(
      chalk.blue(`📡 Uploading ${filePaths.length} files for analysis...`)
    );
    const analysisPromises = filePaths.map(async filePath => {
      const fileContents = fs.readFileSync(filePath, 'utf-8');
      const relativePath = path.relative(projectPath, filePath);
      const fileType = classifyFileType(relativePath);

      const payload = { filePath: relativePath, fileType, fileContents };

      return axios.post(
        `${SERVICE_HOST}/api/jobs/${jobId}/analyse-file?code=${ANALYSE_FILE_SERVICE_KEY}`,
        payload
      );
    });

    // Wait for all file uploads to complete
    await Promise.all(analysisPromises);
    console.log(chalk.green('✅ All files analyzed successfully.'));

    // 3. Finalize the job to get the report
    console.log(chalk.blue('📝 Finalising job and generating report...'));

    // This will be updated when the finalise endpoint is implemented
    /*const finalizeResponse = await axios.post(
      `${SERVICE_HOST}/api/jobs/${jobId}/finalise?code=${FINALISE_JOB_SERVICE_KEY}`
    );
    const { reportUrl } = finalizeResponse.data;*/

    // 4. Display the final report URL
    console.log(
      chalk.bold.green('\n🎉 Your migration analysis report is ready!')
    );

    // TODO: Add the report URL here
    //console.log(chalk.underline.cyan(reportUrl));
  } catch (error) {
    console.error(
      chalk.red('\n❌ An error occurred during the analysis process.')
    );
    if (axios.isAxiosError(error) && error.response) {
      console.error(
        chalk.red(
          `[${error.response.status}] ${JSON.stringify(error.response.data)}`
        )
      );
    } else if (error instanceof Error) {
      console.error(chalk.red(error.message));
    }
  }
}

/**
 * A simple classifier to determine the file's role based on its path.
 */
function classifyFileType(filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase(); // Normalize for Windows paths and make case insensitive

  if (normalizedPath.includes('/components/')) return 'Component';
  if (normalizedPath.includes('/middleware/plugins')) return 'Middleware';
  if (normalizedPath.includes('/pages/api/')) return 'API Route';
  if (normalizedPath.includes('/page-props-factory/plugins/')) return 'Plugin';

  return 'Module';
}
