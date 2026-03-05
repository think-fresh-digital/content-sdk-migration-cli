import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { analyzeCodebase } from './analyser.js';
import { DEFAULT_THROTTLE } from './lib/throttleDefaults.js';

// Mock the analyser module
vi.mock('./analyser.js', () => ({
  analyzeCodebase: vi.fn(),
}));

// Mock migration selection resolver to avoid interactive prompts
const mockMigrationSelection = {
  product: 'jss-to-jss',
  fromVersion: '22.5',
  toVersion: '22.6',
};

vi.mock('./lib/promptMigrationOptions.js', () => ({
  resolveMigrationSelection: vi.fn(() =>
    Promise.resolve(mockMigrationSelection)
  ),
}));

// Mock chalk to avoid color output in tests
vi.mock('chalk', () => ({
  default: {
    red: vi.fn((str: string) => str),
    blue: vi.fn((str: string) => str),
    yellow: vi.fn((str: string) => str),
    bgYellow: {
      black: vi.fn((str: string) => str),
    },
    green: vi.fn((str: string) => str),
    gray: vi.fn((str: string) => str),
    bold: {
      green: vi.fn((str: string) => str),
    },
    underline: {
      cyan: vi.fn((str: string) => str),
    },
  },
}));

// Import after mocks
import { handleReportCommand } from './index.js';

