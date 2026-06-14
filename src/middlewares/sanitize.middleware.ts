import { NextFunction, Request, Response } from 'express';
const forbiddenKeys = new Set(['__proto__', 'prototype', 'constructor', '$where']);
function sanitize(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (forbiddenKeys.has(key) || key.startsWith('$') || key.includes('.')) delete (value as Record<string, unknown>)[key];
    else sanitize((value as Record<string, unknown>)[key]);
  }
}
export function sanitizeRequest(req: Request, _res: Response, next: NextFunction) { sanitize(req.body); next(); }
