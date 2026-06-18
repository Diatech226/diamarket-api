import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';

export type LocalUpload = { filename: string; originalName: string; mimeType: string; size: number; url: string; absolutePath: string; width?: number; height?: number };

const extensionByMimeType: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const uploadsRoot = path.resolve(__dirname, '../../', env.mediaUploadDir);

function parseDataUrl(dataUrl: string) { const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/); return match ? { mimeType: match[1], buffer: Buffer.from(match[2], 'base64') } : null; }
function imageDimensions(buffer: Buffer, mimeType: string) {
  if (mimeType === 'image/png' && buffer.length >= 24) return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  if (mimeType === 'image/webp' && buffer.toString('ascii', 0, 4) === 'RIFF') {
    const type = buffer.toString('ascii', 12, 16);
    if (type === 'VP8X' && buffer.length >= 30) return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
  }
  if (mimeType === 'image/jpeg') {
    let offset = 2;
    while (offset < buffer.length) { if (buffer[offset] !== 0xff) break; const marker = buffer[offset + 1]; const length = buffer.readUInt16BE(offset + 2); if (marker >= 0xc0 && marker <= 0xc3) return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) }; offset += 2 + length; }
  }
  return { width: 0, height: 0 };
}

export async function localImageUpload(req: Request, res: Response, next: NextFunction) {
  try {
    const { fileName, dataUrl } = req.body ?? {};
    if (!dataUrl || typeof dataUrl !== 'string') return res.status(400).json({ success: false, message: 'dataUrl is required for local uploads' });
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) return res.status(400).json({ success: false, message: 'Invalid dataUrl format' });
    if (!env.mediaAllowedTypes.includes(parsed.mimeType)) return res.status(415).json({ success: false, message: 'Unsupported image type' });
    const maxBytes = env.mediaMaxSizeMb * 1024 * 1024;
    if (parsed.buffer.byteLength > maxBytes) return res.status(413).json({ success: false, message: `Image exceeds ${env.mediaMaxSizeMb}MB limit` });
    await fs.mkdir(uploadsRoot, { recursive: true });
    const safeBaseName = String(fileName || 'media').replace(/\.[a-z0-9]+$/i, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/(^-|-$)/g, '') || 'media';
    const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${safeBaseName}.${extensionByMimeType[parsed.mimeType]}`;
    const absolutePath = path.join(uploadsRoot, filename);
    if (!absolutePath.startsWith(uploadsRoot)) return res.status(400).json({ success: false, message: 'Invalid upload path' });
    await fs.writeFile(absolutePath, parsed.buffer, { flag: 'wx' });
    const dimensions = imageDimensions(parsed.buffer, parsed.mimeType);
    (req as Request & { localUpload?: LocalUpload }).localUpload = { filename, originalName: String(fileName || filename), mimeType: parsed.mimeType, size: parsed.buffer.byteLength, url: `/uploads/media/${filename}`, absolutePath, ...dimensions };
    return next();
  } catch (error) { return next(error); }
}
