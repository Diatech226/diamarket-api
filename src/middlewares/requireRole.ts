import { NextFunction, Request, Response } from 'express';

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as Request & { auth?: { role: string } }).auth;
    if (!auth) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!allowedRoles.includes(auth.role)) return res.status(403).json({ success: false, message: 'Forbidden' });
    next();
  };
}
