import {
  MigrationSelection,
  Product,
} from '../interfaces/migrationInterfaces.js';

type MigrationRules = {
  fromVersions: string[];
  toByFrom: Record<string, string[]>;
};

const MIGRATION_RULES: Record<Product, MigrationRules> = {
  'jss-to-jss': {
    fromVersions: ['22.5', '22.6', '22.7'],
    toByFrom: {
      '22.5': ['22.6'],
      '22.6': ['22.7'],
      '22.7': ['22.8'],
    },
  },
  'jss-to-content-sdk': {
    fromVersions: ['22.8', '22.9', '22.10'],
    toByFrom: {
      '22.8': ['1.0.0', '1.1.0', '1.2.0', '1.3.1', '1.4.1', '1.5.0'],
      '22.9': ['1.0.0', '1.1.0', '1.2.0', '1.3.1', '1.4.1', '1.5.0'],
      '22.10': ['1.0.0', '1.1.0', '1.2.0', '1.3.1', '1.4.1', '1.5.0'],
    },
  },
  'content-sdk-to-content-sdk': {
    fromVersions: ['1.0.0', '1.1.0', '1.2.0', '1.3.1', '1.4.1'],
    toByFrom: {
      '1.0.0': ['1.1.0'],
      '1.1.0': ['1.2.0'],
      '1.2.0': ['1.3.1'],
      '1.3.1': ['1.4.1', '1.5.0'],
      '1.4.1': ['1.5.0'],
    },
  },
};

export const PRODUCTS: Product[] = Object.keys(MIGRATION_RULES) as Product[];

export function getAllowedFromVersions(product: Product): string[] {
  return MIGRATION_RULES[product].fromVersions;
}

export function getAllowedToVersions(
  product: Product,
  fromVersion: string
): string[] {
  return MIGRATION_RULES[product].toByFrom[fromVersion] ?? [];
}

export function isValidMigrationSelection(
  selection: MigrationSelection
): boolean {
  const { product, fromVersion, toVersion } = selection;
  const fromVersions = getAllowedFromVersions(product);
  if (!fromVersions.includes(fromVersion)) {
    return false;
  }
  const toVersions = getAllowedToVersions(product, fromVersion);
  return toVersions.includes(toVersion);
}
