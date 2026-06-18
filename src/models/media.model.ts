import { Schema, model } from 'mongoose';

export const MEDIA_SOURCES = ['upload', 'url'] as const;
export const MEDIA_CATEGORIES = ['product', 'vendor', 'slide', 'category', 'brand', 'marketing', 'document', 'other'] as const;

const UsedInSchema = new Schema(
  {
    resourceType: { type: String, trim: true, required: true },
    resourceId: { type: Schema.Types.ObjectId, required: true },
    field: { type: String, trim: true, required: true },
  },
  { _id: false },
);

const MediaSchema = new Schema(
  {
    name: { type: String, trim: true, default: '' },
    filename: { type: String, trim: true },
    originalName: { type: String, trim: true },
    url: { type: String, required: true, trim: true },
    path: { type: String, trim: true, default: '' },
    mimeType: { type: String, trim: true },
    size: { type: Number, min: 0, default: 0 },
    width: { type: Number, min: 0, default: 0 },
    height: { type: Number, min: 0, default: 0 },
    category: { type: String, enum: MEDIA_CATEGORIES, default: 'other', index: true },
    tags: { type: [String], default: [] },
    alt: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    source: { type: String, enum: MEDIA_SOURCES, default: 'upload', index: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    usageCount: { type: Number, min: 0, default: 0 },
    usedIn: { type: [UsedInSchema], default: [] },
  },
  { timestamps: true },
);

MediaSchema.pre('validate', function (next) {
  if (!this.get('name')) this.set('name', this.get('originalName') || this.get('filename') || this.get('url'));
  next();
});

MediaSchema.index({ name: 'text', originalName: 'text', alt: 'text', url: 'text', tags: 'text', description: 'text' });

export const Media = model('Media', MediaSchema);
