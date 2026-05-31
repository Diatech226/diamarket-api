import { Request, Response } from 'express';
import { Category } from '../models/category.model';

export const categoriesController = {
  async list(_req: Request, res: Response) {
    const data = await Category.find().sort({ name: 1 });
    return res.json({ data });
  },
  async create(req: Request, res: Response) {
    const data = await Category.create(req.body);
    return res.status(201).json({ data });
  },
  async update(req: Request, res: Response) {
    const data = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!data) return res.status(404).json({ message: 'Category not found' });
    return res.json({ data });
  },
  async remove(req: Request, res: Response) {
    const data = await Category.findByIdAndDelete(req.params.id);
    if (!data) return res.status(404).json({ message: 'Category not found' });
    return res.status(204).send();
  },
};