describe('CLI Entry Point', () => {
  let originalExit: typeof process.exit;
  let originalError: typeof console.error;
  let originalWarn: typeof console.warn;
  let originalLog: typeof console.log;

  beforeEach(() => {
    originalExit = process.exit;
    originalError = console.error;
    originalWarn = console.warn;
    originalLog = console.log;
    vi.clearAllMocks();
    vi.mocked(analyzeCodebase).mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.exit = originalExit;
    console.error = originalError;
    console.warn = originalWarn;
    console.log = originalLog;
    vi.restoreAllMocks();
  });

  describe('Required parameter validation', () => {
    it('should exit with error when path is missing', async () => {
      const mockExit = vi.fn() as any;
      process.exit = mockExit;
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await handleReportCommand({
        path: undefined,
        apiKey: 'test-key',
        debug: false,
        verbose: false,
        whatIf: false,
        maxConcurrent: DEFAULT_THROTTLE.maxConcurrent,
        intervalCap: DEFAULT_THROTTLE.intervalCap,
        intervalMs: DEFAULT_THROTTLE.intervalMs,
        serviceVersion: 'v1',
        modelType: 'gpt',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Path is required. Use --path <path> to specify the project directory.'
      );
      expect(mockExit).toHaveBeenCalledWith(1);

      consoleSpy.mockRestore();
    });

    it('should exit with error when apiKey is missing and not in debug mode', async () => {
      const mockExit = vi.fn() as any;
      process.exit = mockExit;
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await handleReportCommand({
        path: '/test/path',
        apiKey: '',
        debug: false,
        verbose: false,
        whatIf: false,
        maxConcurrent: DEFAULT_THROTTLE.maxConcurrent,
        intervalCap: DEFAULT_THROTTLE.intervalCap,
        intervalMs: DEFAULT_THROTTLE.intervalMs,
        serviceVersion: 'v1',
        modelType: 'gpt',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'API key is required. Use --apiKey <key> to specify the API key. Or use --debug to run in debug mode.'
      );
      expect(mockExit).toHaveBeenCalledWith(1);

      consoleSpy.mockRestore();
    });

    it('should not require apiKey when debug mode is enabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await handleReportCommand({
        path: '/test/path',
        apiKey: '',
        debug: true,
        verbose: false,
        whatIf: false,
        maxConcurrent: DEFAULT_THROTTLE.maxConcurrent,
        intervalCap: DEFAULT_THROTTLE.intervalCap,
        intervalMs: DEFAULT_THROTTLE.intervalMs,
        serviceVersion: 'v1',
        modelType: 'gpt',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Starting analysis of codebase at: /test/path'
      );
      expect(analyzeCodebase).toHaveBeenCalledWith(
        '/test/path',
        '',
        true, // debug
        false, // verbose
        false, // whatIf
        'v1',
        mockMigrationSelection.product,
        mockMigrationSelection.fromVersion,
        mockMigrationSelection.toVersion,
        expect.objectContaining({
          maxConcurrent: DEFAULT_THROTTLE.maxConcurrent,
          intervalCap: DEFAULT_THROTTLE.intervalCap,
          intervalMs: DEFAULT_THROTTLE.intervalMs,
        }),
        undefined,
        'gpt'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Throttle warning messages', () => {
    it('should warn when maxConcurrent exceeds default', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      const unsafeValue = DEFAULT_THROTTLE.maxConcurrent + 1;
      await handleReportCommand({
        path: '/test/path',
        apiKey: 'test-key',
        debug: false,
        verbose: false,
        whatIf: false,
        maxConcurrent: unsafeValue,
        intervalCap: DEFAULT_THROTTLE.intervalCap,
        intervalMs: DEFAULT_THROTTLE.intervalMs,
        serviceVersion: 'v1',
        modelType: 'gpt',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `WARNING: --maxConcurrent=${unsafeValue} exceeds safe default`
        )
      );

      consoleSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('should warn when intervalMs is below default', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      const unsafeValue = DEFAULT_THROTTLE.intervalMs - 1;
      await handleReportCommand({
        path: '/test/path',
        apiKey: 'test-key',
        debug: false,
        verbose: false,
        whatIf: false,
        maxConcurrent: DEFAULT_THROTTLE.maxConcurrent,
        intervalCap: DEFAULT_THROTTLE.intervalCap,
        intervalMs: unsafeValue,
        serviceVersion: 'v1',
        modelType: 'gpt',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `WARNING: --intervalMs=${unsafeValue} is below safe default`
        )
      );

      consoleSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('should warn when intervalCap exceeds default', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      const unsafeValue = DEFAULT_THROTTLE.intervalCap + 1;
      await handleReportCommand({
        path: '/test/path',
        apiKey: 'test-key',
        debug: false,
        verbose: false,
        whatIf: false,
        maxConcurrent: DEFAULT_THROTTLE.maxConcurrent,
        intervalCap: unsafeValue,
        intervalMs: DEFAULT_THROTTLE.intervalMs,
        serviceVersion: 'v1',
        modelType: 'gpt',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `WARNING: --intervalCap=${unsafeValue} exceeds safe default`
        )
      );

      consoleSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });
  });

  describe('Command execution', () => {
    it('should call analyzeCodebase with correct parameters', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await handleReportCommand({
        path: '/test/path',
        apiKey: 'test-api-key',
        debug: false,
        verbose: true,
        whatIf: false,
        maxConcurrent: DEFAULT_THROTTLE.maxConcurrent,
        intervalCap: DEFAULT_THROTTLE.intervalCap,
        intervalMs: DEFAULT_THROTTLE.intervalMs,
        serviceVersion: 'v2',
        modelType: 'gpt',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Starting analysis of codebase at: /test/path'
      );
      expect(analyzeCodebase).toHaveBeenCalledWith(
        '/test/path',
        'test-api-key',
        false, // debug
        true, // verbose
        false, // whatIf
        'v2', // serviceVersion
        mockMigrationSelection.product,
        mockMigrationSelection.fromVersion,
        mockMigrationSelection.toVersion,
        expect.objectContaining({
          maxConcurrent: DEFAULT_THROTTLE.maxConcurrent,
          intervalCap: DEFAULT_THROTTLE.intervalCap,
          intervalMs: DEFAULT_THROTTLE.intervalMs,
        }),
        undefined, // gitignore
        'gpt' // modelType
      );

      consoleSpy.mockRestore();
    });

    it('should pass throttle options correctly', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await handleReportCommand({
        path: '/test/path',
        apiKey: 'test-api-key',
        debug: false,
        verbose: false,
        whatIf: false,
        maxConcurrent: 4,
        intervalCap: 8,
        intervalMs: 1000,
        serviceVersion: 'v1',
        modelType: 'gpt',
      });

      expect(analyzeCodebase).toHaveBeenCalledWith(
        '/test/path',
        'test-api-key',
        false,
        false,
        false,
        'v1',
        mockMigrationSelection.product,
        mockMigrationSelection.fromVersion,
        mockMigrationSelection.toVersion,
        {
          maxConcurrent: 4,
          intervalCap: 8,
          intervalMs: 1000,
        },
        undefined,
        'gpt'
      );

      consoleSpy.mockRestore();
    });

    it('should pass gitignore option when provided', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await handleReportCommand({
        path: '/test/path',
        apiKey: 'test-api-key',
        debug: false,
        verbose: false,
        whatIf: false,
        maxConcurrent: DEFAULT_THROTTLE.maxConcurrent,
        intervalCap: DEFAULT_THROTTLE.intervalCap,
        intervalMs: DEFAULT_THROTTLE.intervalMs,
        serviceVersion: 'v1',
        gitignore: '/custom/.gitignore',
        modelType: 'gpt',
      });

      expect(analyzeCodebase).toHaveBeenCalledWith(
        '/test/path',
        'test-api-key',
        false,
        false,
        false,
        'v1',
        mockMigrationSelection.product,
        mockMigrationSelection.fromVersion,
        mockMigrationSelection.toVersion,
        expect.any(Object),
        '/custom/.gitignore',
        'gpt'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Error handling', () => {
    it('should handle errors from analyzeCodebase', async () => {
      const error = new Error('Test error');
      vi.mocked(analyzeCodebase).mockRejectedValue(error);

      const mockExit = vi.fn() as any;
      process.exit = mockExit;
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await handleReportCommand({
        path: '/test/path',
        apiKey: 'test-key',
        debug: false,
        verbose: false,
        whatIf: false,
        maxConcurrent: DEFAULT_THROTTLE.maxConcurrent,
        intervalCap: DEFAULT_THROTTLE.intervalCap,
        intervalMs: DEFAULT_THROTTLE.intervalMs,
        serviceVersion: 'v1',
        modelType: 'gpt',
      });

      expect(consoleSpy).toHaveBeenCalledWith('\nAnalysis failed:');
      expect(consoleSpy).toHaveBeenCalledWith('Error: Test error');
      expect(mockExit).toHaveBeenCalledWith(1);

      consoleSpy.mockRestore();
    });
  });
});
