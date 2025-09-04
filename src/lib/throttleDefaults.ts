export interface ThrottleDefaults {
  maxConcurrent: number;
  intervalCap: number;
  intervalMs: number;
  timeoutMs: number;
}

export const DEFAULT_THROTTLE: ThrottleDefaults = {
  maxConcurrent: 2,
  intervalCap: 5,
  intervalMs: 20000,
  timeoutMs: 40000,
};
