import { NextFunction, Request, Response } from 'express';
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
export function rateLimit({ windowMs, max, prefix }: { windowMs: number; max: number; prefix: string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now(); const key = `${prefix}:${req.ip || 'unknown'}`; const bucket = buckets.get(key) ?? { count: 0, resetAt: now + windowMs };
    if (now >= bucket.resetAt) { bucket.count = 0; bucket.resetAt = now + windowMs; }
    bucket.count += 1; buckets.set(key, bucket); res.setHeader('RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
    if (bucket.count > max) return res.status(429).json({ success: false, message: 'Too many requests' });
    next();
  };
}
