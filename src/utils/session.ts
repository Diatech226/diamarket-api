import { Request, Response } from 'express';
import jwt, { SignOptions, TokenExpiredError } from 'jsonwebtoken';
import { env } from '../config/env';

export const SESSION_COOKIE_NAME = 'diamarket_session';
export type SessionUser = { id: string; email: string; name?: string; role: string };
export type SessionResult = { user: SessionUser | null; error?: 'expired' | 'invalid' };
type SessionClaims = SessionUser & { type: 'session' };

const cookieOptions = () => ({
  httpOnly: true,
  secure: env.nodeEnv === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: env.sessionTtlMs,
});

export function createSessionToken(user: SessionUser) {
  if (!env.jwtSecret) throw new Error('JWT_SECRET is required');
  return jwt.sign({ ...user, type: 'session' } satisfies SessionClaims, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'],
  });
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE_NAME, token, cookieOptions());
}

export function clearSessionCookie(res: Response) {
  const { maxAge: _maxAge, ...options } = cookieOptions();
  res.clearCookie(SESSION_COOKIE_NAME, options);
}

function parseCookies(header?: string) {
  return Object.fromEntries(
    (header ?? '').split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
      const separator = part.indexOf('=');
      return [decodeURIComponent(part.slice(0, separator)), decodeURIComponent(part.slice(separator + 1))];
    }),
  );
}

export function readSessionResult(req: Request): SessionResult {
  if (!env.jwtSecret) return { user: null, error: 'invalid' };
  const bearer = req.header('authorization')?.replace(/^Bearer\s+/i, '');
  const token = bearer || parseCookies(req.header('cookie'))[SESSION_COOKIE_NAME];
  if (!token) return { user: null };
  try {
    const claims = jwt.verify(token, env.jwtSecret) as SessionClaims;
    if (claims.type !== 'session') return { user: null, error: 'invalid' };
    return { user: { id: claims.id, email: claims.email, name: claims.name, role: claims.role } };
  } catch (error) {
    return { user: null, error: error instanceof TokenExpiredError ? 'expired' : 'invalid' };
  }
}

export function readSession(req: Request): SessionUser | null {
  return readSessionResult(req).user;
}
