import { ServiceConfig } from '../interfaces/configInterfaces';

export const buildServiceUrl = (
  config: ServiceConfig,
  route: string
): string => {
  const base = config.SERVICE_HOST.endsWith('/')
    ? config.SERVICE_HOST.slice(0, -1)
    : config.SERVICE_HOST;
  const cleanRoute = route.startsWith('/') ? route.slice(1) : route;
  const path = config.DEBUG ? `/api/${cleanRoute}` : `/${cleanRoute}`;
  const url = `${base}${path}`;
  return config.DEBUG ? url : `${url}?code=${config.SERVICE_KEY}`;
};
