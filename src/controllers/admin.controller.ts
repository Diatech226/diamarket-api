import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Category, Order, Product, Setting, User, Vendor, VendorRequest } from '../models';
import { getAuth } from '../middlewares/requireAuth';
import { logAdminAction } from '../services/admin-audit.service';

const allowedSettings = ['marketplaceName', 'defaultCurrency', 'defaultCommission', 'supportContact', 'maintenanceMode', 'checkout', 'shipping'];
const vendorStatuses = ['pending', 'active', 'suspended', 'rejected'];

const toRate = (value: unknown) => {
  const rate = Number(value);
  return Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : null;
};

async function getGlobalCommissionRate() {
  const setting = await Setting.findOne({ key: 'defaultCommission' });
  const rate = toRate(setting?.value);
  return rate ?? 0.1;
}

function vendorPipeline(match: Record<string, unknown> = {}, sort: Record<string, 1 | -1> = { createdAt: -1 }, skip = 0, limit = 20) {
  return [
    { $match: match },
    { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'owner' } },
    { $unwind: { path: '$owner', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'products', localField: '_id', foreignField: 'vendor', as: 'products' } },
    { $lookup: { from: 'orders', localField: '_id', foreignField: 'vendor', as: 'orders' } },
    { $addFields: {
      productCount: { $size: '$products' },
      orderCount: { $size: '$orders' },
      revenue: { $sum: { $map: { input: { $filter: { input: '$orders', as: 'order', cond: { $eq: ['$$order.paymentStatus', 'paid'] } } }, as: 'order', in: '$$order.totalAmount' } } },
      pendingOrderCount: { $size: { $filter: { input: '$orders', as: 'order', cond: { $in: ['$$order.status', ['pending', 'confirmed', 'processing']] } } } },
      deliveredOrderCount: { $size: { $filter: { input: '$orders', as: 'order', cond: { $eq: ['$$order.status', 'delivered'] } } } },
    } },
    { $project: { products: 0, orders: 0, 'owner.passwordHash': 0 } },
    { $sort: sort },
    { $skip: skip },
    { $limit: limit },
  ];
}

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
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
    const skip = (page - 1) * limit;
    const filter: Record<string, unknown> = {};
    if (req.query.status && ['draft', 'active', 'archived'].includes(String(req.query.status))) filter.status = req.query.status;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.vendor) filter.vendor = req.query.vendor;
    if (req.query.search) filter.$text = { $search: String(req.query.search) };
    const [items, total] = await Promise.all([Product.find(filter).skip(skip).limit(limit).populate('category vendor').sort({ createdAt: -1 }), Product.countDocuments(filter)]);
    return res.json({ data: items, meta: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) } });
  },
  async categories(_req: Request, res: Response) { return res.json({ data: await Category.find().sort({ order: 1, name: 1 }) }); },
  async vendors(req: Request, res: Response) {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
    const skip = (page - 1) * limit;
    const match: Record<string, unknown> = {};
    if (req.query.status && vendorStatuses.includes(String(req.query.status))) match.status = req.query.status;
    if (req.query.search) match.$or = [{ shopName: new RegExp(String(req.query.search), 'i') }];
    const sortField = ['shopName', 'status', 'commissionRate', 'createdAt'].includes(String(req.query.sortBy)) ? String(req.query.sortBy) : 'createdAt';
    const sort: Record<string, 1 | -1> = { [sortField]: req.query.sortDir === 'asc' ? 1 : -1 };
    const [data, total, globalCommissionRate] = await Promise.all([Vendor.aggregate(vendorPipeline(match, sort, skip, limit)), Vendor.countDocuments(match), getGlobalCommissionRate()]);
    return res.json({ success: true, data, meta: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1), globalCommissionRate } });
  },
  async vendorById(req: Request, res: Response) {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid vendor id' });
    const id = new Types.ObjectId(req.params.id);
    const [vendor] = await Vendor.aggregate(vendorPipeline({ _id: id }, { createdAt: -1 }, 0, 1));
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    const [products, orders, globalCommissionRate] = await Promise.all([
      Product.find({ vendor: id }).populate('category').sort({ createdAt: -1 }).limit(100),
      Order.find({ vendor: id }).populate('customer items.product').sort({ createdAt: -1 }).limit(100),
      getGlobalCommissionRate(),
    ]);
    const paidOrders = orders.filter((order) => order.paymentStatus === 'paid');
    const revenue = paidOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const effectiveCommissionRate = toRate(vendor.commissionRate) ?? globalCommissionRate;
    return res.json({ success: true, data: { vendor, products, orders, stats: { revenue, averageOrderValue: paidOrders.length ? revenue / paidOrders.length : 0, pendingOrders: orders.filter((order) => ['pending', 'confirmed', 'processing'].includes(order.status)).length, deliveredOrders: orders.filter((order) => order.status === 'delivered').length, activeProducts: products.filter((product) => product.status === 'active').length, draftProducts: products.filter((product) => product.status === 'draft').length, archivedProducts: products.filter((product) => product.status === 'archived').length, globalCommissionRate, effectiveCommissionRate, estimatedCommission: revenue * effectiveCommissionRate } } });
  },
  async updateVendorStatus(req: Request, res: Response) {
    if (!['active', 'suspended'].includes(req.body.status)) return res.status(400).json({ success: false, message: 'Invalid vendor status' });
    const data = await Vendor.findByIdAndUpdate(req.params.id, { status: req.body.status, isActive: req.body.status === 'active' }, { new: true, runValidators: true });
    if (!data) return res.status(404).json({ success: false, message: 'Vendor not found' });
    await logAdminAction(getAuth(req)!.userId, 'vendor.status_changed', 'vendor', data.id, { status: data.status });
    return res.json({ success: true, data });
  },
  async updateVendorCommission(req: Request, res: Response) {
    const commissionRate = toRate(req.body.commissionRate);
    if (commissionRate === null) return res.status(400).json({ success: false, message: 'commissionRate must be between 0 and 1' });
    const data = await Vendor.findByIdAndUpdate(req.params.id, { commissionRate }, { new: true, runValidators: true });
    if (!data) return res.status(404).json({ success: false, message: 'Vendor not found' });
    await logAdminAction(getAuth(req)!.userId, 'vendor.commission_changed', 'vendor', data.id, { commissionRate });
    return res.json({ success: true, data });
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
