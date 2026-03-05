import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { resolveMigrationSelection } from './promptMigrationOptions.js';

vi.mock('inquirer');

describe('resolveMigrationSelection', () => {
  const originalExit = process.exit;
  const originalError = console.error;

  beforeEach(() => {
    vi.clearAllMocks();
    (process as any).stdin.isTTY = true;
    (process as any).stdout.isTTY = true;
    vi.mocked(inquirer.prompt).mockResolvedValue({
      product: 'jss-to-jss',
      fromVersion: '22.5',
      toVersion: '22.6',
    } as any);
  });

  afterEach(() => {
    process.exit = originalExit;
    console.error = originalError;
    vi.restoreAllMocks();
  });

  it('should accept a fully-specified, valid selection without prompting', async () => {
    const promptSpy = vi.mocked(inquirer.prompt);

    const result = await resolveMigrationSelection({
      product: 'jss-to-jss',
      fromVersion: '22.5',
      toVersion: '22.6',
    });

    expect(promptSpy).not.toHaveBeenCalled();
    expect(result).toEqual({
      product: 'jss-to-jss',
      fromVersion: '22.5',
      toVersion: '22.6',
    });
  });

  it('should prompt for missing product, fromVersion, and toVersion', async () => {
    const promptMock = vi
      .spyOn(inquirer, 'prompt')
      .mockResolvedValueOnce({ product: 'jss-to-jss' })
      .mockResolvedValueOnce({ fromVersion: '22.5' })
      .mockResolvedValueOnce({ toVersion: '22.6' });

    const result = await resolveMigrationSelection({});

    expect(promptMock).toHaveBeenCalledTimes(3);
    expect(result).toEqual({
      product: 'jss-to-jss',
      fromVersion: '22.5',
      toVersion: '22.6',
    });
  });

  it('should error and exit on invalid product', async () => {
    const exitMock = vi.fn() as any;
    process.exit = exitMock;
    const errorMock = vi.spyOn(console, 'error').mockImplementation(() => {});

    await resolveMigrationSelection({
      product: 'invalid',
      fromVersion: '22.5',
      toVersion: '22.6',
    });

    expect(errorMock).toHaveBeenCalledWith(
      chalk.red(
        'Invalid product: invalid. Must be one of: jss-to-jss, jss-to-content-sdk, content-sdk-to-content-sdk'
      )
    );
    expect(exitMock).toHaveBeenCalledWith(1);

    errorMock.mockRestore();
  });

  it('should error and exit when missing values and not in interactive TTY', async () => {
    const exitMock = vi.fn() as any;
    process.exit = exitMock;
    const errorMock = vi.spyOn(console, 'error').mockImplementation(() => {});

    (process as any).stdin.isTTY = false;
    (process as any).stdout.isTTY = false;

    await resolveMigrationSelection({});

    expect(errorMock).toHaveBeenCalledWith(
      chalk.red(
        'Missing migration options and no interactive TTY available. Please provide --product, --fromVersion, and --toVersion via CLI flags.'
      )
    );
    expect(exitMock).toHaveBeenCalledWith(1);

    errorMock.mockRestore();
  });
});
