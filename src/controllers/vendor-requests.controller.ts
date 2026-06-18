import { Request, Response } from 'express';
import { VendorRequest } from '../models/vendor-request.model';
import { Vendor } from '../models/vendor.model';
import { User } from '../models/user.model';

const requestStatuses = ['pending', 'approved', 'rejected'];

export const vendorRequestsController = {
  async create(req: Request, res: Response) {
    const payload = { ...req.body, userId: (req as Request & { auth?: { userId: string } }).auth?.userId || req.body.userId };
    const data = await VendorRequest.create(payload);
    return res.status(201).json({ success: true, data });
  },
  async list(req: Request, res: Response) {
    const filter: Record<string, unknown> = {};
    if (req.query.status && requestStatuses.includes(String(req.query.status))) filter.status = req.query.status;
    const data = await VendorRequest.find(filter).populate('userId reviewedBy').sort({ createdAt: -1 });
    return res.json({ success: true, data });
  },
  async getById(req: Request, res: Response) {
    const data = await VendorRequest.findById(req.params.id).populate('userId reviewedBy');
    if (!data) return res.status(404).json({ success: false, message: 'Vendor request not found' });
    return res.json({ success: true, data });
  },
  async approve(req: Request, res: Response) {
    const auth = (req as Request & { auth?: { userId: string } }).auth;
    const request = await VendorRequest.findByIdAndUpdate(req.params.id, { status: 'approved', adminComment: req.body.adminComment, $push: { decisionHistory: { action: 'approved', comment: req.body.adminComment, decidedBy: auth?.userId, decidedAt: new Date() } }, reviewedBy: auth?.userId, reviewedAt: new Date() }, { new: true });
    if (!request) return res.status(404).json({ success: false, message: 'Vendor request not found' });
    const vendor = await Vendor.findOneAndUpdate({ userId: request.userId }, { shopName: request.businessName, status: 'active', isActive: true, commissionRate: request.requestedCommissionRate ?? undefined, phone: request.phone, country: request.country, city: request.city }, { new: true, upsert: true, runValidators: true });
    await User.findByIdAndUpdate(request.userId, { role: 'vendor' }, { runValidators: true });
    return res.json({ success: true, data: { request, vendor } });
  },
  async reject(req: Request, res: Response) {
    const auth = (req as Request & { auth?: { userId: string } }).auth;
    const request = await VendorRequest.findByIdAndUpdate(req.params.id, { status: 'rejected', adminComment: req.body.adminComment, $push: { decisionHistory: { action: 'rejected', comment: req.body.adminComment, decidedBy: auth?.userId, decidedAt: new Date() } }, reviewedBy: auth?.userId, reviewedAt: new Date() }, { new: true });
    if (!request) return res.status(404).json({ success: false, message: 'Vendor request not found' });
    return res.json({ success: true, data: request });
  },
};
