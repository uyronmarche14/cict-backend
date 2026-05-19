type CookieSameSite = 'lax' | 'strict' | 'none';

const normalizeSameSite = (value?: string): CookieSameSite => {
  const normalized = value?.trim().toLowerCase();

  if (normalized === 'strict' || normalized === 'none' || normalized === 'lax') {
    return normalized;
  }

  return process.env.NODE_ENV === 'production' ? 'none' : 'lax';
};

const normalizeSecure = (sameSite: CookieSameSite) => {
  const override = process.env.COOKIE_SECURE?.trim().toLowerCase();

  if (override === 'true') {
    return true;
  }

  if (override === 'false') {
    return false;
  }

  if (sameSite === 'none') {
    return true;
  }

  return process.env.NODE_ENV === 'production';
};

export const getAuthCookieOptions = () => {
  const sameSite = normalizeSameSite(process.env.COOKIE_SAME_SITE);
  const secure = normalizeSecure(sameSite);
  const domain = process.env.COOKIE_DOMAIN?.trim();

  return {
    httpOnly: true,
    sameSite,
    secure,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
    ...(domain ? { domain } : {}),
  } as const;
};
