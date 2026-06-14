import { NextFunction, Request, Response } from 'express';
import { getAuth } from './requireAuth';
/** @deprecated Resource controllers now enforce database-backed ownership scopes. */
export function ownershipGuard(_entity: 'order' | 'product') {
  return (req: Request, res: Response, next: NextFunction) => getAuth(req) ? next() : res.status(401).json({ success: false, message: 'Unauthorized' });
}
