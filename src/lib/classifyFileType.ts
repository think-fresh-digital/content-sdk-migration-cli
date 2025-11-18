/**
 * A simple classifier to determine the file's role based on its path.
 */
export const classifyFileType = (filePath: string): string => {
  const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase(); // Normalize for Windows paths and make case insensitive
  if (
    ['bootstrap.tsx', 'layout.tsx', 'notfound.tsx', 'scripts.tsx'].some(
      suffix => normalizedPath.endsWith(suffix)
    )
  )
    return 'Page';

  if (
    ['component-props/index.ts', 'next.config.js'].some(suffix =>
      normalizedPath.endsWith(suffix)
    )
  )
    return 'Config';

  if (
    (normalizedPath.includes('/components/') ||
      normalizedPath.startsWith('components/')) &&
    normalizedPath.endsWith('.tsx')
  )
    return 'Component';
  if (
    normalizedPath.includes('/middleware/plugins') ||
    normalizedPath.startsWith('middleware/plugins')
  )
    return 'Middleware';
  if (
    normalizedPath.includes('/pages/api/') ||
    normalizedPath.startsWith('pages/api/')
  )
    return 'API Route';
  if (
    (normalizedPath.includes('/pages/') ||
      normalizedPath.startsWith('pages/')) &&
    normalizedPath.endsWith('.tsx')
  )
    return 'Page';
  if (
    normalizedPath.includes('/page-props-factory/plugins/') ||
    normalizedPath.startsWith('page-props-factory/plugins/')
  )
    return 'Plugin';
  if (
    normalizedPath.endsWith('/package.json') ||
    normalizedPath === 'package.json'
  )
    return 'Package';

  return 'Module';
};
