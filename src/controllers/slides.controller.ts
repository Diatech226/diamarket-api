import { Request, Response } from 'express';
import { Slide } from '../models/slide.model';

const serializeSlide = (slide: any) => ({
  id: String(slide._id ?? slide.id),
  _id: slide._id,
  title: slide.title ?? '',
  subtitle: slide.subtitle ?? '',
  imageUrl: slide.imageUrl ?? '',
  cta: slide.cta ?? slide.ctaUrl ?? '',
  ctaUrl: slide.ctaUrl ?? slide.cta ?? '',
  isActive: slide.isActive !== false,
  translations: slide.translations ?? {},
  createdAt: slide.createdAt,
  updatedAt: slide.updatedAt,
});

export const slidesController = {
  async list(_req: Request, res: Response) {
    const slides = await Slide.find({ isActive: { $ne: false } }).sort({ createdAt: -1 });
    return res.json({ success: true, data: slides.map(serializeSlide) });
  },

  async getById(req: Request, res: Response) {
    const slide = await Slide.findById(req.params.id);
    if (!slide || slide.isActive === false) return res.status(404).json({ success: false, message: 'Slide not found' });
    return res.json({ success: true, data: serializeSlide(slide) });
  },

  async create(req: Request, res: Response) {
    const slide = await Slide.create(req.body);
    return res.status(201).json({ success: true, data: serializeSlide(slide) });
  },

  async update(req: Request, res: Response) {
    const slide = await Slide.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!slide) return res.status(404).json({ success: false, message: 'Slide not found' });
    return res.json({ success: true, data: serializeSlide(slide) });
  },

  async remove(req: Request, res: Response) {
    const slide = await Slide.findByIdAndDelete(req.params.id);
    if (!slide) return res.status(404).json({ success: false, message: 'Slide not found' });
    return res.status(204).send();
  },
};
