import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import glob from 'fast-glob';
import ignoreLib from 'ignore';
import axios from 'axios';
import { getConfig } from './lib/getConfig.js';
import { buildServiceUrl } from './lib/buildServiceUrl.js';
import { classifyFileType } from './lib/classifyFileType.js';

// Mock all external dependencies
vi.mock('fs');
vi.mock('fast-glob');
vi.mock('ignore');
vi.mock('axios');
vi.mock('./lib/getConfig.js');
vi.mock('./lib/buildServiceUrl.js');
vi.mock('./lib/classifyFileType.js');

// Make sleep() resolve immediately so polling tests don't block
vi.mock('timers/promises', () => ({
  setTimeout: () => Promise.resolve(),
}));

// Import after mocks
import { analyzeCodebase } from './analyser.js';

describe('analyzeCodebase', () => {
  const mockProjectPath = '/test/project';
  const mockApiKey = 'test-api-key';
  const mockConfig = {
    SERVICE_HOST: 'http://localhost:7071',
    SERVICE_KEY: mockApiKey,
    DEBUG: true,
    VERBOSE: false,
    WHAT_IF: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getConfig).mockReturnValue(mockConfig);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('file content');
    vi.mocked(glob).mockResolvedValue([]);
    vi.mocked(ignoreLib).mockReturnValue({
      add: vi.fn(),
      ignores: vi.fn(() => false),
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Project path validation', () => {
    it('should throw error if project path does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(
        analyzeCodebase(
          mockProjectPath,
          mockApiKey,
          false,
          false,
          false,
          'v1',
          'jss-to-jss',
          '22.5',
          '22.6'
        )
      ).rejects.toThrow('Project path does not exist');
    });
  });

  describe('File discovery', () => {
    it('should discover TypeScript and TSX files', async () => {
      const mockFiles = [
        '/test/project/src/components/Button.tsx',
        '/test/project/src/utils.ts',
      ];
      vi.mocked(glob).mockResolvedValue(mockFiles);

      const mockIgnore = {
        add: vi.fn(),
        ignores: vi.fn(() => false),
      };
      vi.mocked(ignoreLib).mockReturnValue(mockIgnore as any);

      vi.mocked(classifyFileType).mockReturnValue('Component');

      vi.mocked(axios.post).mockResolvedValue({
        data: { jobId: 'test-job-id' },
        status: 202,
      } as any);

      vi.mocked(axios.get).mockResolvedValue({
        data: { percentComplete: 100, readyToFinalise: true },
        status: 200,
      } as any);

      await analyzeCodebase(
        mockProjectPath,
        mockApiKey,
        false,
        false,
        false,
        'v1',
        'jss-to-jss',
        '22.5',
        '22.6',
        undefined,
        'gpt'
      );

      expect(glob).toHaveBeenCalledWith(
        '**/*.{ts,tsx}',
        expect.objectContaining({
          cwd: mockProjectPath,
          absolute: true,
          dot: true,
        })
      );
    });

    it('should discover package.json files', async () => {
      vi.mocked(glob).mockResolvedValue([]);

      const mockIgnore = {
        add: vi.fn(),
        ignores: vi.fn(() => false),
      };
      vi.mocked(ignoreLib).mockReturnValue(mockIgnore as any);

      vi.mocked(classifyFileType).mockReturnValue('Package');

      vi.mocked(axios.post).mockResolvedValue({
        data: { jobId: 'test-job-id' },
        status: 202,
      } as any);

      vi.mocked(axios.get).mockResolvedValue({
        data: { percentComplete: 100, readyToFinalise: true },
        status: 200,
      } as any);

      await analyzeCodebase(
        mockProjectPath,
        mockApiKey,
        false,
        false,
        false,
        'v1',
        'jss-to-jss',
        '22.5',
        '22.6',
        undefined,
        'gpt'
      );

      expect(glob).toHaveBeenCalledWith(
        '**/package.json',
        expect.objectContaining({
          cwd: mockProjectPath,
          absolute: true,
          dot: false,
        })
      );
    });
  });

  describe('Gitignore handling', () => {
    it('should load default .gitignore from project root', async () => {
      vi.mocked(glob).mockResolvedValue([]);
      // Use path.join to match what the actual code does
      const pathModule = await import('path');
      const gitignorePath = pathModule.default.join(
        mockProjectPath,
        '.gitignore'
      );
      vi.mocked(fs.existsSync).mockImplementation((filePath: string) => {
        if (filePath === mockProjectPath) return true;
        if (
          filePath === gitignorePath ||
          filePath === '/test/project/.gitignore' ||
          filePath === '\\test\\project\\.gitignore'
        )
          return true;
        return false;
      });
      vi.mocked(fs.readFileSync).mockReturnValue('node_modules\n');

      const mockIgnore = {
        add: vi.fn(),
        ignores: vi.fn(() => false),
      };
      vi.mocked(ignoreLib).mockReturnValue(mockIgnore as any);

      vi.mocked(classifyFileType).mockReturnValue('Component');

      vi.mocked(axios.post).mockResolvedValue({
        data: { jobId: 'test-job-id' },
        status: 202,
      } as any);

      vi.mocked(axios.get).mockResolvedValue({
        data: { percentComplete: 100, readyToFinalise: true },
        status: 200,
      } as any);

      await analyzeCodebase(
        mockProjectPath,
        mockApiKey,
        false,
        false,
        false,
        'v1',
        'jss-to-jss',
        '22.5',
        '22.6'
      );

      // Check that readFileSync was called with the gitignore path (handle both Unix and Windows paths)
      expect(fs.readFileSync).toHaveBeenCalled();
      const calls = vi.mocked(fs.readFileSync).mock.calls;
      const gitignoreCall = calls.find(
        call =>
          call[0] === '/test/project/.gitignore' ||
          call[0] === '\\test\\project\\.gitignore' ||
          call[0]?.toString().endsWith('.gitignore')
      );
      expect(gitignoreCall).toBeDefined();
      expect(gitignoreCall?.[1]).toBe('utf-8');
    });

    it('should use custom gitignore path when provided', async () => {
      vi.mocked(glob).mockResolvedValue([]);
      vi.mocked(fs.existsSync).mockImplementation(path => {
        if (path === mockProjectPath) return true;
        if (path === '/custom/.gitignore') return true;
        return false;
      });

      const mockIgnore = {
        add: vi.fn(),
        ignores: vi.fn(() => false),
      };
      vi.mocked(ignoreLib).mockReturnValue(mockIgnore as any);

      vi.mocked(classifyFileType).mockReturnValue('Component');

      vi.mocked(axios.post).mockResolvedValue({
        data: { jobId: 'test-job-id' },
        status: 202,
      } as any);

      vi.mocked(axios.get).mockResolvedValue({
        data: { percentComplete: 100, readyToFinalise: true },
        status: 200,
      } as any);

      await analyzeCodebase(
        mockProjectPath,
        mockApiKey,
        false,
        false,
        false,
        'v1',
        'jss-to-jss',
        '22.5',
        '22.6',
        '/custom/.gitignore',
        'gpt'
      );

      expect(fs.readFileSync).toHaveBeenCalledWith(
        '/custom/.gitignore',
        'utf-8'
      );
    });

    it('should warn when custom gitignore path does not exist', async () => {
      vi.mocked(glob).mockResolvedValue([]);
      vi.mocked(fs.existsSync).mockImplementation(path => {
        if (path === mockProjectPath) return true;
        return false;
      });

      const mockIgnore = {
        add: vi.fn(),
        ignores: vi.fn(() => false),
      };
      vi.mocked(ignoreLib).mockReturnValue(mockIgnore as any);

      vi.mocked(classifyFileType).mockReturnValue('Component');

      vi.mocked(axios.post).mockResolvedValue({
        data: { jobId: 'test-job-id' },
        status: 202,
      } as any);

      vi.mocked(axios.get).mockResolvedValue({
        data: { percentComplete: 100, readyToFinalise: true },
        status: 200,
      } as any);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await analyzeCodebase(
        mockProjectPath,
        mockApiKey,
        false,
        false,
        false,
        'v1',
        'jss-to-jss',
        '22.5',
        '22.6',
        '/nonexistent/.gitignore',
        'gpt'
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('WARNING: --gitignore provided but not found')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('File filtering', () => {
    it('should filter files by type', async () => {
      const mockFiles = [
        '/test/project/src/components/Button.tsx',
        '/test/project/src/utils.ts',
        '/test/project/package.json',
      ];
      vi.mocked(glob).mockResolvedValue(mockFiles);

      const mockIgnore = {
        add: vi.fn(),
        ignores: vi.fn(() => false),
      };
      vi.mocked(ignoreLib).mockReturnValue(mockIgnore as any);

      vi.mocked(classifyFileType).mockImplementation(path => {
        if (path.includes('Button.tsx')) return 'Component';
        if (path.includes('package.json')) return 'Package';
        return 'Module';
      });

      vi.mocked(axios.post).mockResolvedValue({
        data: { jobId: 'test-job-id' },
        status: 202,
      } as any);

      vi.mocked(axios.get).mockResolvedValue({
        data: { percentComplete: 100, readyToFinalise: true },
        status: 200,
      } as any);

      await analyzeCodebase(
        mockProjectPath,
        mockApiKey,
        false,
        false,
        false,
        'v1',
        'jss-to-jss',
        '22.5',
        '22.6',
        undefined,
        'gpt'
      );

      // Should filter out 'Module' type files
      expect(classifyFileType).toHaveBeenCalled();
    });
  });

  describe('whatIf mode', () => {
    it('should skip API calls in whatIf mode', async () => {
      vi.mocked(glob).mockResolvedValue([]);

      const mockIgnore = {
        add: vi.fn(),
        ignores: vi.fn(() => false),
      };
      vi.mocked(ignoreLib).mockReturnValue(mockIgnore as any);

      const whatIfConfig = { ...mockConfig, WHAT_IF: true };
      vi.mocked(getConfig).mockReturnValue(whatIfConfig);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await analyzeCodebase(
        mockProjectPath,
        mockApiKey,
        false,
        false,
        true,
        'v1',
        'jss-to-jss',
        '22.5',
        '22.6',
        undefined,
        'gpt'
      );

      expect(axios.get).not.toHaveBeenCalled();
      expect(axios.post).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('WHAT-IF mode enabled')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Verbose mode', () => {
    it('should log file details in verbose mode', async () => {
      const mockFiles = ['/test/project/src/components/Button.tsx'];
      vi.mocked(glob).mockResolvedValue(mockFiles);

      const mockIgnore = {
        add: vi.fn(),
        ignores: vi.fn(() => false),
      };
      vi.mocked(ignoreLib).mockReturnValue(mockIgnore as any);

      vi.mocked(classifyFileType).mockReturnValue('Component');

      const verboseConfig = { ...mockConfig, VERBOSE: true };
      vi.mocked(getConfig).mockReturnValue(verboseConfig);

      vi.mocked(axios.post).mockResolvedValue({
        data: { jobId: 'test-job-id' },
        status: 202,
      } as any);

      vi.mocked(axios.get).mockResolvedValue({
        data: { percentComplete: 100, readyToFinalise: true },
        status: 200,
      } as any);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await analyzeCodebase(
        mockProjectPath,
        mockApiKey,
        false,
        true,
        false,
        'v1',
        'jss-to-jss',
        '22.5',
        '22.6',
        undefined,
        'gpt'
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Files queued for analysis')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Job initialization and file enqueue', () => {
    it('should initialize job with filesEnqueued count', async () => {
      const mockFiles = ['/test/project/src/components/Button.tsx'];
      // First glob call returns the .ts/tsx files, second (package.json) returns nothing
      vi.mocked(glob)
        .mockResolvedValueOnce(mockFiles)
        .mockResolvedValueOnce([]);

      const mockIgnore = {
        add: vi.fn(),
        ignores: vi.fn(() => false),
      };
      vi.mocked(ignoreLib).mockReturnValue(mockIgnore as any);

      vi.mocked(classifyFileType).mockReturnValue('Component');
      vi.mocked(buildServiceUrl).mockImplementation((_config, route) => {
        if (route === 'jobs-initiate')
          return 'http://localhost:7071/api/jobs-initiate';
        if (route === 'jobs-enqueue')
          return 'http://localhost:7071/api/jobs-enqueue';
        return `http://localhost:7071/api/${route}`;
      });

      vi.mocked(axios.post).mockResolvedValue({
        data: { jobId: 'test-job-id' },
        status: 202,
      } as any);

      vi.mocked(axios.get).mockResolvedValue({
        data: { percentComplete: 100, readyToFinalise: true },
        status: 200,
      } as any);

      await analyzeCodebase(
        mockProjectPath,
        mockApiKey,
        false,
        false,
        false,
        'v1',
        'jss-to-jss',
        '22.5',
        '22.6',
        undefined,
        'gpt'
      );

      // jobs-initiate call should include filesEnqueued (1 ts/tsx file, 0 package.json)
      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          modelType: 'gpt',
          product: 'jss-to-jss',
          fromVersion: '22.5',
          toVersion: '22.6',
          filesEnqueued: 1,
        }),
        expect.objectContaining({
          headers: {
            'Ocp-Apim-Subscription-Key': mockApiKey,
          },
        })
      );
    });

    it('should enqueue files via jobs-enqueue with correct payload', async () => {
      const mockFiles = ['/test/project/src/components/Button.tsx'];
      vi.mocked(glob).mockResolvedValue(mockFiles);

      const mockIgnore = {
        add: vi.fn(),
        ignores: vi.fn(() => false),
      };
      vi.mocked(ignoreLib).mockReturnValue(mockIgnore as any);

      vi.mocked(classifyFileType).mockReturnValue('Component');
      vi.mocked(buildServiceUrl).mockImplementation((_config, route) => {
        if (route === 'jobs-initiate')
          return 'http://localhost:7071/api/jobs-initiate';
        if (route === 'jobs-enqueue')
          return 'http://localhost:7071/api/jobs-enqueue';
        return `http://localhost:7071/api/${route}`;
      });

      // First call returns jobId, subsequent calls (enqueue) return 202
      vi.mocked(axios.post)
        .mockResolvedValueOnce({
          data: { jobId: 'test-job-id' },
          status: 200,
        } as any)
        .mockResolvedValue({
          data: {},
          status: 202,
        } as any);

      vi.mocked(axios.get).mockResolvedValue({
        data: { percentComplete: 100, readyToFinalise: true },
        status: 200,
      } as any);

      await analyzeCodebase(
        mockProjectPath,
        mockApiKey,
        false,
        false,
        false,
        'v1',
        'jss-to-jss',
        '22.5',
        '22.6',
        undefined,
        'gpt'
      );

      // enqueue call should use jobs-enqueue endpoint with jobId in body
      expect(axios.post).toHaveBeenCalledWith(
        'http://localhost:7071/api/jobs-enqueue',
        expect.objectContaining({
          jobId: 'test-job-id',
          fileType: 'Component',
          fileContent: 'file content',
        }),
        expect.objectContaining({
          headers: { 'Ocp-Apim-Subscription-Key': mockApiKey },
        })
      );
    });

    it('should finalise job and display report URLs', async () => {
      vi.mocked(glob).mockResolvedValue([]);

      const mockIgnore = {
        add: vi.fn(),
        ignores: vi.fn(() => false),
      };
      vi.mocked(ignoreLib).mockReturnValue(mockIgnore as any);

      vi.mocked(classifyFileType).mockReturnValue('Component');
      vi.mocked(buildServiceUrl).mockImplementation((_config, route) => {
        if (route.includes('finalise')) {
          return 'http://localhost:7071/api/jobs/test-job-id/finalise';
        }
        return 'http://localhost:7071/api/jobs-initiate';
      });

      vi.mocked(axios.post)
        .mockResolvedValueOnce({
          data: { jobId: 'test-job-id' },
          status: 200,
        } as any)
        .mockResolvedValue({
          data: {
            reportUrl: 'http://example.com/report',
            pdfUrl: 'http://example.com/report.pdf',
            llmPromptUrl: 'http://example.com/prompt',
          },
          status: 200,
        } as any);

      vi.mocked(axios.get).mockResolvedValue({
        data: { percentComplete: 100, readyToFinalise: true },
        status: 200,
      } as any);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await analyzeCodebase(
        mockProjectPath,
        mockApiKey,
        false,
        false,
        false,
        'v1',
        'jss-to-jss',
        '22.5',
        '22.6'
      );

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('finalise'),
        undefined,
        expect.objectContaining({
          headers: {
            'Ocp-Apim-Subscription-Key': mockApiKey,
          },
          timeout: 10 * 60 * 1000,
        })
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Your migration analysis report is ready')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Polling loop', () => {
    it('should poll status and display progress until readyToFinalise', async () => {
      vi.mocked(glob).mockResolvedValue([]);

      const mockIgnore = {
        add: vi.fn(),
        ignores: vi.fn(() => false),
      };
      vi.mocked(ignoreLib).mockReturnValue(mockIgnore as any);

      vi.mocked(axios.post)
        .mockResolvedValueOnce({
          data: { jobId: 'test-job-id' },
          status: 200,
        } as any)
        .mockResolvedValue({
          data: {
            reportUrl: 'http://example.com/report',
            pdfUrl: 'http://example.com/report.pdf',
            llmPromptUrl: 'http://example.com/prompt',
          },
          status: 200,
        } as any);

      // First poll returns not ready, second returns ready
      vi.mocked(axios.get)
        .mockResolvedValueOnce({
          data: { percentComplete: 50, readyToFinalise: false },
          status: 200,
        } as any)
        .mockResolvedValueOnce({
          data: { percentComplete: 100, readyToFinalise: true },
          status: 200,
        } as any);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await analyzeCodebase(
        mockProjectPath,
        mockApiKey,
        false,
        false,
        false,
        'v1',
        'jss-to-jss',
        '22.5',
        '22.6'
      );

      expect(axios.get).toHaveBeenCalledTimes(2);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('50% complete')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('100% complete')
      );

      consoleSpy.mockRestore();
    });

    it('should abort after 3 consecutive polling errors', async () => {
      vi.mocked(glob).mockResolvedValue([]);

      const mockIgnore = {
        add: vi.fn(),
        ignores: vi.fn(() => false),
      };
      vi.mocked(ignoreLib).mockReturnValue(mockIgnore as any);

      vi.mocked(axios.post).mockResolvedValue({
        data: { jobId: 'test-job-id' },
        status: 200,
      } as any);

      // All poll calls fail
      vi.mocked(axios.get).mockRejectedValue(new Error('Network failure'));

      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      await expect(
        analyzeCodebase(
          mockProjectPath,
          mockApiKey,
          false,
          false,
          false,
          'v1',
          'jss-to-jss',
          '22.5',
          '22.6'
        )
      ).rejects.toThrow('Polling failed 3 consecutive times');

      consoleSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });
  });

  describe('Error handling', () => {
    it('should handle job initialization errors', async () => {
      vi.mocked(glob).mockResolvedValue([]);

      const mockIgnore = {
        add: vi.fn(),
        ignores: vi.fn(() => false),
      };
      vi.mocked(ignoreLib).mockReturnValue(mockIgnore as any);

      vi.mocked(classifyFileType).mockReturnValue('Component');

      const error = new Error('Network error');
      vi.mocked(axios.post).mockRejectedValue(error);

      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await expect(
        analyzeCodebase(
          mockProjectPath,
          mockApiKey,
          false,
          false,
          false,
          'v1',
          'jss-to-jss',
          '22.5',
          '22.6'
        )
      ).rejects.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('An error occurred during the analysis process')
      );

      consoleSpy.mockRestore();
    });
  });
});
