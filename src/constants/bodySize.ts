// Request Body Size Limits

// Default max body size in bytes (10MB)
export const DEFAULT_MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB

// Configurable max body size from environment variable (in bytes)
// Allows override via MAX_BODY_SIZE env var
export const MAX_BODY_SIZE = process.env.MAX_BODY_SIZE
  ? parseInt(process.env.MAX_BODY_SIZE, 10)
  : DEFAULT_MAX_BODY_SIZE;

// Human-readable size for error messages
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Get max body size as human-readable string
export const MAX_BODY_SIZE_READABLE = formatBytes(MAX_BODY_SIZE);

