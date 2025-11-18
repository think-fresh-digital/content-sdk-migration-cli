import { describe, it, expect } from 'vitest';
import { classifyFileType } from './classifyFileType.js';

describe('classifyFileType', () => {
  describe('Page types', () => {
    it('should classify bootstrap.tsx as Page', () => {
      expect(classifyFileType('bootstrap.tsx')).toBe('Page');
    });

    it('should classify layout.tsx as Page', () => {
      expect(classifyFileType('layout.tsx')).toBe('Page');
    });

    it('should classify notfound.tsx as Page', () => {
      expect(classifyFileType('notfound.tsx')).toBe('Page');
    });

    it('should classify scripts.tsx as Page', () => {
      expect(classifyFileType('scripts.tsx')).toBe('Page');
    });

    it('should classify pages/*.tsx as Page', () => {
      expect(classifyFileType('pages/index.tsx')).toBe('Page');
      expect(classifyFileType('pages/about.tsx')).toBe('Page');
      expect(classifyFileType('src/pages/contact.tsx')).toBe('Page');
    });

    it('should handle case insensitivity for Page types', () => {
      expect(classifyFileType('BOOTSTRAP.TSX')).toBe('Page');
      expect(classifyFileType('Layout.TSX')).toBe('Page');
      expect(classifyFileType('PAGES/INDEX.TSX')).toBe('Page');
    });
  });

  describe('Config types', () => {
    it('should classify component-props/index.ts as Config', () => {
      expect(classifyFileType('component-props/index.ts')).toBe('Config');
    });

    it('should classify next.config.js as Config', () => {
      expect(classifyFileType('next.config.js')).toBe('Config');
    });

    it('should handle case insensitivity for Config types', () => {
      expect(classifyFileType('COMPONENT-PROPS/INDEX.TS')).toBe('Config');
      expect(classifyFileType('NEXT.CONFIG.JS')).toBe('Config');
    });
  });

  describe('Component types', () => {
    it('should classify files in /components/ ending with .tsx as Component', () => {
      expect(classifyFileType('components/Button.tsx')).toBe('Component');
      expect(classifyFileType('src/components/Header.tsx')).toBe('Component');
      expect(classifyFileType('app/components/Card.tsx')).toBe('Component');
    });

    it('should handle case insensitivity for Component types', () => {
      expect(classifyFileType('COMPONENTS/BUTTON.TSX')).toBe('Component');
      expect(classifyFileType('Components/Header.tsx')).toBe('Component');
    });

    it('should not classify .ts files in components as Component', () => {
      expect(classifyFileType('components/utils.ts')).toBe('Module');
    });
  });

  describe('Middleware types', () => {
    it('should classify files in /middleware/plugins as Middleware', () => {
      expect(classifyFileType('middleware/plugins/auth.ts')).toBe('Middleware');
      expect(classifyFileType('src/middleware/plugins/logging.ts')).toBe(
        'Middleware'
      );
    });

    it('should handle case insensitivity for Middleware types', () => {
      expect(classifyFileType('MIDDLEWARE/PLUGINS/AUTH.TS')).toBe('Middleware');
    });
  });

  describe('API Route types', () => {
    it('should classify files in /pages/api/ as API Route', () => {
      expect(classifyFileType('pages/api/users.ts')).toBe('API Route');
      expect(classifyFileType('pages/api/auth/login.ts')).toBe('API Route');
      expect(classifyFileType('src/pages/api/data.ts')).toBe('API Route');
    });

    it('should handle case insensitivity for API Route types', () => {
      expect(classifyFileType('PAGES/API/USERS.TS')).toBe('API Route');
    });
  });

  describe('Plugin types', () => {
    it('should classify files in /page-props-factory/plugins/ as Plugin', () => {
      expect(classifyFileType('page-props-factory/plugins/site.ts')).toBe(
        'Plugin'
      );
      expect(
        classifyFileType('src/page-props-factory/plugins/component.ts')
      ).toBe('Plugin');
    });

    it('should handle case insensitivity for Plugin types', () => {
      expect(classifyFileType('PAGE-PROPS-FACTORY/PLUGINS/SITE.TS')).toBe(
        'Plugin'
      );
    });
  });

  describe('Package types', () => {
    it('should classify package.json files as Package', () => {
      expect(classifyFileType('package.json')).toBe('Package');
      expect(classifyFileType('src/package.json')).toBe('Package');
      expect(classifyFileType('components/package.json')).toBe('Package');
    });

    it('should handle case insensitivity for Package types', () => {
      expect(classifyFileType('PACKAGE.JSON')).toBe('Package');
    });
  });

  describe('Windows path normalization', () => {
    it('should normalize Windows backslashes to forward slashes', () => {
      expect(classifyFileType('components\\Button.tsx')).toBe('Component');
      expect(classifyFileType('pages\\api\\users.ts')).toBe('API Route');
      expect(classifyFileType('middleware\\plugins\\auth.ts')).toBe(
        'Middleware'
      );
    });
  });

  describe('Module (default) types', () => {
    it('should return Module for unrecognized file types', () => {
      expect(classifyFileType('utils.ts')).toBe('Module');
      expect(classifyFileType('helpers/index.ts')).toBe('Module');
      expect(classifyFileType('lib/constants.ts')).toBe('Module');
      expect(classifyFileType('types/index.d.ts')).toBe('Module');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string', () => {
      expect(classifyFileType('')).toBe('Module');
    });

    it('should handle paths with multiple slashes', () => {
      expect(classifyFileType('//components//Button.tsx')).toBe('Component');
    });

    it('should handle very long paths', () => {
      const longPath = 'a/'.repeat(100) + 'components/Button.tsx';
      expect(classifyFileType(longPath)).toBe('Component');
    });
  });
});
