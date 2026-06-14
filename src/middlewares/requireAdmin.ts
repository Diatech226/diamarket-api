import { NextFunction, Request, Response } from 'express';
import { getAuth } from './requireAuth';
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const auth = getAuth(req);
  if (!auth) return res.status(401).json({ success: false, message: 'Unauthorized' });
  if (auth.role !== 'admin') return res.status(403).json({ success: false, message: 'Forbidden' });
  next();
}
