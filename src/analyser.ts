import path from 'path';
import fs from 'fs';
import glob from 'fast-glob';
import ignore from 'ignore';
import chalk from 'chalk';
import axios from 'axios';
import { classifyFileType } from './lib/classifyFileType.js';
import { ServiceConfig } from './interfaces/configInterfaces';
import { buildServiceUrl } from './lib/buildServiceUrl.js';
import { getConfig } from './lib/getConfig.js';

// Central list of file types to include in analysis and in log messages
const FILE_TYPES_TO_ANALYZE: string[] = [
  'Plugin',
  'Middleware',
  'Package',
  'Component',
  'Page',
  'API Route',
  'Config',
];

function emojiForFileType(fileType: string): string {
  switch (fileType) {
    case 'Plugin':
      return '🔌';
    case 'Middleware':
      return '🧰';
    case 'Package':
      return '📦';
    case 'Component':
      return '🧩';
    case 'Page':
      return '📄';
    case 'API Route':
      return '🔀';
    case 'Config':
      return '⚙️';
    default:
      return '📄';
  }
}

export async function analyzeCodebase(
  projectPath: string,
  apiKey: string,
  debug: boolean,
  verbose: boolean,
  whatIf: boolean,
  serviceVersion: string
) {
  // Get configuration
  const config = getConfig(apiKey, debug, verbose, whatIf, serviceVersion);

  // Check if the project path exists
  if (!fs.existsSync(projectPath)) {
    throw new Error(`Project path does not exist: ${projectPath}`);
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
    dot: false,
  });

  const allFiles = [...sourceFiles, ...packageJsonFiles];

  // 4. Filter out ignored files
  const relevantFiles = allFiles.filter(file => {
    const relativePath = path.relative(projectPath, file);
    return !ig.ignores(relativePath);
  });

  // 5. Filter files to only include Plugin, Middleware, or Package types
  const filteredFiles = relevantFiles.filter(file => {
    const relativePath = path.relative(projectPath, file);
    const fileType = classifyFileType(relativePath);
    return FILE_TYPES_TO_ANALYZE.includes(fileType);
  });

  console.log(
    chalk.green(`Found ${relevantFiles.length} relevant source files.`)
  );
  console.log(
    chalk.blue(
      `Filtered to ${filteredFiles.length} files for analysis (${FILE_TYPES_TO_ANALYZE.join(', ')}).`
    )
  );

  if (config.VERBOSE) {
    console.log(chalk.gray('Files queued for analysis:'));
    filteredFiles.forEach(file => {
      const relativePath = path.relative(projectPath, file);
      const type = classifyFileType(relativePath);
      const emoji = emojiForFileType(type);
      console.log(`${emoji} ${relativePath}`);
    });
  }

  // Next step: Read file contents and send for analysis
  if (config.WHAT_IF) {
    console.log(
      chalk.yellow(
        'WHAT-IF mode enabled: Skipping backend analysis calls. No API requests will be made.'
      )
    );
    return;
  }

  await readAndAnalyzeFiles(projectPath, filteredFiles, config);
}

async function readAndAnalyzeFiles(
  projectPath: string,
  filePaths: string[],
  config: ServiceConfig
) {
  try {
    // Track analysis start time
    const startTimeMs = Date.now();
    // 1. Start a new job to get a jobId
    console.log(chalk.blue('Initializing new analysis job...'));

    const jobResponse = await axios.get(
      buildServiceUrl(config, 'jobs-initiate'),
      {
        headers: {
          'Ocp-Apim-Subscription-Key': config.SERVICE_KEY,
        },
      }
    );

    const { jobId } = jobResponse.data;

    console.log(chalk.gray(`Job ID: ${jobId}`));

    // 2. Send all files for analysis concurrently
    console.log(
      chalk.blue(
        `Uploading ${filePaths.length} files for analysis (${FILE_TYPES_TO_ANALYZE.join(', ')})...`
      )
    );

    const totalFiles = filePaths.length;
    let completedCount = 0;

    const analysisPromises = filePaths.map(async filePath => {
      const fileContents = fs.readFileSync(filePath, 'utf-8');
      const relativePath = path.relative(projectPath, filePath);
      const fileType = classifyFileType(relativePath);

      const payload = { filePath: relativePath, fileType, fileContents };

      return axios
        .post(buildServiceUrl(config, `jobs/${jobId}/analyse-file`), payload, {
          headers: {
            'Ocp-Apim-Subscription-Key': config.SERVICE_KEY,
          },
        })
        .then(() => {
          completedCount += 1;
          const percent = Math.round((completedCount / totalFiles) * 100);
          console.log(
            chalk.gray(
              `${completedCount} of ${totalFiles} files analysed (${percent}%)`
            )
          );
        });
    });

    // Wait for all file uploads to complete
    await Promise.all(analysisPromises);

    console.log(chalk.green('All files analyzed successfully.'));

    // 3. Finalize the job to get the report
    console.log(chalk.blue('Finalising job and generating report...'));

    // This will be updated when the finalise endpoint is implemented
    const finalizeResponse = await axios.post(
      buildServiceUrl(config, `jobs/${jobId}/finalise`),
      undefined,
      {
        headers: {
          'Ocp-Apim-Subscription-Key': config.SERVICE_KEY,
        },
      }
    );
    const { reportUrl } = finalizeResponse.data;

    // 4. Display the final report URL with elapsed time in minutes
    const elapsedMinutes = ((Date.now() - startTimeMs) / 60000).toFixed(2);
    console.log(
      chalk.bold.green(
        `\n🎉 Your migration analysis report is ready! (took ${elapsedMinutes} minutes)`
      )
    );

    console.log(chalk.underline.cyan(reportUrl));
  } catch (error) {
    console.error(
      chalk.red('\nAn error occurred during the analysis process.')
    );

    // Log detailed error information
    if (axios.isAxiosError(error)) {
      if (error.response) {
        // Server responded with error status
        console.error(
          chalk.red(
            `HTTP Error [${error.response.status}]: ${error.response.statusText}`
          )
        );
        console.error(
          chalk.red(
            `Response data: ${JSON.stringify(error.response.data, null, 2)}`
          )
        );
        console.error(chalk.red(`Request URL: ${error.config?.url}`));
      } else if (error.request) {
        // Request was made but no response received
        console.error(
          chalk.red('Network Error: No response received from server')
        );
        console.error(chalk.red(`Request URL: ${error.config?.url}`));
        console.error(chalk.red(`Request method: ${error.config?.method}`));
      } else {
        // Something else happened
        console.error(chalk.red(`Request Error: ${error.message}`));
      }
    } else if (error instanceof Error) {
      console.error(chalk.red(`Error: ${error.message}`));
      console.error(chalk.red(`Stack trace: ${error.stack}`));
    } else {
      console.error(chalk.red(`Unknown esrror: ${String(error)}`));
    }

    // Re-throw the error so it can be handled by the calling function
    throw error;
  }
}
