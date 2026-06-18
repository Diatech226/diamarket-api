import { Request, Response } from 'express';
import { isValidObjectId, PipelineStage } from 'mongoose';
import { Category } from '../models/category.model';
import { Product } from '../models/product.model';
import { syncMediaUsage } from '../services/media-usage.service';

const normalizeCategoryPayload = (body: Record<string, unknown>) => ({
  name: typeof body.name === 'string' ? body.name.trim() : body.name,
  slug: typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : body.slug,
  description: typeof body.description === 'string' ? body.description.trim() : body.description,
  active: body.active,
  order: body.order,
  image: typeof body.image === 'string' ? body.image.trim() : body.image,
  icon: typeof body.icon === 'string' ? body.icon.trim() : body.icon,
});

const categoryListPipeline = (match: Record<string, unknown>, skip?: number, limit?: number) => {
  const pipeline: PipelineStage[] = [
    { $match: match },
    { $lookup: { from: 'products', localField: '_id', foreignField: 'category', as: 'products' } },
    { $addFields: { productCount: { $size: '$products' } } },
    { $project: { products: 0 } },
    { $sort: { order: 1, name: 1 } },
  ];
  if (skip !== undefined) pipeline.push({ $skip: skip });
  if (limit !== undefined) pipeline.push({ $limit: limit });
  return pipeline;
};

function readableError(error: unknown) {
  const err = error as { code?: number; keyPattern?: Record<string, unknown>; message?: string };
  if (err.code === 11000 && err.keyPattern?.slug) return 'Une catégorie avec ce slug existe déjà.';
  return err.message || 'Erreur catégorie';
}

export const categoriesController = {
  async list(_req: Request, res: Response) {
    const data = await Category.aggregate(categoryListPipeline({ active: true }));
    return res.json({ success: true, data });
  },

  async adminList(req: Request, res: Response) {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
    const skip = (page - 1) * limit;
    const filter: Record<string, unknown> = {};
    if (req.query.status === 'active') filter.active = true;
    if (req.query.status === 'inactive') filter.active = false;
    if (req.query.search) {
      const search = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [{ name: new RegExp(search, 'i') }, { slug: new RegExp(search, 'i') }];
    }

    const [data, total] = await Promise.all([
      Category.aggregate(categoryListPipeline(filter, skip, limit)),
      Category.countDocuments(filter),
    ]);

    return res.json({ success: true, data, meta: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) } });
  },

  async create(req: Request, res: Response) {
    try {
      const data = await Category.create(normalizeCategoryPayload(req.body));
      await syncMediaUsage('category', data._id, 'image', [data.image]);
      await syncMediaUsage('category', data._id, 'icon', [data.icon]);
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return res.status(400).json({ success: false, message: readableError(error) });
    }
  },

  async update(req: Request, res: Response) {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Identifiant catégorie invalide.' });
    try {
      const previous = await Category.findById(req.params.id);
      const data = await Category.findByIdAndUpdate(req.params.id, normalizeCategoryPayload(req.body), { new: true, runValidators: true });
      if (!data) return res.status(404).json({ success: false, message: 'Catégorie introuvable.' });
      await syncMediaUsage('category', data._id, 'image', [data.image], [previous?.image]);
      await syncMediaUsage('category', data._id, 'icon', [data.icon], [previous?.icon]);
      return res.json({ success: true, data });
    } catch (error) {
      return res.status(400).json({ success: false, message: readableError(error) });
    }
  },

  async remove(req: Request, res: Response) {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Identifiant catégorie invalide.' });
    const productCount = await Product.countDocuments({ category: req.params.id });
    if (productCount > 0) return res.status(409).json({ success: false, message: `Suppression impossible : ${productCount} produit(s) utilisent cette catégorie. Désactivez-la plutôt.` });
    const data = await Category.findByIdAndDelete(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'Catégorie introuvable.' });
    return res.status(204).send();
  },
};
