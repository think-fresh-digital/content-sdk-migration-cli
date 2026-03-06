import path from 'path';
import fs from 'fs';
import glob from 'fast-glob';
import ignore from 'ignore';
import chalk from 'chalk';
import axios from 'axios';
import { setTimeout as delay } from 'timers/promises';
import { classifyFileType } from './lib/classifyFileType.js';
import { ServiceConfig } from './interfaces/configInterfaces';
import { buildServiceUrl } from './lib/buildServiceUrl.js';
import { getConfig } from './lib/getConfig.js';
import { Product } from './interfaces/migrationInterfaces.js';
import {
  JobInitiateRequest,
  JobInitiateResponse,
  JobEnqueueRequest,
  JobStatusResponse,
} from './interfaces/jobInterfaces.js';
import PQueue from 'p-queue';

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

// Allow a longer timeout for the finalise request, which can take a while server-side
const FINALISE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

const ENQUEUE_CONCURRENCY = 10;
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const MAX_POLL_ERRORS = 3;

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

/* v8 ignore start */
function sleep(ms: number): Promise<void> {
  return delay(ms).then(() => undefined);
}
/* v8 ignore end */

export async function analyzeCodebase(
  projectPath: string,
  apiKey: string,
  debug: boolean,
  verbose: boolean,
  whatIf: boolean,
  serviceVersion: string,
  product: Product,
  fromVersion: string,
  toVersion: string,
  gitignorePathOverride?: string,
  modelType: 'deepseek' | 'claude' | 'gpt' = 'deepseek'
) {
  // Display CLI version
  console.log(chalk.blue('Content SDK Migration CLI v1.0.2'));
  console.log(
    chalk.gray(
      'AI-powered CLI to accelerate the migration of Sitecore JSS Next.js apps to the Content SDK\n'
    )
  );

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
  // Determine which .gitignore to use: user-specified or project default
  const candidatePaths: string[] = [];
  if (gitignorePathOverride) {
    const absoluteOverride = path.isAbsolute(gitignorePathOverride)
      ? gitignorePathOverride
      : path.join(projectPath, gitignorePathOverride);
    candidatePaths.push(absoluteOverride);
  }
  candidatePaths.push(path.join(projectPath, '.gitignore'));

  let loadedGitignorePath: string | undefined;
  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      ig.add(fs.readFileSync(candidate, 'utf-8'));
      loadedGitignorePath = candidate;
      break;
    }
  }

  if (gitignorePathOverride && !loadedGitignorePath) {
    console.warn(
      chalk.bgYellow.black(
        `WARNING: --gitignore provided but not found: ${gitignorePathOverride}. Proceeding without it.`
      )
    );
  } else if (loadedGitignorePath && verbose) {
    console.log(chalk.gray(`Using .gitignore from: ${loadedGitignorePath}`));
  }
  // Add default ignores as a fallback
  ig.add([
    'node_modules',
    '.next',
    '.turbo',
    '.swc',
    '.sonarlint',
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
    '__tests__',
    '__mocks__',
    '__fixtures__',
    '__stories__',
    '__test-utils__',
    '__test-helpers__',
    '__test-utils__',
    '__data__',
    '*.stories.tsx',
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
    // Normalize to POSIX for ignore lib matching (handles Windows paths)
    const posixRelative = relativePath.split(path.sep).join('/');
    return !ig.ignores(posixRelative);
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

  await readAndAnalyzeFiles(
    projectPath,
    filteredFiles,
    config,
    modelType,
    product,
    fromVersion,
    toVersion
  );
}

async function readAndAnalyzeFiles(
  projectPath: string,
  filePaths: string[],
  config: ServiceConfig,
  modelType: 'deepseek' | 'claude' | 'gpt',
  product: Product,
  fromVersion: string,
  toVersion: string
) {
  try {
    // Track analysis start time
    const startTimeMs = Date.now();
    const totalFiles = filePaths.length;

    // 1. Start a new job, passing the file count so the backend knows when all files are enqueued
    console.log(chalk.blue('Initializing new analysis job...'));

    const jobRequest: JobInitiateRequest = {
      modelType,
      product,
      fromVersion,
      toVersion,
      filesEnqueued: totalFiles,
    };

    const jobResponse = await axios.post<JobInitiateResponse>(
      buildServiceUrl(config, 'jobs-initiate'),
      jobRequest,
      {
        headers: {
          'Ocp-Apim-Subscription-Key': config.SERVICE_KEY,
        },
      }
    );

    const { jobId } = jobResponse.data;

    console.log(chalk.gray(`Job ID: ${jobId}`));

    // 2. Enqueue files for cloud analysis
    console.log(
      chalk.blue(`Submitting ${totalFiles} files for cloud analysis...`)
    );

    const queue = new PQueue({ concurrency: ENQUEUE_CONCURRENCY });

    const enqueuePromises = filePaths.map(async filePath => {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const relativePath = path.relative(projectPath, filePath);
      const fileType = classifyFileType(relativePath);

      const payload: JobEnqueueRequest = {
        jobId,
        filePath: relativePath,
        fileType,
        fileContent,
      };

      await queue.add(async () => {
        const response = await axios.post(
          buildServiceUrl(config, 'jobs-enqueue'),
          payload,
          {
            headers: {
              'Ocp-Apim-Subscription-Key': config.SERVICE_KEY,
            },
          }
        );

        if (response.status < 200 || response.status >= 300) {
          throw new Error(
            `Failed to enqueue ${relativePath}: HTTP ${response.status}`
          );
        }
      });
    });

    await Promise.all(enqueuePromises);
    await queue.onIdle();

    console.log(
      chalk.blue('All files submitted for analysis. Waiting for results...')
    );

    // 3. Poll for completion
    const pollDeadline = Date.now() + POLL_TIMEOUT_MS;
    let pollErrorCount = 0;
    let readyToFinalise = false;

    while (!readyToFinalise) {
      if (Date.now() >= pollDeadline) {
        console.error(
          chalk.red(
            '\nAnalysis timed out after 30 minutes. The backend may still be processing — check your job status manually or contact support.'
          )
        );
        process.exit(1);
      }

      /* v8 ignore next */
      await sleep(POLL_INTERVAL_MS);

      let statusResponse;
      try {
        statusResponse = await axios.get<JobStatusResponse>(
          buildServiceUrl(config, `jobs/${jobId}/status`),
          {
            headers: {
              'Ocp-Apim-Subscription-Key': config.SERVICE_KEY,
            },
          }
        );
        pollErrorCount = 0;
      } catch (error) {
        pollErrorCount += 1;

        let errorDetail = 'Unknown error';
        if (axios.isAxiosError(error) && error.response) {
          errorDetail = `HTTP ${error.response.status}: ${error.response.statusText}`;
        } else if (error instanceof Error) {
          errorDetail = error.message;
        }

        console.log(
          chalk.yellow(
            `Polling error (${pollErrorCount}/${MAX_POLL_ERRORS}): ${errorDetail}`
          )
        );

        if (pollErrorCount >= MAX_POLL_ERRORS) {
          throw new Error(
            `Polling failed ${MAX_POLL_ERRORS} consecutive times. Last error: ${errorDetail}`
          );
        }

        continue;
      }

      const { percentComplete, readyToFinalise: isReady } = statusResponse.data;
      const completedFiles = Math.round((percentComplete / 100) * totalFiles);
      console.log(
        chalk.gray(
          `Analysing... ${percentComplete}% complete (${completedFiles}/${totalFiles} files)`
        )
      );

      if (isReady) {
        readyToFinalise = true;
      }
    }

    // 4. Finalize the job to get the report
    console.log(chalk.blue('Analysis complete. Generating report...'));

    const finalizeResponse = await axios.post(
      buildServiceUrl(config, `jobs/${jobId}/finalise`),
      undefined,
      {
        headers: {
          'Ocp-Apim-Subscription-Key': config.SERVICE_KEY,
        },
        // Long-running operation: increase timeout and do not wrap in retry logic
        timeout: FINALISE_TIMEOUT_MS,
      }
    );
    const { reportUrl, pdfUrl, llmPromptUrl } = finalizeResponse.data;

    // 5. Display the final report URL with elapsed time in minutes
    const elapsedMinutes = ((Date.now() - startTimeMs) / 60000).toFixed(2);
    console.log(
      chalk.bold.green(
        `\n🎉 Your migration analysis report is ready! (took ${elapsedMinutes} minutes)`
      )
    );
    console.log(chalk.bold.green('PDF URL:'));
    console.log(chalk.underline.cyan(pdfUrl));
    console.log(chalk.bold.green('Markdown URL:'));
    console.log(chalk.underline.cyan(reportUrl));
    console.log(chalk.bold.green('LLM Prompt URL:'));
    console.log(chalk.underline.cyan(llmPromptUrl));
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
      console.error(chalk.red(`Unknown error: ${String(error)}`));
    }

    // Re-throw the error so it can be handled by the calling function
    throw error;
  }
}
