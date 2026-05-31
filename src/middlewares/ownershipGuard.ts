import { NextFunction, Request, Response } from 'express';

export function ownershipGuard(entity: 'order' | 'product') {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as Request & { auth?: { role: string; userId: string; vendorId?: string } }).auth;
    if (!auth) return res.status(401).json({ message: 'Unauthorized' });

    if (['admin', 'super_admin'].includes(auth.role)) return next();

    const expectedUserId = req.params.userId || req.query.userId || req.body.customer;
    const expectedVendorId = req.params.vendorId || req.query.vendorId || req.body.vendor;

    if (auth.role === 'client' && entity === 'order' && expectedUserId && String(expectedUserId) !== String(auth.userId)) {
      return res.status(403).json({ message: 'Forbidden: client can only access own orders' });
    }

    if (['vendeur', 'marketplace_point_focal'].includes(auth.role) && expectedVendorId && auth.vendorId && String(expectedVendorId) !== String(auth.vendorId)) {
      return res.status(403).json({ message: 'Forbidden: vendor scope violation' });
    }

    next();
  };
}
