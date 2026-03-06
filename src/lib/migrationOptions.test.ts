import { describe, it, expect } from 'vitest';
import {
  PRODUCTS,
  getAllowedFromVersions,
  getAllowedToVersions,
  isValidMigrationSelection,
} from './migrationOptions.js';
import {
  MigrationSelection,
  Product,
} from '../interfaces/migrationInterfaces.js';

describe('migrationOptions', () => {
  it('should expose all products', () => {
    expect(PRODUCTS).toEqual([
      'jss-to-jss',
      'jss-to-content-sdk',
      'content-sdk-to-content-sdk',
    ]);
  });

  describe('getAllowedFromVersions', () => {
    const expectations: Record<Product, string[]> = {
      'jss-to-jss': ['22.5', '22.6', '22.7'],
      'jss-to-content-sdk': ['22.8', '22.9', '22.10'],
      'content-sdk-to-content-sdk': [
        '1.0.0',
        '1.1.0',
        '1.2.0',
        '1.3.1',
        '1.4.1',
      ],
    };

    (Object.keys(expectations) as Product[]).forEach(product => {
      it(`should return correct fromVersions for ${product}`, () => {
        expect(getAllowedFromVersions(product)).toEqual(expectations[product]);
      });
    });
  });

  describe('getAllowedToVersions', () => {
    it('should return correct toVersions for jss-to-jss', () => {
      expect(getAllowedToVersions('jss-to-jss', '22.5')).toEqual(['22.6']);
      expect(getAllowedToVersions('jss-to-jss', '22.6')).toEqual(['22.7']);
      expect(getAllowedToVersions('jss-to-jss', '22.7')).toEqual(['22.8']);
    });

    it('should return correct toVersions for jss-to-content-sdk', () => {
      const expected = ['1.0.0', '1.1.0', '1.2.0', '1.3.1', '1.4.1', '1.5.0'];
      expect(getAllowedToVersions('jss-to-content-sdk', '22.8')).toEqual(
        expected
      );
      expect(getAllowedToVersions('jss-to-content-sdk', '22.9')).toEqual(
        expected
      );
      expect(getAllowedToVersions('jss-to-content-sdk', '22.10')).toEqual(
        expected
      );
    });

    it('should return correct toVersions for content-sdk-to-content-sdk', () => {
      expect(
        getAllowedToVersions('content-sdk-to-content-sdk', '1.0.0')
      ).toEqual(['1.1.0']);
      expect(
        getAllowedToVersions('content-sdk-to-content-sdk', '1.1.0')
      ).toEqual(['1.2.0']);
      expect(
        getAllowedToVersions('content-sdk-to-content-sdk', '1.2.0')
      ).toEqual(['1.3.1']);
      expect(
        getAllowedToVersions('content-sdk-to-content-sdk', '1.3.1')
      ).toEqual(['1.4.1', '1.5.0']);
      expect(
        getAllowedToVersions('content-sdk-to-content-sdk', '1.4.1')
      ).toEqual(['1.5.0']);
    });

    it('should return empty array for unknown fromVersion', () => {
      expect(getAllowedToVersions('jss-to-jss', 'unknown')).toEqual([]);
    });
  });

  describe('isValidMigrationSelection', () => {
    const validSelections: MigrationSelection[] = [
      { product: 'jss-to-jss', fromVersion: '22.5', toVersion: '22.6' },
      { product: 'jss-to-jss', fromVersion: '22.6', toVersion: '22.7' },
      { product: 'jss-to-jss', fromVersion: '22.7', toVersion: '22.8' },
      {
        product: 'jss-to-content-sdk',
        fromVersion: '22.8',
        toVersion: '1.1.0',
      },
      {
        product: 'jss-to-content-sdk',
        fromVersion: '22.8',
        toVersion: '1.2.0',
      },
      {
        product: 'jss-to-content-sdk',
        fromVersion: '22.8',
        toVersion: '1.3.1',
      },
      {
        product: 'jss-to-content-sdk',
        fromVersion: '22.8',
        toVersion: '1.4.1',
      },
      {
        product: 'jss-to-content-sdk',
        fromVersion: '22.8',
        toVersion: '1.5.0',
      },
      {
        product: 'jss-to-content-sdk',
        fromVersion: '22.9',
        toVersion: '1.3.1',
      },
      {
        product: 'jss-to-content-sdk',
        fromVersion: '22.10',
        toVersion: '1.5.0',
      },
      {
        product: 'content-sdk-to-content-sdk',
        fromVersion: '1.0.0',
        toVersion: '1.1.0',
      },
      {
        product: 'content-sdk-to-content-sdk',
        fromVersion: '1.1.0',
        toVersion: '1.2.0',
      },
      {
        product: 'content-sdk-to-content-sdk',
        fromVersion: '1.2.0',
        toVersion: '1.3.1',
      },
      {
        product: 'content-sdk-to-content-sdk',
        fromVersion: '1.3.1',
        toVersion: '1.4.1',
      },
      {
        product: 'content-sdk-to-content-sdk',
        fromVersion: '1.3.1',
        toVersion: '1.5.0',
      },
      {
        product: 'content-sdk-to-content-sdk',
        fromVersion: '1.4.1',
        toVersion: '1.5.0',
      },
    ];

    validSelections.forEach(selection => {
      it(`should treat ${selection.product} ${selection.fromVersion} -> ${selection.toVersion} as valid`, () => {
        expect(isValidMigrationSelection(selection)).toBe(true);
      });
    });

    const invalidSelections: MigrationSelection[] = [
      { product: 'jss-to-jss', fromVersion: '22.5', toVersion: '22.7' },
      { product: 'jss-to-jss', fromVersion: '22.6', toVersion: '22.8' },
      {
        product: 'jss-to-content-sdk',
        fromVersion: '22.8',
        toVersion: '22.9',
      },
      {
        product: 'content-sdk-to-content-sdk',
        fromVersion: '1.4.1',
        toVersion: '1.4.1',
      },
      {
        product: 'content-sdk-to-content-sdk',
        fromVersion: '1.3.1',
        toVersion: '22.8',
      },
      {
        product: 'content-sdk-to-content-sdk',
        fromVersion: '1.0.0',
        toVersion: '1.3.1',
      },
      {
        product: 'content-sdk-to-content-sdk',
        fromVersion: '1.1.0',
        toVersion: '1.4.1',
      },
    ];

    invalidSelections.forEach(selection => {
      it(`should treat ${selection.product} ${selection.fromVersion} -> ${selection.toVersion} as invalid`, () => {
        expect(isValidMigrationSelection(selection)).toBe(false);
      });
    });
  });
});
