import { NextFunction, Request, Response } from 'express';
import { readSessionResult } from '../utils/session';
import { User } from '../models/user.model';
import { Vendor } from '../models/vendor.model';
import { Role, normalizeRole } from '../config/permissions';

export type AuthContext = { userId: string; role: Role; email?: string; vendorId?: string; marketplacePointId?: string };
export const getAuth = (req: Request) => (req as Request & { auth?: AuthContext }).auth;

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const { user: session, error } = readSessionResult(req);
    if (!session) return res.status(401).json({ success: false, message: error === 'expired' ? 'Token expired' : 'Unauthorized' });

    const currentUser = await User.findById(session.id);
    const role = normalizeRole(currentUser?.role);
    if (!currentUser || currentUser.disabled || !role) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const vendor = role === 'vendor' ? await Vendor.findOne({ userId: currentUser.id, status: 'active', isActive: true }) : null;
    (req as Request & { auth: AuthContext }).auth = {
      userId: currentUser.id, role, email: currentUser.email ?? undefined,
      vendorId: vendor?.id, marketplacePointId: vendor?.marketplacePointId ? String(vendor.marketplacePointId) : undefined,
    };
    next();
  } catch (error) { next(error); }
}
