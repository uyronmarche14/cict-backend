const assertPositiveInt = (name: string, value?: string) => {
  if (!value) {
    return;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
};

const assertBooleanString = (name: string, value?: string) => {
  if (!value) {
    return;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized !== 'true' && normalized !== 'false') {
    throw new Error(`${name} must be either "true" or "false"`);
  }
};

const assertCookieSameSite = (name: string, value?: string) => {
  if (!value) {
    return;
  }

  const normalized = value.trim().toLowerCase();
  if (!['lax', 'strict', 'none'].includes(normalized)) {
    throw new Error(`${name} must be one of: lax, strict, none`);
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
  assertPositiveInt(
    'AUTH_LOGIN_RATE_LIMIT_WINDOW_MS',
    process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS
  );
  assertPositiveInt(
    'AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS',
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS
  );
  assertPositiveInt(
    'AUTH_SESSION_RATE_LIMIT_WINDOW_MS',
    process.env.AUTH_SESSION_RATE_LIMIT_WINDOW_MS
  );
  assertPositiveInt(
    'AUTH_SESSION_RATE_LIMIT_MAX_REQUESTS',
    process.env.AUTH_SESSION_RATE_LIMIT_MAX_REQUESTS
  );
  assertCookieSameSite('COOKIE_SAME_SITE', process.env.COOKIE_SAME_SITE);
  assertBooleanString('COOKIE_SECURE', process.env.COOKIE_SECURE);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};
