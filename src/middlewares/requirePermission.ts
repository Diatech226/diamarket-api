import { NextFunction, Request, Response } from 'express';
import { hasPermission, Permission } from '../config/permissions';

export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as Request & { auth?: { role: string } }).auth;
    if (!auth) return res.status(401).json({ message: 'Unauthorized' });
    if (!hasPermission(auth.role, permission)) {
      return res.status(403).json({ message: `Forbidden: missing permission ${permission}` });
    }
    next();
  };
}
