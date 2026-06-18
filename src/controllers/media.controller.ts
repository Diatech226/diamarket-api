import fs from 'fs/promises';
import path from 'path';
import { isValidObjectId } from 'mongoose';
import { Request, Response } from 'express';
import { Media, MEDIA_CATEGORIES } from '../models/media.model';
import { LocalUpload, uploadsRoot } from '../middlewares/local-upload.middleware';
import { logAdminAction } from '../services/admin-audit.service';

const allowedSort = new Set(['createdAt', 'updatedAt', 'name', 'size', 'mimeType', 'category', 'usageCount']);
const normalizeTags = (tags: unknown) => Array.isArray(tags) ? tags.map(String).map((t) => t.trim()).filter(Boolean) : typeof tags === 'string' ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
const validCategory = (value: unknown) => MEDIA_CATEGORIES.includes(value as any) ? value : 'other';
const publicMedia = (media: any) => ({ id: String(media._id), _id: media._id, name: media.name, filename: media.filename, originalName: media.originalName, url: media.url, path: media.path, mimeType: media.mimeType, size: media.size, width: media.width, height: media.height, category: media.category, tags: media.tags ?? [], alt: media.alt, description: media.description, source: media.source, usageCount: media.usageCount ?? 0, usedIn: media.usedIn ?? [], createdAt: media.createdAt, updatedAt: media.updatedAt });
const getAbsoluteUploadPath = (mediaPath?: string, url?: string) => {
  const raw = mediaPath || (url?.startsWith('/uploads/media/') ? path.join(uploadsRoot, path.basename(url)) : '');
  if (!raw) return null;
  const absolute = path.resolve(raw);
  return absolute.startsWith(uploadsRoot) ? absolute : null;
};
const isSafeHttpUrl = (value: string) => { try { const parsed = new URL(value); return ['http:', 'https:'].includes(parsed.protocol); } catch { return false; } };

export const mediaController = {
  async list(req: Request, res: Response) {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 24), 1), 100);
    const skip = (page - 1) * limit;
    const filter: Record<string, unknown> = {};
    if (req.query.search) filter.$text = { $search: String(req.query.search) };
    if (req.query.category) filter.category = req.query.category;
    if (req.query.mimeType) filter.mimeType = req.query.mimeType;
    if (req.query.tags) filter.tags = { $all: normalizeTags(req.query.tags) };
    const sortKey = allowedSort.has(String(req.query.sort)) ? String(req.query.sort) : 'createdAt';
    const sortOrder = req.query.order === 'asc' ? 1 : -1;
    const [items, total] = await Promise.all([Media.find(filter).skip(skip).limit(limit).sort({ [sortKey]: sortOrder }), Media.countDocuments(filter)]);
    return res.json({ success: true, data: items.map(publicMedia), pagination: { page, limit, total, pages: Math.ceil(total / limit) }, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  },
  async getById(req: Request, res: Response) {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Identifiant média invalide.' });
    const media = await Media.findById(req.params.id);
    if (!media) return res.status(404).json({ success: false, message: 'Media not found' });
    return res.json({ success: true, data: publicMedia(media), media: publicMedia(media) });
  },
  async createFromUrl(req: Request, res: Response) {
    const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    if (!url) return res.status(400).json({ success: false, message: 'url is required' });
    if (!isSafeHttpUrl(url)) return res.status(400).json({ success: false, message: 'URL média invalide ou non autorisée.' });
    const created = await Media.create({ url, name: String(req.body?.name || req.body?.originalName || url).trim(), alt: typeof req.body?.alt === 'string' ? req.body.alt.trim() : '', description: typeof req.body?.description === 'string' ? req.body.description.trim() : '', originalName: typeof req.body?.originalName === 'string' ? req.body.originalName.trim() : url, category: validCategory(req.body?.category), tags: normalizeTags(req.body?.tags), source: 'url' });
    return res.status(201).json({ success: true, data: publicMedia(created), media: publicMedia(created) });
  },
  async upload(req: Request, res: Response) {
    const upload = (req as Request & { localUpload?: LocalUpload }).localUpload;
    if (!upload) return res.status(400).json({ success: false, message: 'No upload received' });
    const auth = (req as Request & { auth?: { userId?: string } }).auth;
    const created = await Media.create({ name: String(req.body?.name || upload.originalName).trim(), filename: upload.filename, originalName: upload.originalName, mimeType: upload.mimeType, size: upload.size, width: upload.width ?? 0, height: upload.height ?? 0, url: upload.url, path: upload.absolutePath, alt: typeof req.body?.alt === 'string' ? req.body.alt.trim() : '', description: typeof req.body?.description === 'string' ? req.body.description.trim() : '', category: validCategory(req.body?.category), tags: normalizeTags(req.body?.tags), source: 'upload', uploadedBy: auth?.userId });
    return res.status(201).json({ success: true, data: publicMedia(created), media: publicMedia(created) });
  },
  async update(req: Request, res: Response) {
    const payload: Record<string, unknown> = {};
    ['name', 'alt', 'description'].forEach((field) => { if (typeof req.body?.[field] === 'string') payload[field] = req.body[field].trim(); });
    if (req.body?.category !== undefined) payload.category = validCategory(req.body.category);
    if (req.body?.tags !== undefined) payload.tags = normalizeTags(req.body.tags);
    const updated = await Media.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ success: false, message: 'Media not found' });
    return res.json({ success: true, data: publicMedia(updated), media: publicMedia(updated) });
  },
  async remove(req: Request, res: Response) {
    const media = await Media.findById(req.params.id);
    if (!media) return res.status(404).json({ success: false, message: 'Media not found' });
    if ((media.usageCount ?? 0) > 0 && req.query.force !== 'true') return res.status(409).json({ success: false, message: 'Ce média est utilisé par des produits, vendeurs ou slides.' });
    await Media.findByIdAndDelete(req.params.id);
    const localPath = getAbsoluteUploadPath(media.path, media.url);
    if (localPath) await fs.rm(localPath, { force: true }).catch(() => undefined);
    await logAdminAction(String((req as Request & { auth?: { userId?: string } }).auth?.userId || 'unknown'), 'media.delete', 'media', String(media._id), { url: media.url, force: req.query.force === 'true' }).catch(() => undefined);
    return res.json({ success: true, message: 'Média supprimé.' });
  },
};
