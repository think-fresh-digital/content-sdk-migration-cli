import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { analyzeCodebase } from './analyser.js';

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
        undefined, // gitignore
        'gpt'
      );

      consoleSpy.mockRestore();
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
        undefined, // gitignore
        'gpt' // modelType
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
