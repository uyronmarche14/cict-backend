const assertPositiveInt = (name: string, value?: string) => {
  if (!value) {
    return;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
};

export const validateEnv = () => {
  const missing: string[] = [];
  const { NODE_ENV = 'development' } = process.env;

  if (!process.env.MONGODB_URI) {
    missing.push('MONGODB_URI');
  }

  if (!process.env.JWT_SECRET) {
    missing.push('JWT_SECRET');
  }

  if (NODE_ENV === 'production' && !process.env.CORS_ORIGIN) {
    missing.push('CORS_ORIGIN');
  }

  assertPositiveInt('BCRYPT_ROUNDS', process.env.BCRYPT_ROUNDS);
  assertPositiveInt('RATE_LIMIT_WINDOW_MS', process.env.RATE_LIMIT_WINDOW_MS);
  assertPositiveInt('RATE_LIMIT_MAX_REQUESTS', process.env.RATE_LIMIT_MAX_REQUESTS);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};
