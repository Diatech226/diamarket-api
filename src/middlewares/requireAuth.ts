import { NextFunction, Request, Response } from 'express';

export type AuthContext = { userId: string; role: string; vendorId?: string; marketplacePointId?: string; country?: string };

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = req.header('x-user-id');
  const role = req.header('x-user-role') || 'client';

  if (!userId) return res.status(401).json({ message: 'Unauthorized: missing x-user-id header' });

  (req as Request & { auth?: AuthContext }).auth = {
    userId,
    role,
    vendorId: req.header('x-vendor-id') || undefined,
    marketplacePointId: req.header('x-marketplace-point-id') || undefined,
    country: req.header('x-country') || undefined,
  };
  next();
}
