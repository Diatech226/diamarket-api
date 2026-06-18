import { Request, Response } from 'express';
import { Slide } from '../models/slide.model';
import { syncMediaUsage } from '../services/media-usage.service';

const isPublicRequest = (req: Request) => !req.path.startsWith('/admin/');
const isValidUrl = (value?: string) => !value || value.startsWith('/') || /^https?:\/\//i.test(value);
const campaignFilter = (now = new Date()) => ({ isActive: { $ne: false }, $and: [{ $or: [{ startDate: null }, { startDate: { $exists: false } }, { startDate: { $lte: now } }] }, { $or: [{ endDate: null }, { endDate: { $exists: false } }, { endDate: { $gte: now } }] }] });
const slideImages = (slide: any) => [slide.imageDesktop, slide.imageMobile, slide.imageUrl].filter(Boolean);

const normalizePayload = async (body: any, id?: string) => {
  const payload: any = { ...body };
  if (payload.imageUrl && !payload.imageDesktop) payload.imageDesktop = payload.imageUrl;
  if (payload.imageDesktop && !payload.imageUrl) payload.imageUrl = payload.imageDesktop;
  if (payload.ctaUrl && !payload.ctaLink) payload.ctaLink = payload.ctaUrl;
  if (payload.ctaLink && !payload.ctaUrl) payload.ctaUrl = payload.ctaLink;
  if (payload.cta && !payload.ctaLabel) payload.ctaLabel = payload.cta;
  if (payload.startDate === '') payload.startDate = null;
  if (payload.endDate === '') payload.endDate = null;
  if (!id && (payload.position === undefined || payload.position === null || payload.position === '')) payload.position = await Slide.countDocuments();
  return payload;
};

const validateSlide = (payload: any, partial = false) => {
  if (!partial || payload.title !== undefined) if (!String(payload.title ?? '').trim()) return 'Le titre est obligatoire.';
  const image = payload.imageDesktop ?? payload.imageUrl;
  if (!partial || image !== undefined) if (!String(image ?? '').trim()) return 'Une image desktop est obligatoire.';
  for (const key of ['imageDesktop', 'imageMobile', 'imageUrl', 'ctaLink', 'ctaUrl']) if (!isValidUrl(payload[key])) return `${key} doit être une URL http(s) ou relative valide.`;
  if (payload.startDate && payload.endDate && new Date(payload.startDate) > new Date(payload.endDate)) return 'La date de début doit précéder la date de fin.';
  return null;
};

const serializeSlide = (slide: any) => ({
  id: String(slide._id ?? slide.id), _id: slide._id,
  title: slide.title ?? '', subtitle: slide.subtitle ?? '', description: slide.description ?? '',
  imageDesktop: slide.imageDesktop ?? slide.imageUrl ?? '', imageMobile: slide.imageMobile ?? '', imageUrl: slide.imageUrl ?? slide.imageDesktop ?? '',
  ctaLabel: slide.ctaLabel ?? '', ctaLink: slide.ctaLink ?? slide.ctaUrl ?? '', cta: slide.cta ?? slide.ctaLabel ?? '', ctaUrl: slide.ctaUrl ?? slide.ctaLink ?? '',
  badge: slide.badge ?? '', backgroundColor: slide.backgroundColor ?? '', position: slide.position ?? 0, isActive: slide.isActive !== false,
  startDate: slide.startDate, endDate: slide.endDate, translations: slide.translations ?? {}, createdAt: slide.createdAt, updatedAt: slide.updatedAt,
});

export const slidesController = {
  async list(req: Request, res: Response) {
    const query = isPublicRequest(req) ? campaignFilter() : {};
    const slides = await Slide.find(query).sort({ position: 1, createdAt: -1 });
    return res.json({ success: true, data: slides.map(serializeSlide) });
  },
  async getById(req: Request, res: Response) {
    const slide = await Slide.findOne({ _id: req.params.id, ...(isPublicRequest(req) ? campaignFilter() : {}) });
    if (!slide) return res.status(404).json({ success: false, message: 'Slide not found' });
    return res.json({ success: true, data: serializeSlide(slide) });
  },
  async create(req: Request, res: Response) {
    const payload = await normalizePayload(req.body);
    const error = validateSlide(payload);
    if (error) return res.status(400).json({ success: false, message: error });
    const slide = await Slide.create(payload);
    await syncMediaUsage('slide', slide._id, 'images', slideImages(slide));
    return res.status(201).json({ success: true, data: serializeSlide(slide) });
  },
  async update(req: Request, res: Response) {
    const previous = await Slide.findById(req.params.id);
    if (!previous) return res.status(404).json({ success: false, message: 'Slide not found' });
    const payload = await normalizePayload(req.body, req.params.id);
    const merged = { ...previous.toObject(), ...payload };
    const error = validateSlide(merged, false);
    if (error) return res.status(400).json({ success: false, message: error });
    const slide = await Slide.findByIdAndUpdate(req.params.id, payload, { new: true });
    await syncMediaUsage('slide', slide!._id, 'images', slideImages(slide), slideImages(previous));
    return res.json({ success: true, data: serializeSlide(slide) });
  },
  async remove(req: Request, res: Response) {
    const slide = await Slide.findByIdAndDelete(req.params.id);
    if (!slide) return res.status(404).json({ success: false, message: 'Slide not found' });
    await syncMediaUsage('slide', slide._id, 'images', [], slideImages(slide));
    return res.status(204).send();
  },
};
