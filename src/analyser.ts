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
import PQueue from 'p-queue';
import { DEFAULT_THROTTLE } from './lib/throttleDefaults.js';

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

function sleep(ms: number): Promise<void> {
  return delay(ms).then(() => undefined);
}

function isTimeoutError(error: unknown): boolean {
  return (
    axios.isAxiosError(error) &&
    (error.code === 'ECONNABORTED' ||
      (typeof error.message === 'string' && error.message.includes('timeout')))
  );
}

function getRetryAfterMs(error: unknown): number | undefined {
  if (!axios.isAxiosError(error)) return undefined;
  const header = error.response?.headers?.['retry-after'];
  if (!header) return undefined;
  const asNumber = Number(header);
  if (!Number.isNaN(asNumber)) {
    return asNumber * 1000;
  }
  const asDate = Date.parse(header);
  if (!Number.isNaN(asDate)) {
    const delta = asDate - Date.now();
    return delta > 0 ? delta : 0;
  }
  return undefined;
}

async function withRetry<T>(
  operation: () => Promise<T>,
  options?: {
    retries?: number;
    minDelayMs?: number;
    maxDelayMs?: number;
    verbose?: boolean;
  }
): Promise<T> {
  const retries = options?.retries ?? 3;
  const minDelayMs = options?.minDelayMs ?? 1000;
  const maxDelayMs = options?.maxDelayMs ?? 8000;
  const verbose = options?.verbose ?? false;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const status = axios.isAxiosError(error)
        ? error.response?.status
        : undefined;
      const retryableStatus =
        status === 408 ||
        status === 429 ||
        (typeof status === 'number' && status >= 500);
      const retryable = isTimeoutError(error) || retryableStatus;

      if (attempt === retries || !retryable) {
        throw error;
      }

      const headerDelay = getRetryAfterMs(error);
      const expDelay = Math.min(maxDelayMs, minDelayMs * 2 ** (attempt - 1));
      const jitter = Math.floor(Math.random() * 250);
      const delayMs = headerDelay ?? expDelay + jitter;

      const reason = status
        ? `HTTP ${status}`
        : isTimeoutError(error)
          ? 'timeout'
          : 'error';
      if (verbose) {
        console.log(
          chalk.yellow(
            `Retrying request (attempt ${attempt + 1}/${retries}) after ${delayMs}ms due to ${reason}`
          )
        );
      }
      await sleep(delayMs);
    }
  }

  // Should never reach here
  throw new Error('unreachable');
}

export async function analyzeCodebase(
  projectPath: string,
  apiKey: string,
  debug: boolean,
  verbose: boolean,
  whatIf: boolean,
  serviceVersion: string,
  throttle?: { maxConcurrent: number; intervalCap: number; intervalMs: number },
  gitignorePathOverride?: string
) {
  // Display CLI version
  console.log(chalk.blue('Content SDK Migration CLI v0.1.4-beta.1'));
  console.log(
    chalk.gray(
      'AI-powered CLI to accelerate the migration of Sitecore JSS Next.js apps to the Content SDK\n'
    )
  );

  // Get configuration
  const config = getConfig(
    apiKey,
    debug,
    verbose,
    whatIf,
    serviceVersion,
    throttle
  );

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

    // 2. Send files for analysis with throttling
    console.log(
      chalk.blue(
        `Uploading ${filePaths.length} files for analysis (${FILE_TYPES_TO_ANALYZE.join(', ')})...`
      )
    );

    const totalFiles = filePaths.length;
    let completedCount = 0;
    const timedOutFiles: string[] = [];
    const failedFiles: Array<{ filePath: string; error: string }> = [];

    const concurrency =
      config.THROTTLE?.maxConcurrent ?? DEFAULT_THROTTLE.maxConcurrent;
    const intervalCap =
      config.THROTTLE?.intervalCap ?? DEFAULT_THROTTLE.intervalCap;
    const interval = config.THROTTLE?.intervalMs ?? DEFAULT_THROTTLE.intervalMs;

    const queue = new PQueue({
      concurrency,
      intervalCap,
      interval,
      carryoverConcurrencyCount: true,
      autoStart: true,
    });

    const analysisPromises = filePaths.map(async filePath => {
      const fileContents = fs.readFileSync(filePath, 'utf-8');
      const relativePath = path.relative(projectPath, filePath);
      const fileType = classifyFileType(relativePath);

      const payload = { filePath: relativePath, fileType, fileContents };

      try {
        await queue.add(() =>
          withRetry(
            () =>
              axios.post(
                buildServiceUrl(config, `jobs/${jobId}/analyse-file`),
                payload,
                {
                  headers: {
                    'Ocp-Apim-Subscription-Key': config.SERVICE_KEY,
                  },
                  timeout: DEFAULT_THROTTLE.timeoutMs,
                }
              ),
            {
              retries: 4,
              minDelayMs: 1000,
              maxDelayMs: 10000,
              verbose: config.VERBOSE,
            }
          )
        );

        completedCount += 1;
        const percent = Math.round((completedCount / totalFiles) * 100);
        console.log(
          chalk.gray(
            `${completedCount} of ${totalFiles} files analysed (${percent}%)`
          )
        );
      } catch (error: unknown) {
        // Handle different types of errors
        if (isTimeoutError(error)) {
          timedOutFiles.push(relativePath);
          return; // abandon this file without throwing
        }

        // For server errors, collect them but don't fail the entire process
        let errorMessage = 'Unknown error';
        if (axios.isAxiosError(error)) {
          if (error.response) {
            errorMessage = `HTTP ${error.response.status}: ${error.response.statusText}`;
            if (error.response.data) {
              errorMessage += ` - ${JSON.stringify(error.response.data)}`;
            }
          } else if (error.request) {
            errorMessage = 'Network error: No response received from server';
          } else {
            errorMessage = `Request error: ${error.message}`;
          }
        } else if (error instanceof Error) {
          errorMessage = error.message;
        } else {
          errorMessage = String(error);
        }

        failedFiles.push({ filePath: relativePath, error: errorMessage });
        return; // abandon this file without throwing
      }
    });

    // Wait for all file uploads to complete (timeouts are handled per promise)
    await Promise.all(analysisPromises);
    await queue.onIdle();

    if (timedOutFiles.length > 0) {
      console.log(
        chalk.yellow(
          `\nThe following ${timedOutFiles.length} file(s) timed out after ${Math.round(
            DEFAULT_THROTTLE.timeoutMs / 1000
          )}s and were not analysed:`
        )
      );
      timedOutFiles.forEach(fp => console.log(chalk.yellow(` - ${fp}`)));
    }

    if (failedFiles.length > 0) {
      console.log(
        chalk.red(
          `\nThe following ${failedFiles.length} file(s) failed during analysis:`
        )
      );
      failedFiles.forEach(({ filePath, error }) =>
        console.log(chalk.red(` - ${filePath}: ${error}`))
      );
    }

    const successfulFiles =
      totalFiles - timedOutFiles.length - failedFiles.length;
    console.log(
      chalk.green(
        `${successfulFiles} of ${totalFiles} files analyzed successfully.`
      )
    );

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
        // Long-running operation: increase timeout and do not wrap in retry logic
        timeout: FINALISE_TIMEOUT_MS,
      }
    );
    const { reportUrl, pdfUrl, llmPromptUrl } = finalizeResponse.data;

    // 4. Display the final report URL with elapsed time in minutes
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
      console.error(chalk.red(`Unknown esrror: ${String(error)}`));
    }

    // Re-throw the error so it can be handled by the calling function
    throw error;
  }
}
