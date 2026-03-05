import { Product } from './migrationInterfaces.js';

export interface JobInitiateRequest {
  modelType?: 'deepseek' | 'claude' | 'gpt';
  product: Product;
  fromVersion: string;
  toVersion: string;
}

export interface JobInitiateResponse {
  jobId: string;
}
