import inquirer from 'inquirer';
import chalk from 'chalk';
import {
  MigrationSelection,
  Product,
} from '../interfaces/migrationInterfaces.js';
import {
  PRODUCTS,
  getAllowedFromVersions,
  getAllowedToVersions,
  isValidMigrationSelection,
} from './migrationOptions.js';

export interface RawMigrationOptions {
  product?: string;
  fromVersion?: string;
  toVersion?: string;
}

function ensureInteractiveMode() {
  const isTty = process.stdin.isTTY && process.stdout.isTTY;
  if (!isTty) {
    console.error(
      chalk.red(
        'Missing migration options and no interactive TTY available. Please provide --product, --fromVersion, and --toVersion via CLI flags.'
      )
    );
    process.exit(1);
  }
}

function coerceProduct(product?: string): Product | undefined {
  if (!product) return undefined;
  return PRODUCTS.find(p => p === product) as Product | undefined;
}

export async function resolveMigrationSelection(
  raw: RawMigrationOptions
): Promise<MigrationSelection> {
  let product = coerceProduct(raw.product);

  if (raw.product && !product) {
    console.error(
      chalk.red(
        `Invalid product: ${raw.product}. Must be one of: ${PRODUCTS.join(', ')}`
      )
    );
    process.exit(1);
  }

  if (!product) {
    ensureInteractiveMode();
    const answer = await inquirer.prompt<{ product: Product }>([
      {
        type: 'rawlist',
        name: 'product',
        message: 'Select the type of migration:',
        choices: PRODUCTS,
      },
    ]);
    product = answer.product;
  }

  const allowedFromVersions = getAllowedFromVersions(product);
  let fromVersion = raw.fromVersion;

  if (fromVersion && !allowedFromVersions.includes(fromVersion)) {
    console.error(
      chalk.red(
        `Invalid fromVersion: ${fromVersion} for product ${product}. Allowed values: ${allowedFromVersions.join(', ')}`
      )
    );
    process.exit(1);
  }

  if (!fromVersion) {
    ensureInteractiveMode();
    const answer = await inquirer.prompt<{ fromVersion: string }>([
      {
        type: 'rawlist',
        name: 'fromVersion',
        message: 'Select the source version:',
        choices: allowedFromVersions,
      },
    ]);
    fromVersion = answer.fromVersion;
  }

  const allowedToVersions = getAllowedToVersions(product, fromVersion);
  let toVersion = raw.toVersion;

  if (toVersion && !allowedToVersions.includes(toVersion)) {
    console.error(
      chalk.red(
        `Invalid toVersion: ${toVersion} for product ${product} and fromVersion ${fromVersion}. Allowed values: ${allowedToVersions.join(', ')}`
      )
    );
    process.exit(1);
  }

  if (!toVersion) {
    ensureInteractiveMode();
    const answer = await inquirer.prompt<{ toVersion: string }>([
      {
        type: 'rawlist',
        name: 'toVersion',
        message: 'Select the target version:',
        choices: allowedToVersions,
      },
    ]);
    toVersion = answer.toVersion;
  }

  const selection: MigrationSelection = {
    product,
    fromVersion,
    toVersion,
  };

  if (!isValidMigrationSelection(selection)) {
    console.error(
      chalk.red(
        `Invalid migration selection: ${product} ${fromVersion} -> ${toVersion}. Please choose a valid combination.`
      )
    );
    process.exit(1);
  }

  return selection;
}
