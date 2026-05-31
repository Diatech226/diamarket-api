import fs from 'fs/promises';
import path from 'path';
import { Request, Response } from 'express';
import { Media } from '../models/media.model';
import { LocalUpload, uploadsRoot } from '../middlewares/local-upload.middleware';

const getAbsoluteUploadPath = (url: string) => {
  if (!url.startsWith('/uploads/')) return null;
  const filename = path.basename(url);
  return path.join(uploadsRoot, filename);
};

export const mediaController = {
  async list(req: Request, res: Response) {
    const page = Number(req.query.page || 1);
    const limit = Math.min(Number(req.query.limit || 60), 100);
    const skip = (page - 1) * limit;
    const filter: Record<string, unknown> = {};
    if (req.query.search) filter.$text = { $search: String(req.query.search) };

    const [items, total] = await Promise.all([
      Media.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      Media.countDocuments(filter),
    ]);

    return res.json({ data: items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  },

  async createFromUrl(req: Request, res: Response) {
    if (!req.body?.url || typeof req.body.url !== 'string') return res.status(400).json({ message: 'url is required' });

    const created = await Media.create({
      url: req.body.url.trim(),
      alt: typeof req.body.alt === 'string' ? req.body.alt.trim() : '',
      originalName: typeof req.body.originalName === 'string' ? req.body.originalName.trim() : req.body.url.trim(),
      source: 'url',
    });

    return res.status(201).json({ data: created });
  },

  async upload(req: Request, res: Response) {
    const upload = (req as Request & { localUpload?: LocalUpload }).localUpload;
    if (!upload) return res.status(400).json({ message: 'No upload received' });

    const auth = (req as Request & { auth?: { userId?: string } }).auth;
    const created = await Media.create({
      filename: upload.filename,
      originalName: upload.originalName,
      mimeType: upload.mimeType,
      size: upload.size,
      url: upload.url,
      alt: typeof req.body?.alt === 'string' ? req.body.alt.trim() : '',
      source: 'upload',
      uploadedBy: auth?.userId,
    });

    return res.status(201).json({ data: created });
  },

  async update(req: Request, res: Response) {
    const payload: Record<string, unknown> = {};
    if (typeof req.body?.alt === 'string') payload.alt = req.body.alt.trim();
    if (typeof req.body?.url === 'string') payload.url = req.body.url.trim();
    if (typeof req.body?.originalName === 'string') payload.originalName = req.body.originalName.trim();

    const updated = await Media.findByIdAndUpdate(req.params.id, payload, { new: true });
    if (!updated) return res.status(404).json({ message: 'Media not found' });
    return res.json({ data: updated });
  },

  async remove(req: Request, res: Response) {
    const deleted = await Media.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Media not found' });

    const localPath = getAbsoluteUploadPath(deleted.url);
    if (localPath) await fs.rm(localPath, { force: true }).catch(() => undefined);

    return res.status(204).send();
  },
};
