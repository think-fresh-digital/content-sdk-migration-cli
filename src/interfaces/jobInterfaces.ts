import { Product } from './migrationInterfaces.js';

export interface JobInitiateRequest {
  modelType?: 'deepseek' | 'claude' | 'gpt' | 'auto';
  product: Product;
  fromVersion: string;
  toVersion: string;
  filesEnqueued: number;
}

export interface JobInitiateResponse {
  jobId: string;
}

export interface JobEnqueueRequest {
  jobId: string;
  filePath: string;
  fileType: string;
  fileContent: string;
}

export interface JobStatusResponse {
  percentComplete: number;
  readyToFinalise: boolean;
}
