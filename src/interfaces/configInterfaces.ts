export interface ServiceConfig {
  SERVICE_HOST: string;
  SERVICE_KEY: string;
  DEBUG: boolean;
  VERBOSE: boolean;
  WHAT_IF: boolean;
  THROTTLE?: {
    maxConcurrent: number;
    intervalCap: number;
    intervalMs: number;
  };
}
