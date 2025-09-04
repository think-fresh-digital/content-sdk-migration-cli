/**
 * A simple classifier to determine the file's role based on its path.
 */
export const classifyFileType = (filePath: string): string => {
  const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase(); // Normalize for Windows paths and make case insensitive

  if (normalizedPath.includes('/components/')) return 'Component';
  if (normalizedPath.includes('/middleware/plugins')) return 'Middleware';
  if (normalizedPath.includes('/pages/api/')) return 'API Route';
  if (normalizedPath.includes('/page-props-factory/plugins/')) return 'Plugin';
  if (normalizedPath.endsWith('/package.json')) return 'Package';

  return 'Module';
};
