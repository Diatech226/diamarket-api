import { Schema, model } from 'mongoose';

export const MEDIA_SOURCES = ['upload', 'url'] as const;

const MediaSchema = new Schema(
  {
    filename: { type: String, trim: true },
    originalName: { type: String, trim: true },
    mimeType: { type: String, trim: true },
    size: { type: Number, min: 0, default: 0 },
    url: { type: String, required: true, trim: true },
    alt: { type: String, trim: true, default: '' },
    source: { type: String, enum: MEDIA_SOURCES, default: 'upload', index: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  },
  { timestamps: true },
);

MediaSchema.index({ originalName: 'text', alt: 'text', url: 'text' });

export const Media = model('Media', MediaSchema);
