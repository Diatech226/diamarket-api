import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { AdminAuditLog, Category, Order, Product, Setting, User, Vendor, VendorRequest } from '../models';
import { getAuth } from '../middlewares/requireAuth';
import { logAdminAction } from '../services/admin-audit.service';
import { getDefaultCommissionRate } from '../services/commission.service';

const settingDefinitions: Record<string, { group: string; isPublic: boolean; type: 'string' | 'number' | 'boolean' | 'object' }> = {
  marketplaceName: { group: 'general', isPublic: true, type: 'string' },
  defaultCurrency: { group: 'general', isPublic: true, type: 'string' },
  defaultLanguage: { group: 'general', isPublic: true, type: 'string' },
  primaryCountry: { group: 'general', isPublic: true, type: 'string' },
  defaultCommission: { group: 'vendors', isPublic: false, type: 'number' },
  logo: { group: 'branding', isPublic: true, type: 'string' },
  favicon: { group: 'branding', isPublic: true, type: 'string' },
  supportContact: { group: 'contact', isPublic: true, type: 'string' },
  supportEmail: { group: 'contact', isPublic: true, type: 'string' },
  supportPhone: { group: 'contact', isPublic: true, type: 'string' },
  companyAddress: { group: 'contact', isPublic: true, type: 'string' },
  maintenanceMode: { group: 'maintenance', isPublic: true, type: 'boolean' },
  maintenanceMessage: { group: 'maintenance', isPublic: true, type: 'string' },
  maintenanceImage: { group: 'maintenance', isPublic: true, type: 'string' },
  socialLinks: { group: 'social', isPublic: true, type: 'object' },
  seo: { group: 'seo', isPublic: true, type: 'object' },
  checkout: { group: 'checkout', isPublic: true, type: 'object' },
  shipping: { group: 'shipping', isPublic: true, type: 'object' },
  vendors: { group: 'vendors', isPublic: true, type: 'object' },
  homepage: { group: 'general', isPublic: true, type: 'object' },
};
const allowedSettings = Object.keys(settingDefinitions);
const secretKeyPattern = /(secret|password|mongodb|uri|token|api[_-]?key|jwt)/i;
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

  async auditLogs(req: Request, res: Response) {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
    const skip = (page - 1) * limit;
    const filter: Record<string, unknown> = {};
    const search = String(req.query.search || '').trim();
    if (req.query.action) filter.action = new RegExp(String(req.query.action), 'i');
    if (req.query.resource) filter.resource = new RegExp(String(req.query.resource), 'i');
    if (search) filter.$or = [{ action: new RegExp(search, 'i') }, { resource: new RegExp(search, 'i') }, { resourceId: new RegExp(search, 'i') }];
    const [data, total] = await Promise.all([
      AdminAuditLog.find(filter).populate('actorId', 'name email role').sort({ createdAt: -1 }).skip(skip).limit(limit),
      AdminAuditLog.countDocuments(filter),
    ]);
    return res.json({ success: true, data, meta: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) } });
  },
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
    if (req.query.category) {
      if (!Types.ObjectId.isValid(String(req.query.category))) return res.status(400).json({ success: false, message: 'Invalid category id' });
      filter.category = req.query.category;
    }
    if (req.query.vendor) {
      if (!Types.ObjectId.isValid(String(req.query.vendor))) return res.status(400).json({ success: false, message: 'Invalid vendor id' });
      filter.vendor = req.query.vendor;
    }
    if (req.query.search) filter.$text = { $search: String(req.query.search) };
    const [items, total] = await Promise.all([Product.find(filter).skip(skip).limit(limit).populate('category vendor').sort({ createdAt: -1 }), Product.countDocuments(filter)]);
    return res.json({ success: true, data: items, meta: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) } });
  },
  async categories(_req: Request, res: Response) { return res.json({ data: await Category.find().sort({ order: 1, name: 1 }) }); },
  async users(req: Request, res: Response) {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
    const skip = (page - 1) * limit;
    const filter: Record<string, unknown> = {};
    const search = String(req.query.search || '').trim();
    if (req.query.role && ['admin', 'vendor', 'user'].includes(String(req.query.role))) filter.role = req.query.role;
    if (req.query.status === 'active') filter.disabled = { $ne: true };
    if (req.query.status === 'disabled') filter.disabled = true;
    if (search) filter.$or = [{ email: new RegExp(search, 'i') }, { name: new RegExp(search, 'i') }];
    const [data, total] = await Promise.all([
      User.find(filter).select('-passwordHash').sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);
    return res.json({ success: true, data, meta: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) } });
  },
  async userById(req: Request, res: Response) {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid user id' });
    const [user, orders, vendor] = await Promise.all([
      User.findById(req.params.id).select('-passwordHash'),
      Order.find({ customer: req.params.id }).populate('vendor items.product').sort({ createdAt: -1 }).limit(100),
      Vendor.findOne({ userId: req.params.id }),
    ]);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.json({ success: true, data: { user, orders, vendor } });
  },
  async updateUserRole(req: Request, res: Response) {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid user id' });
    if (!['admin', 'vendor', 'user'].includes(req.body.role)) return res.status(400).json({ success: false, message: 'Invalid role' });
    const user = await User.findById(req.params.id).select('-passwordHash');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const previousRole = user.role;
    if (previousRole === 'admin' && req.body.role !== 'admin' && await User.countDocuments({ role: 'admin', disabled: { $ne: true } }) <= 1) {
      return res.status(409).json({ success: false, message: 'Impossible de retirer le rôle du dernier admin actif' });
    }
    user.role = req.body.role;
    await user.save();
    await logAdminAction(getAuth(req)!.userId, 'user.role_changed', 'user', user.id, { previousRole, newRole: user.role });
    return res.json({ success: true, data: user });
  },
  async updateUserStatus(req: Request, res: Response) {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid user id' });
    if (typeof req.body.disabled !== 'boolean') return res.status(400).json({ success: false, message: 'disabled must be a boolean' });
    const user = await User.findById(req.params.id).select('-passwordHash');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'admin' && req.body.disabled && await User.countDocuments({ role: 'admin', disabled: { $ne: true } }) <= 1) {
      return res.status(409).json({ success: false, message: 'Impossible de désactiver le dernier admin actif' });
    }
    const previousDisabled = user.disabled;
    user.disabled = req.body.disabled;
    await user.save();
    await logAdminAction(getAuth(req)!.userId, 'user.status_changed', 'user', user.id, { previousDisabled, disabled: user.disabled });
    return res.json({ success: true, data: user });
  },
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

  async updateVendor(req: Request, res: Response) {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid vendor id' });
    const allowed = ['shopName', 'phone', 'country', 'city', 'status', 'commissionRate'];
    const update = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)));
    if (update.status && !vendorStatuses.includes(String(update.status))) return res.status(400).json({ success: false, message: 'Invalid vendor status' });
    const data = await Vendor.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!data) return res.status(404).json({ success: false, message: 'Vendor not found' });
    await logAdminAction(getAuth(req)!.userId, 'vendor.updated', 'vendor', data.id, { fields: Object.keys(update) });
    return res.json({ success: true, data });
  },
  async vendorCatalog(req: Request, res: Response) {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid vendor id' });
    const filter: Record<string, unknown> = { vendor: req.params.id };
    if (req.query.status && ['draft', 'active', 'archived'].includes(String(req.query.status))) filter.status = req.query.status;
    if (req.query.search) filter.$text = { $search: String(req.query.search) };
    const data = await Product.find(filter).populate('category vendor').sort({ createdAt: -1 }).limit(100);
    return res.json({ success: true, data, meta: { message: 'Vendor-scoped catalog; product mutations continue to use product endpoints.' } });
  },
  async vendorOrders(req: Request, res: Response) {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid vendor id' });
    const data = await Order.find({ vendor: req.params.id }).populate('customer items.product').sort({ createdAt: -1 }).limit(100);
    return res.json({ success: true, data });
  },
  async vendorCustomers(req: Request, res: Response) {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid vendor id' });
    const orders = await Order.find({ vendor: req.params.id }).populate('customer').sort({ createdAt: -1 }).limit(200);
    const map = new Map<string, { customer: unknown; orders: number; revenue: number; lastOrderAt?: Date }>();
    for (const order of orders) { const key = String(order.customer?._id ?? order.customer ?? 'guest'); const row = map.get(key) ?? { customer: order.customer ?? { name: 'Client invité' }, orders: 0, revenue: 0 }; row.orders += 1; row.revenue += order.totalAmount || 0; row.lastOrderAt = order.createdAt; map.set(key, row); }
    return res.json({ success: true, data: Array.from(map.values()) });
  },
  async vendorAnalytics(req: Request, res: Response) {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid vendor id' });
    const orders = await Order.find({ vendor: req.params.id }).sort({ createdAt: -1 }).limit(500);
    const paid = orders.filter((order) => order.paymentStatus === 'paid');
    const revenue = paid.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    return res.json({ success: true, data: { sales: paid.length, revenue, orders: orders.length, newCustomers: new Set(orders.map((order) => String(order.customer))).size, conversion: 0, traffic: [], popularProducts: [], averageOrderValue: paid.length ? revenue / paid.length : 0, countries: [], aiInsights: { status: 'planned', message: 'Future IA statistics contract is reserved.' } } });
  },
  async vendorDocuments(req: Request, res: Response) {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid vendor id' });
    return res.json({ success: true, data: [], meta: { storage: 'secure-storage-planned', categories: ['kyc', 'business_registry', 'identity', 'certificate', 'contract', 'invoice'] } });
  },
  async updateVendorStatus(req: Request, res: Response) {
    if (!['active', 'suspended'].includes(req.body.status)) return res.status(400).json({ success: false, message: 'Invalid vendor status' });
    const data = await Vendor.findByIdAndUpdate(req.params.id, { status: req.body.status, isActive: req.body.status === 'active' }, { new: true, runValidators: true });
    if (!data) return res.status(404).json({ success: false, message: 'Vendor not found' });
    await logAdminAction(getAuth(req)!.userId, 'vendor.status_changed', 'vendor', data.id, { status: data.status });
    return res.json({ success: true, data });
  },
  async commissions(_req: Request, res: Response) {
    const [defaultRate, vendors, categories] = await Promise.all([getDefaultCommissionRate(), Vendor.find().select('shopName commissionRate status').sort({ shopName: 1 }), Category.find().select('name slug commissionRate active').sort({ name: 1 })]);
    return res.json({ success: true, data: { defaultRate, priority: ['product', 'vendor', 'category', 'global'], vendors, categories } });
  },
  async updateDefaultCommission(req: Request, res: Response) {
    const commissionRate = toRate(Number(req.body.commissionRate) > 1 ? Number(req.body.commissionRate) / 100 : req.body.commissionRate);
    if (commissionRate === null) return res.status(400).json({ success: false, message: 'commissionRate must be between 0 and 1' });
    const data = await Setting.findOneAndUpdate({ key: 'defaultCommission' }, { key: 'defaultCommission', value: commissionRate, scope: 'global' }, { new: true, upsert: true });
    await logAdminAction(getAuth(req)!.userId, 'commission.default_changed', 'commission', data.id, { commissionRate });
    return res.json({ success: true, data: { defaultRate: commissionRate } });
  },
  async updateCategoryCommission(req: Request, res: Response) {
    const commissionRate = req.body.commissionRate === null || req.body.commissionRate === '' ? undefined : toRate(Number(req.body.commissionRate) > 1 ? Number(req.body.commissionRate) / 100 : req.body.commissionRate);
    if (commissionRate === null) return res.status(400).json({ success: false, message: 'commissionRate must be between 0 and 1' });
    const update = commissionRate === undefined ? { $unset: { commissionRate: 1 } } : { $set: { commissionRate } };
    const data = await Category.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!data) return res.status(404).json({ success: false, message: 'Category not found' });
    await logAdminAction(getAuth(req)!.userId, 'category.commission_changed', 'category', data.id, { commissionRate });
    return res.json({ success: true, data });
  },
  async updateVendorCommission(req: Request, res: Response) {
    const commissionRate = toRate(Number(req.body.commissionRate) > 1 ? Number(req.body.commissionRate) / 100 : req.body.commissionRate);
    if (commissionRate === null) return res.status(400).json({ success: false, message: 'commissionRate must be between 0 and 1' });
    const data = await Vendor.findByIdAndUpdate(req.params.id, { commissionRate }, { new: true, runValidators: true });
    if (!data) return res.status(404).json({ success: false, message: 'Vendor not found' });
    await logAdminAction(getAuth(req)!.userId, 'vendor.commission_changed', 'vendor', data.id, { commissionRate });
    return res.json({ success: true, data });
  },
  async settings(_req: Request, res: Response) {
    const rows = await Setting.find({ key: { $in: allowedSettings } });
    return res.json({ success: true, data: Object.fromEntries(rows.map((row) => [row.key, row.value])) });
  },
  async updateSettings(req: Request, res: Response) {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return res.status(400).json({ success: false, message: 'Invalid settings payload' });
    const entries = Object.entries(req.body).filter(([key]) => allowedSettings.includes(key) && !secretKeyPattern.test(key));
    const rejected = Object.keys(req.body).filter((key) => !allowedSettings.includes(key) || secretKeyPattern.test(key));
    if (rejected.length) return res.status(400).json({ success: false, message: `Unsupported or sensitive setting: ${rejected[0]}` });
    const changes = [];
    for (const [key, value] of entries) {
      const definition = settingDefinitions[key];
      if (definition.type === 'string' && typeof value !== 'string') return res.status(400).json({ success: false, message: `${key} must be a string` });
      if (definition.type === 'boolean' && typeof value !== 'boolean') return res.status(400).json({ success: false, message: `${key} must be a boolean` });
      if (definition.type === 'number' && (!Number.isFinite(Number(value)) || Number(value) < 0 || (key === 'defaultCommission' && Number(value) > 1))) return res.status(400).json({ success: false, message: `${key} must be a valid number` });
      if (definition.type === 'object' && (typeof value !== 'object' || value === null || Array.isArray(value))) return res.status(400).json({ success: false, message: `${key} must be an object` });
      if (key === 'supportEmail' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) return res.status(400).json({ success: false, message: 'supportEmail must be a valid email' });
      const previous = await Setting.findOne({ key });
      await Setting.findOneAndUpdate({ key }, { value, group: definition.group, isPublic: definition.isPublic, updatedBy: getAuth(req)!.userId }, { upsert: true, new: true, runValidators: true });
      if (JSON.stringify(previous?.value) !== JSON.stringify(value)) changes.push({ field: key, oldValue: previous?.value, newValue: value });
    }
    if (changes.length) await logAdminAction(getAuth(req)!.userId, 'settings.updated', 'settings', undefined, { changes });
    return adminController.settings(req, res);
  },
};
