import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import glob from 'fast-glob';
import ignoreLib from 'ignore';
import axios from 'axios';
import PQueue from 'p-queue';
import { getConfig } from './lib/getConfig.js';
import { buildServiceUrl } from './lib/buildServiceUrl.js';
import { classifyFileType } from './lib/classifyFileType.js';

// Mock all external dependencies
vi.mock('fs');
vi.mock('fast-glob');
vi.mock('ignore');
vi.mock('axios');
vi.mock('p-queue');
vi.mock('./lib/getConfig.js');
vi.mock('./lib/buildServiceUrl.js');
vi.mock('./lib/classifyFileType.js');

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
    THROTTLE: undefined,
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
        analyzeCodebase(mockProjectPath, mockApiKey, false, false, false, 'v1')
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

      // Mock axios for job initiation
      vi.mocked(axios.get).mockResolvedValue({
        data: { jobId: 'test-job-id' },
      } as any);

      vi.mocked(axios.post).mockResolvedValue({
        data: {
          reportUrl: 'http://example.com/report',
          pdfUrl: 'http://example.com/report.pdf',
          llmPromptUrl: 'http://example.com/prompt',
        },
      } as any);

      // Mock PQueue
      const mockQueue = {
        add: vi.fn().mockResolvedValue(undefined),
        onIdle: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(PQueue).mockImplementation(() => mockQueue as any);

      await analyzeCodebase(
        mockProjectPath,
        mockApiKey,
        false,
        false,
        false,
        'v1'
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

      vi.mocked(axios.get).mockResolvedValue({
        data: { jobId: 'test-job-id' },
      } as any);

      vi.mocked(axios.post).mockResolvedValue({
        data: {
          reportUrl: 'http://example.com/report',
          pdfUrl: 'http://example.com/report.pdf',
          llmPromptUrl: 'http://example.com/prompt',
        },
      } as any);

      const mockQueue = {
        add: vi.fn().mockResolvedValue(undefined),
        onIdle: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(PQueue).mockImplementation(() => mockQueue as any);

      await analyzeCodebase(
        mockProjectPath,
        mockApiKey,
        false,
        false,
        false,
        'v1'
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

      vi.mocked(axios.get).mockResolvedValue({
        data: { jobId: 'test-job-id' },
      } as any);

      vi.mocked(axios.post).mockResolvedValue({
        data: {
          reportUrl: 'http://example.com/report',
          pdfUrl: 'http://example.com/report.pdf',
          llmPromptUrl: 'http://example.com/prompt',
        },
      } as any);

      const mockQueue = {
        add: vi.fn().mockResolvedValue(undefined),
        onIdle: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(PQueue).mockImplementation(() => mockQueue as any);

      await analyzeCodebase(
        mockProjectPath,
        mockApiKey,
        false,
        false,
        false,
        'v1'
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

      vi.mocked(axios.get).mockResolvedValue({
        data: { jobId: 'test-job-id' },
      } as any);

      vi.mocked(axios.post).mockResolvedValue({
        data: {
          reportUrl: 'http://example.com/report',
          pdfUrl: 'http://example.com/report.pdf',
          llmPromptUrl: 'http://example.com/prompt',
        },
      } as any);

      const mockQueue = {
        add: vi.fn().mockResolvedValue(undefined),
        onIdle: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(PQueue).mockImplementation(() => mockQueue as any);

      await analyzeCodebase(
        mockProjectPath,
        mockApiKey,
        false,
        false,
        false,
        'v1',
        undefined,
        '/custom/.gitignore'
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

      vi.mocked(axios.get).mockResolvedValue({
        data: { jobId: 'test-job-id' },
      } as any);

      vi.mocked(axios.post).mockResolvedValue({
        data: {
          reportUrl: 'http://example.com/report',
          pdfUrl: 'http://example.com/report.pdf',
          llmPromptUrl: 'http://example.com/prompt',
        },
      } as any);

      const mockQueue = {
        add: vi.fn().mockResolvedValue(undefined),
        onIdle: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(PQueue).mockImplementation(() => mockQueue as any);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await analyzeCodebase(
        mockProjectPath,
        mockApiKey,
        false,
        false,
        false,
        'v1',
        undefined,
        '/nonexistent/.gitignore'
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

      vi.mocked(axios.get).mockResolvedValue({
        data: { jobId: 'test-job-id' },
      } as any);

      vi.mocked(axios.post).mockResolvedValue({
        data: {
          reportUrl: 'http://example.com/report',
          pdfUrl: 'http://example.com/report.pdf',
          llmPromptUrl: 'http://example.com/prompt',
        },
      } as any);

      const mockQueue = {
        add: vi.fn().mockResolvedValue(undefined),
        onIdle: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(PQueue).mockImplementation(() => mockQueue as any);

      await analyzeCodebase(
        mockProjectPath,
        mockApiKey,
        false,
        false,
        false,
        'v1'
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
        'v1'
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

      vi.mocked(axios.get).mockResolvedValue({
        data: { jobId: 'test-job-id' },
      } as any);

      vi.mocked(axios.post).mockResolvedValue({
        data: {
          reportUrl: 'http://example.com/report',
          pdfUrl: 'http://example.com/report.pdf',
          llmPromptUrl: 'http://example.com/prompt',
        },
      } as any);

      const mockQueue = {
        add: vi.fn().mockResolvedValue(undefined),
        onIdle: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(PQueue).mockImplementation(() => mockQueue as any);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await analyzeCodebase(
        mockProjectPath,
        mockApiKey,
        false,
        true,
        false,
        'v1'
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Files queued for analysis')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Job initialization and file upload', () => {
    it('should initialize job and upload files', async () => {
      const mockFiles = ['/test/project/src/components/Button.tsx'];
      vi.mocked(glob).mockResolvedValue(mockFiles);

      const mockIgnore = {
        add: vi.fn(),
        ignores: vi.fn(() => false),
      };
      vi.mocked(ignoreLib).mockReturnValue(mockIgnore as any);

      vi.mocked(classifyFileType).mockReturnValue('Component');
      vi.mocked(buildServiceUrl).mockReturnValue(
        'http://localhost:7071/api/jobs-initiate'
      );

      vi.mocked(axios.get).mockResolvedValue({
        data: { jobId: 'test-job-id' },
      } as any);

      vi.mocked(axios.post).mockResolvedValue({
        data: {
          reportUrl: 'http://example.com/report',
          pdfUrl: 'http://example.com/report.pdf',
          llmPromptUrl: 'http://example.com/prompt',
        },
      } as any);

      const mockQueue = {
        add: vi.fn().mockResolvedValue(undefined),
        onIdle: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(PQueue).mockImplementation(() => mockQueue as any);

      await analyzeCodebase(
        mockProjectPath,
        mockApiKey,
        false,
        false,
        false,
        'v1'
      );

      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            'Ocp-Apim-Subscription-Key': mockApiKey,
          },
        })
      );

      expect(mockQueue.add).toHaveBeenCalled();
    });

    it('should finalize job and display report URLs', async () => {
      vi.mocked(glob).mockResolvedValue([]);

      const mockIgnore = {
        add: vi.fn(),
        ignores: vi.fn(() => false),
      };
      vi.mocked(ignoreLib).mockReturnValue(mockIgnore as any);

      vi.mocked(classifyFileType).mockReturnValue('Component');
      vi.mocked(buildServiceUrl).mockImplementation((config, route) => {
        if (route.includes('finalise')) {
          return 'http://localhost:7071/api/jobs/test-job-id/finalise';
        }
        return 'http://localhost:7071/api/jobs-initiate';
      });

      vi.mocked(axios.get).mockResolvedValue({
        data: { jobId: 'test-job-id' },
      } as any);

      vi.mocked(axios.post).mockResolvedValue({
        data: {
          reportUrl: 'http://example.com/report',
          pdfUrl: 'http://example.com/report.pdf',
          llmPromptUrl: 'http://example.com/prompt',
        },
      } as any);

      const mockQueue = {
        add: vi.fn().mockResolvedValue(undefined),
        onIdle: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(PQueue).mockImplementation(() => mockQueue as any);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await analyzeCodebase(
        mockProjectPath,
        mockApiKey,
        false,
        false,
        false,
        'v1'
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
      vi.mocked(axios.get).mockRejectedValue(error);

      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await expect(
        analyzeCodebase(mockProjectPath, mockApiKey, false, false, false, 'v1')
      ).rejects.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('An error occurred during the analysis process')
      );

      consoleSpy.mockRestore();
    });
  });
});
