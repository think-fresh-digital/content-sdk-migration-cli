import { describe, it, expect } from 'vitest';
import { DEFAULT_THROTTLE } from './throttleDefaults.js';

describe('DEFAULT_THROTTLE', () => {
  it('should have correct default values', () => {
    expect(DEFAULT_THROTTLE.maxConcurrent).toBe(2);
    expect(DEFAULT_THROTTLE.intervalCap).toBe(5);
    expect(DEFAULT_THROTTLE.intervalMs).toBe(20000);
    expect(DEFAULT_THROTTLE.timeoutMs).toBe(40000);
  });

  it('should have all required properties', () => {
    expect(DEFAULT_THROTTLE).toHaveProperty('maxConcurrent');
    expect(DEFAULT_THROTTLE).toHaveProperty('intervalCap');
    expect(DEFAULT_THROTTLE).toHaveProperty('intervalMs');
    expect(DEFAULT_THROTTLE).toHaveProperty('timeoutMs');
  });

  it('should have numeric values', () => {
    expect(typeof DEFAULT_THROTTLE.maxConcurrent).toBe('number');
    expect(typeof DEFAULT_THROTTLE.intervalCap).toBe('number');
    expect(typeof DEFAULT_THROTTLE.intervalMs).toBe('number');
    expect(typeof DEFAULT_THROTTLE.timeoutMs).toBe('number');
  });

  it('should have positive values', () => {
    expect(DEFAULT_THROTTLE.maxConcurrent).toBeGreaterThan(0);
    expect(DEFAULT_THROTTLE.intervalCap).toBeGreaterThan(0);
    expect(DEFAULT_THROTTLE.intervalMs).toBeGreaterThan(0);
    expect(DEFAULT_THROTTLE.timeoutMs).toBeGreaterThan(0);
  });
});
