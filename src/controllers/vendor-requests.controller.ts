import { Request, Response } from 'express';
import { VendorRequest } from '../models/vendor-request.model';
import { Vendor } from '../models/vendor.model';
import { User } from '../models/user.model';

export const vendorRequestsController = {
  async create(req: Request, res: Response) {
    const payload = { ...req.body, userId: (req as Request & { auth?: { userId: string } }).auth?.userId || req.body.userId };
    const data = await VendorRequest.create(payload);
    return res.status(201).json({ data });
  },
  async list(_req: Request, res: Response) {
    const data = await VendorRequest.find().populate('userId reviewedBy').sort({ createdAt: -1 });
    return res.json({ data });
  },
  async approve(req: Request, res: Response) {
    const auth = (req as Request & { auth?: { userId: string } }).auth;
    const request = await VendorRequest.findByIdAndUpdate(req.params.id, { status: 'active', reviewedBy: auth?.userId, reviewedAt: new Date() }, { new: true });
    if (!request) return res.status(404).json({ message: 'Vendor request not found' });

    const vendor = await Vendor.findOneAndUpdate({ userId: request.userId }, { shopName: request.businessName, status: 'active', isActive: true }, { new: true, upsert: true, runValidators: true });
    await User.findByIdAndUpdate(request.userId, { role: 'vendor' }, { runValidators: true });
    return res.json({ data: { request, vendor } });
  },
  async reject(req: Request, res: Response) {
    const auth = (req as Request & { auth?: { userId: string } }).auth;
    const request = await VendorRequest.findByIdAndUpdate(req.params.id, { status: 'rejected', reviewedBy: auth?.userId, reviewedAt: new Date() }, { new: true });
    if (!request) return res.status(404).json({ message: 'Vendor request not found' });
    return res.json({ data: request });
  },
};
