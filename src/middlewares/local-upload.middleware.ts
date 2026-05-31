import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { NextFunction, Request, Response } from 'express';

export type LocalUpload = {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  absolutePath: string;
};

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']);
const extensionByMimeType: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

export const uploadsRoot = path.resolve(__dirname, '../../uploads');

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], buffer: Buffer.from(match[2], 'base64') };
}

export async function localImageUpload(req: Request, res: Response, next: NextFunction) {
  try {
    const { fileName, dataUrl } = req.body ?? {};
    if (!dataUrl || typeof dataUrl !== 'string') {
      return res.status(400).json({ message: 'dataUrl is required for local uploads' });
    }

    const parsed = parseDataUrl(dataUrl);
    if (!parsed) return res.status(400).json({ message: 'Invalid dataUrl format' });
    if (!allowedMimeTypes.has(parsed.mimeType)) return res.status(415).json({ message: 'Unsupported image type' });

    const maxBytes = 8 * 1024 * 1024;
    if (parsed.buffer.byteLength > maxBytes) return res.status(413).json({ message: 'Image exceeds 8MB limit' });

    await fs.mkdir(uploadsRoot, { recursive: true });
    const extension = extensionByMimeType[parsed.mimeType] ?? 'bin';
    const safeBaseName = String(fileName || 'media')
      .replace(/\.[a-z0-9]+$/i, '')
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'media';
    const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${safeBaseName}.${extension}`;
    const absolutePath = path.join(uploadsRoot, filename);
    await fs.writeFile(absolutePath, parsed.buffer);

    (req as Request & { localUpload?: LocalUpload }).localUpload = {
      filename,
      originalName: String(fileName || filename),
      mimeType: parsed.mimeType,
      size: parsed.buffer.byteLength,
      url: `/uploads/${filename}`,
      absolutePath,
    };

    return next();
  } catch (error) {
    return next(error);
  }
}
