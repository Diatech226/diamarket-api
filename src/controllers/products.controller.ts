import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Product } from '../models/product.model';
import { Category } from '../models/category.model';
import { Vendor } from '../models/vendor.model';
import { getAuth } from '../middlewares/requireAuth';
import { ownerScope } from '../middlewares/resource-access';
import { syncMediaUsage } from '../services/media-usage.service';

const jsonError = (res: Response, status: number, message: string, error?: string) => res.status(status).json({ success: false, message, ...(error ? { error } : {}) });
const isObjectId = (value: unknown) => Types.ObjectId.isValid(String(value));

async function validateProductRelations(category?: unknown, vendor?: unknown) {
  if (category !== undefined) {
    if (!isObjectId(category)) return 'Invalid category id';
    const exists = await Category.exists({ _id: category, active: true });
    if (!exists) return 'Category not found or inactive';
  }
  if (vendor !== undefined) {
    if (!isObjectId(vendor)) return 'Invalid vendor id';
    const exists = await Vendor.exists({ _id: vendor, status: 'active' });
    if (!exists) return 'Vendor not found or inactive';
  }
  return null;
}

export const productsController = {
  async list(req: Request, res: Response) {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { status: 'active' };
    if (req.query.category) {
      if (!isObjectId(req.query.category)) return jsonError(res, 400, 'Invalid category id');
      const activeCategory = await Category.exists({ _id: req.query.category, active: true });
      filter.category = activeCategory ? req.query.category : null;
    } else {
      const activeCategoryIds = await Category.distinct('_id', { active: true });
      filter.category = { $in: activeCategoryIds };
    }
    if (req.query.vendor) {
      if (!isObjectId(req.query.vendor)) return jsonError(res, 400, 'Invalid vendor id');
      filter.vendor = req.query.vendor;
    }
    if (req.query.isFeatured) filter.isFeatured = req.query.isFeatured === 'true';
    if (req.query.search) filter.$text = { $search: String(req.query.search) };

    const [items, total] = await Promise.all([
      Product.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }).populate('category vendor'),
      Product.countDocuments(filter),
    ]);

    return res.json({ success: true, data: items, meta: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) } });
  },

  async getByIdOrSlug(req: Request, res: Response) {
    const key = req.params.id || req.params.slug;
    const selector = isObjectId(key) ? { _id: key } : { slug: key };
    const item = await Product.findOne({ ...selector, status: 'active' }).populate('category vendor');
    if (!item || (typeof item.category === 'object' && item.category && 'active' in item.category && item.category.active === false)) return jsonError(res, 404, 'Product not found');
    return res.json({ success: true, data: item });
  },

  async create(req: Request, res: Response) {
    const auth = getAuth(req)!;
    if (auth.role === 'vendor' && !auth.vendorId) return jsonError(res, 403, 'Active vendor account required');
    const relationError = await validateProductRelations(req.body.category, auth.role === 'vendor' ? auth.vendorId : req.body.vendor);
    if (relationError) return jsonError(res, 400, 'Validation failed', relationError);
    const existingSlug = await Product.exists({ slug: req.body.slug });
    if (existingSlug) return jsonError(res, 409, 'Validation failed', 'Product slug already exists');
    const created = await Product.create({ ...req.body, vendor: auth.role === 'vendor' ? auth.vendorId : req.body.vendor, ownerUserId: auth.userId });
    await syncMediaUsage('product', created._id, 'images', created.images ?? []);
    return res.status(201).json({ success: true, data: created });
  },

  async update(req: Request, res: Response) {
    const auth = getAuth(req)!;
    const payload = { ...req.body };
    if (auth.role !== 'admin') { delete payload.vendor; delete payload.ownerUserId; }
    if (!isObjectId(req.params.id)) return jsonError(res, 400, 'Invalid product id');
    const relationError = await validateProductRelations(payload.category, payload.vendor);
    if (relationError) return jsonError(res, 400, 'Validation failed', relationError);
    if (payload.slug) {
      const existingSlug = await Product.exists({ slug: payload.slug, _id: { $ne: req.params.id } });
      if (existingSlug) return jsonError(res, 409, 'Validation failed', 'Product slug already exists');
    }
    const previous = await Product.findOne({ _id: req.params.id, ...ownerScope(auth) });
    if (!previous) return jsonError(res, 404, 'Product not found');
    const updated = await Product.findByIdAndUpdate(previous._id, payload, { new: true, runValidators: true });
    if (!updated) return jsonError(res, 404, 'Product not found');
    if (payload.images) await syncMediaUsage('product', updated._id, 'images', updated.images ?? [], previous.images ?? []);
    return res.json({ success: true, data: updated });
  },

  async remove(req: Request, res: Response) {
    if (!isObjectId(req.params.id)) return jsonError(res, 400, 'Invalid product id');
    const deleted = await Product.findOneAndDelete({ _id: req.params.id, ...ownerScope(getAuth(req)!) });
    if (!deleted) return jsonError(res, 404, 'Product not found');
    await syncMediaUsage('product', deleted._id, 'images', [], deleted.images ?? []);
    return res.status(204).send();
  },
};
