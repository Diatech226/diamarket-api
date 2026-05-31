import { Request, Response } from 'express';
import { Product } from '../models/product.model';

export const productsController = {
  async list(req: Request, res: Response) {
    const page = Number(req.query.page || 1);
    const limit = Math.min(Number(req.query.limit || 20), 100);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.vendor) filter.vendor = req.query.vendor;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.isFeatured) filter.isFeatured = req.query.isFeatured === 'true';
    if (req.query.search) filter.$text = { $search: String(req.query.search) };

    const [items, total] = await Promise.all([
      Product.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }).populate('category vendor'),
      Product.countDocuments(filter),
    ]);

    return res.json({ data: items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  },

  async getBySlug(req: Request, res: Response) {
    const item = await Product.findOne({ slug: req.params.slug }).populate('category vendor');
    if (!item) return res.status(404).json({ message: 'Product not found' });
    return res.json({ data: item });
  },

  async create(req: Request, res: Response) {
    const created = await Product.create(req.body);
    return res.status(201).json({ data: created });
  },

  async update(req: Request, res: Response) {
    const updated = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: 'Product not found' });
    return res.json({ data: updated });
  },

  async remove(req: Request, res: Response) {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Product not found' });
    return res.status(204).send();
  },
};
