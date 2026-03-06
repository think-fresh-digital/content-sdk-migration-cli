import { describe, it, expect } from 'vitest';
import { getConfig } from './getConfig.js';

describe('getConfig', () => {
  describe('Debug mode', () => {
    it('should return debug configuration with localhost host', () => {
      const config = getConfig('test-key', true, false, false, 'v1');

      expect(config).toEqual({
        SERVICE_HOST: 'http://localhost:7071',
        SERVICE_KEY: 'test-key',
        DEBUG: true,
        VERBOSE: false,
        WHAT_IF: false,
      });
    });

    it('should handle verbose flag in debug mode', () => {
      const config = getConfig('test-key', true, true, false, 'v1');

      expect(config.VERBOSE).toBe(true);
      expect(config.DEBUG).toBe(true);
    });

    it('should handle whatIf flag in debug mode', () => {
      const config = getConfig('test-key', true, false, true, 'v1');

      expect(config.WHAT_IF).toBe(true);
      expect(config.DEBUG).toBe(true);
    });
  });

  describe('Production mode', () => {
    it('should return production configuration with API host', () => {
      const config = getConfig('prod-key', false, false, false, 'v1');

      expect(config).toEqual({
        SERVICE_HOST:
          'https://api-think-fresh-digital.azure-api.net/content-sdk/v1',
        SERVICE_KEY: 'prod-key',
        DEBUG: false,
        VERBOSE: false,
        WHAT_IF: false,
      });
    });

    it('should handle different service versions', () => {
      const configV1 = getConfig('key', false, false, false, 'v1');
      const configV2 = getConfig('key', false, false, false, 'v2');

      expect(configV1.SERVICE_HOST).toContain('/v1');
      expect(configV2.SERVICE_HOST).toContain('/v2');
    });

    it('should handle verbose flag in production mode', () => {
      const config = getConfig('prod-key', false, true, false, 'v1');

      expect(config.VERBOSE).toBe(true);
      expect(config.DEBUG).toBe(false);
    });

    it('should handle whatIf flag in production mode', () => {
      const config = getConfig('prod-key', false, false, true, 'v1');

      expect(config.WHAT_IF).toBe(true);
      expect(config.DEBUG).toBe(false);
    });
  });

  describe('API key handling', () => {
    it('should accept empty API key', () => {
      const config = getConfig('', true, false, false, 'v1');

      expect(config.SERVICE_KEY).toBe('');
    });

    it('should preserve API key value', () => {
      const apiKey = 'my-special-api-key-123';
      const config = getConfig(apiKey, false, false, false, 'v1');

      expect(config.SERVICE_KEY).toBe(apiKey);
    });
  });

  describe('Combined flags', () => {
    it('should handle all flags set to true', () => {
      const config = getConfig('key', true, true, true, 'v1');

      expect(config.DEBUG).toBe(true);
      expect(config.VERBOSE).toBe(true);
      expect(config.WHAT_IF).toBe(true);
    });

    it('should handle all flags set to false', () => {
      const config = getConfig('key', false, false, false, 'v1');

      expect(config.DEBUG).toBe(false);
      expect(config.VERBOSE).toBe(false);
      expect(config.WHAT_IF).toBe(false);
    });
  });
});
