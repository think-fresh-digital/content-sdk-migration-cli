import { describe, it, expect } from 'vitest';
import { buildServiceUrl } from './buildServiceUrl.js';
import { ServiceConfig } from '../interfaces/configInterfaces.js';

describe('buildServiceUrl', () => {
  describe('Debug mode', () => {
    it('should build URL with /api/ prefix in debug mode', () => {
      const config: ServiceConfig = {
        SERVICE_HOST: 'http://localhost:7071',
        SERVICE_KEY: 'test-key',
        DEBUG: true,
        VERBOSE: false,
        WHAT_IF: false,
      };

      expect(buildServiceUrl(config, 'jobs-initiate')).toBe(
        'http://localhost:7071/api/jobs-initiate'
      );
    });

    it('should handle route with leading slash in debug mode', () => {
      const config: ServiceConfig = {
        SERVICE_HOST: 'http://localhost:7071',
        SERVICE_KEY: 'test-key',
        DEBUG: true,
        VERBOSE: false,
        WHAT_IF: false,
      };

      expect(buildServiceUrl(config, '/jobs-initiate')).toBe(
        'http://localhost:7071/api/jobs-initiate'
      );
    });

    it('should handle nested routes in debug mode', () => {
      const config: ServiceConfig = {
        SERVICE_HOST: 'http://localhost:7071',
        SERVICE_KEY: 'test-key',
        DEBUG: true,
        VERBOSE: false,
        WHAT_IF: false,
      };

      expect(buildServiceUrl(config, 'jobs/123/analyse-file')).toBe(
        'http://localhost:7071/api/jobs/123/analyse-file'
      );
    });
  });

  describe('Production mode', () => {
    it('should build URL with API key query parameter in production mode', () => {
      const config: ServiceConfig = {
        SERVICE_HOST:
          'https://api-think-fresh-digital.azure-api.net/content-sdk/v1',
        SERVICE_KEY: 'test-api-key',
        DEBUG: false,
        VERBOSE: false,
        WHAT_IF: false,
      };

      const url = buildServiceUrl(config, 'jobs-initiate');
      expect(url).toBe(
        'https://api-think-fresh-digital.azure-api.net/content-sdk/v1/jobs-initiate?code=test-api-key'
      );
    });

    it('should handle route with leading slash in production mode', () => {
      const config: ServiceConfig = {
        SERVICE_HOST:
          'https://api-think-fresh-digital.azure-api.net/content-sdk/v1',
        SERVICE_KEY: 'test-api-key',
        DEBUG: false,
        VERBOSE: false,
        WHAT_IF: false,
      };

      const url = buildServiceUrl(config, '/jobs-initiate');
      expect(url).toBe(
        'https://api-think-fresh-digital.azure-api.net/content-sdk/v1/jobs-initiate?code=test-api-key'
      );
    });

    it('should handle nested routes in production mode', () => {
      const config: ServiceConfig = {
        SERVICE_HOST:
          'https://api-think-fresh-digital.azure-api.net/content-sdk/v1',
        SERVICE_KEY: 'test-api-key',
        DEBUG: false,
        VERBOSE: false,
        WHAT_IF: false,
      };

      const url = buildServiceUrl(config, 'jobs/123/finalise');
      expect(url).toBe(
        'https://api-think-fresh-digital.azure-api.net/content-sdk/v1/jobs/123/finalise?code=test-api-key'
      );
    });
  });

  describe('Base URL edge cases', () => {
    it('should handle base URL with trailing slash', () => {
      const config: ServiceConfig = {
        SERVICE_HOST: 'http://localhost:7071/',
        SERVICE_KEY: 'test-key',
        DEBUG: true,
        VERBOSE: false,
        WHAT_IF: false,
      };

      expect(buildServiceUrl(config, 'jobs-initiate')).toBe(
        'http://localhost:7071/api/jobs-initiate'
      );
    });

    it('should handle base URL with multiple trailing slashes', () => {
      const config: ServiceConfig = {
        SERVICE_HOST: 'http://localhost:7071///',
        SERVICE_KEY: 'test-key',
        DEBUG: true,
        VERBOSE: false,
        WHAT_IF: false,
      };

      expect(buildServiceUrl(config, 'jobs-initiate')).toBe(
        'http://localhost:7071/api/jobs-initiate'
      );
    });

    it('should handle route with trailing slash', () => {
      const config: ServiceConfig = {
        SERVICE_HOST: 'http://localhost:7071',
        SERVICE_KEY: 'test-key',
        DEBUG: true,
        VERBOSE: false,
        WHAT_IF: false,
      };

      expect(buildServiceUrl(config, 'jobs-initiate/')).toBe(
        'http://localhost:7071/api/jobs-initiate'
      );
    });
  });

  describe('Route normalization', () => {
    it('should normalize multiple leading slashes', () => {
      const config: ServiceConfig = {
        SERVICE_HOST: 'http://localhost:7071',
        SERVICE_KEY: 'test-key',
        DEBUG: true,
        VERBOSE: false,
        WHAT_IF: false,
      };

      expect(buildServiceUrl(config, '///jobs-initiate')).toBe(
        'http://localhost:7071/api/jobs-initiate'
      );
    });

    it('should handle empty route', () => {
      const config: ServiceConfig = {
        SERVICE_HOST: 'http://localhost:7071',
        SERVICE_KEY: 'test-key',
        DEBUG: true,
        VERBOSE: false,
        WHAT_IF: false,
      };

      expect(buildServiceUrl(config, '')).toBe('http://localhost:7071/api/');
    });
  });
});
