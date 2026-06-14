import { Request, Response } from 'express';
import { Category, Order, Product, Setting, User, Vendor, VendorRequest } from '../models';
import { getAuth } from '../middlewares/requireAuth';
import { logAdminAction } from '../services/admin-audit.service';

const allowedSettings = ['marketplaceName', 'defaultCurrency', 'defaultCommission', 'supportContact', 'maintenanceMode', 'checkout', 'shipping'];

export const adminController = {
  async dashboard(_req: Request, res: Response) {
    const [products, orders, users, vendors, pendingOrders, pendingVendorRequests, revenue, lowStock] = await Promise.all([
      Product.countDocuments(), Order.countDocuments(), User.countDocuments(), Vendor.countDocuments(),
      Order.countDocuments({ status: 'pending' }), VendorRequest.countDocuments({ status: 'pending' }),
      Order.aggregate([{ $match: { paymentStatus: 'paid' } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
      Product.countDocuments({ status: 'active', stock: { $lte: 5 } }),
    ]);
    return res.json({ success: true, stats: { products, orders, users, vendors, revenue: revenue[0]?.total || 0, pendingOrders, pendingVendorRequests, lowStock } });
  },
  async products(req: Request, res: Response) {
    const filter: Record<string, unknown> = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.vendor) filter.vendor = req.query.vendor;
    if (req.query.search) filter.$text = { $search: String(req.query.search) };
    return res.json({ data: await Product.find(filter).populate('category vendor').sort({ createdAt: -1 }) });
  },
  async categories(_req: Request, res: Response) { return res.json({ data: await Category.find().sort({ order: 1, name: 1 }) }); },
  async vendors(_req: Request, res: Response) {
    const data = await Vendor.aggregate([{ $lookup: { from: 'products', localField: '_id', foreignField: 'vendor', as: 'products' } }, { $lookup: { from: 'orders', localField: '_id', foreignField: 'vendor', as: 'orders' } }, { $addFields: { productCount: { $size: '$products' }, orderCount: { $size: '$orders' } } }, { $project: { products: 0, orders: 0 } }]);
    return res.json({ data });
  },
  async updateVendorStatus(req: Request, res: Response) {
    if (!['active', 'suspended'].includes(req.body.status)) return res.status(400).json({ message: 'Invalid vendor status' });
    const data = await Vendor.findByIdAndUpdate(req.params.id, { status: req.body.status, isActive: req.body.status === 'active' }, { new: true, runValidators: true });
    if (!data) return res.status(404).json({ message: 'Vendor not found' });
    await logAdminAction(getAuth(req)!.userId, 'vendor.status_changed', 'vendor', data.id, { status: data.status });
    return res.json({ data });
  },
  async settings(_req: Request, res: Response) {
    const rows = await Setting.find({ key: { $in: allowedSettings } });
    return res.json({ data: Object.fromEntries(rows.map((row) => [row.key, row.value])) });
  },
  async updateSettings(req: Request, res: Response) {
    const entries = Object.entries(req.body || {}).filter(([key]) => allowedSettings.includes(key));
    await Promise.all(entries.map(([key, value]) => Setting.findOneAndUpdate({ key }, { value, scope: 'global' }, { upsert: true, new: true })));
    await logAdminAction(getAuth(req)!.userId, 'settings.updated', 'settings', undefined, { keys: entries.map(([key]) => key) });
    return adminController.settings(req, res);
  },
};
