import { ServiceConfig } from '../interfaces/configInterfaces';

export const getConfig = (
  apiKey: string,
  debug: boolean,
  verbose: boolean,
  whatIf: boolean,
  serviceVersion: string
): ServiceConfig => ({
  SERVICE_HOST: debug
    ? 'http://localhost:7071'
    : `https://api-think-fresh-digital.azure-api.net/content-sdk/${serviceVersion}`,
  SERVICE_KEY: apiKey,
  DEBUG: debug,
  VERBOSE: verbose,
  WHAT_IF: whatIf,
});
