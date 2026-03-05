import { ServiceConfig } from '../interfaces/configInterfaces';

export const buildServiceUrl = (
  config: ServiceConfig,
  route: string
): string => {
  // Remove all trailing slashes from base URL
  const base = config.SERVICE_HOST.replace(/\/+$/, '');
  // Remove all leading slashes from route
  const cleanRoute = route.replace(/^\/+/, '');
  // Remove all trailing slashes from route
  const routeWithoutTrailingSlash = cleanRoute.replace(/\/+$/, '');
  const path = config.DEBUG
    ? `/api/${routeWithoutTrailingSlash}`
    : `/${routeWithoutTrailingSlash}`;
  const url = `${base}${path}`;
  return config.DEBUG ? url : `${url}?code=${config.SERVICE_KEY}`;
};
