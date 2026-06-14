import { Request, Response } from 'express';
import { Project, PROJECT_STATUSES } from '../models/project.model';
import { getAuth } from '../middlewares/requireAuth';
import { ownerScope } from '../middlewares/resource-access';

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'project';
}

async function uniqueProjectSlug(baseSlug: string, currentId?: string) {
  let candidate = baseSlug;
  let suffix = 2;
  while (await Project.exists({ slug: candidate, ...(currentId ? { _id: { $ne: currentId } } : {}) })) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function compactStringArray(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function cleanProjectPayload(body: Record<string, unknown>, requireTitle: boolean) {
  const payload: Record<string, unknown> = {};
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (requireTitle && !title) throw new Error('title is required');
  if (title) payload.title = title;

  for (const field of ['description', 'category', 'coverImageUrl'] as const) {
    if (typeof body[field] === 'string') payload[field] = body[field].trim();
  }

  if (typeof body.status === 'string' && PROJECT_STATUSES.includes(body.status as (typeof PROJECT_STATUSES)[number])) payload.status = body.status;
  if (typeof body.isFeatured === 'boolean') payload.isFeatured = body.isFeatured;

  for (const field of ['links', 'galleryImageUrls'] as const) {
    const values = compactStringArray(body[field]);
    if (values) payload[field] = values;
  }

  for (const field of ['coverMedia', 'galleryMedia', 'media'] as const) {
    if (body[field] !== undefined) payload[field] = body[field];
  }

  for (const field of ['startDate', 'endDate'] as const) {
    if (typeof body[field] === 'string' && body[field]) payload[field] = new Date(body[field]);
    if (body[field] === null || body[field] === '') payload[field] = undefined;
  }

  const slugSource = typeof body.slug === 'string' && body.slug.trim() ? body.slug.trim() : title;
  if (slugSource) payload.slug = slugify(slugSource);

  return payload;
}

export const projectsController = {
  async list(req: Request, res: Response) {
    const page = Number(req.query.page || 1);
    const limit = Math.min(Number(req.query.limit || 30), 100);
    const skip = (page - 1) * limit;
    const filter: Record<string, unknown> = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.search) filter.$text = { $search: String(req.query.search) };

    const [items, total] = await Promise.all([
      Project.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }).populate('coverMedia galleryMedia media'),
      Project.countDocuments(filter),
    ]);

    return res.json({ data: items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  },

  async getById(req: Request, res: Response) {
    const item = await Project.findById(req.params.id).populate('coverMedia galleryMedia media');
    if (!item) return res.status(404).json({ message: 'Project not found' });
    return res.json({ data: item });
  },

  async create(req: Request, res: Response) {
    try {
      const payload = cleanProjectPayload(req.body ?? {}, true);
      if (typeof payload.slug === 'string') payload.slug = await uniqueProjectSlug(payload.slug);
      const auth = (req as Request & { auth?: { userId?: string } }).auth;
      if (auth?.userId) payload.ownerUserId = auth.userId;
      const created = await Project.create(payload);
      const populated = await created.populate('coverMedia galleryMedia media');
      return res.status(201).json({ data: populated });
    } catch (error) {
      if (error instanceof Error && error.message === 'title is required') return res.status(400).json({ message: error.message });
      throw error;
    }
  },

  async update(req: Request, res: Response) {
    const payload = cleanProjectPayload(req.body ?? {}, false);
    if (typeof payload.slug === 'string') payload.slug = await uniqueProjectSlug(payload.slug, req.params.id);
    const updated = await Project.findOneAndUpdate({ _id: req.params.id, ...ownerScope(getAuth(req)!) }, payload, { new: true, runValidators: true }).populate('coverMedia galleryMedia media');
    if (!updated) return res.status(404).json({ message: 'Project not found' });
    return res.json({ data: updated });
  },

  async remove(req: Request, res: Response) {
    const deleted = await Project.findOneAndDelete({ _id: req.params.id, ...ownerScope(getAuth(req)!) });
    if (!deleted) return res.status(404).json({ message: 'Project not found' });
    return res.status(204).send();
  },
};
