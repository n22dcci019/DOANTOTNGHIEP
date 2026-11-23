export function validateEnvironment(env: Record<string, unknown>) {
  if (typeof env.DATABASE_URL !== 'string' || !env.DATABASE_URL.trim()) {
    throw new Error('DATABASE_URL is required');
  }
  let url: URL;
  try {
    url = new URL(env.DATABASE_URL);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL');
  }
  const port = env.PORT === undefined ? 3000 : Number(env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  if (port >= 54321 && port <= 54324) {
    throw new Error('PORT 54321–54324 is reserved for Supabase');
  }
  return { ...env, DATABASE_URL: env.DATABASE_URL, PORT: port };
}
