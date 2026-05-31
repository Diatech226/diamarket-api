import { Schema, model } from 'mongoose';

export const PROJECT_STATUSES = ['draft', 'active', 'archived'] as const;

const ProjectSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, sparse: true, lowercase: true, trim: true, index: true },
    description: { type: String, trim: true, default: '' },
    category: { type: String, trim: true, default: '' },
    status: { type: String, enum: PROJECT_STATUSES, default: 'draft', index: true },
    coverImageUrl: { type: String, trim: true, default: '' },
    coverMedia: { type: Schema.Types.ObjectId, ref: 'Media' },
    galleryImageUrls: { type: [String], default: [] },
    galleryMedia: [{ type: Schema.Types.ObjectId, ref: 'Media' }],
    media: [{ type: Schema.Types.ObjectId, ref: 'Media' }],
    links: { type: [String], default: [] },
    startDate: { type: Date },
    endDate: { type: Date },
    isFeatured: { type: Boolean, default: false, index: true },
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  },
  { timestamps: true },
);

ProjectSchema.index({ title: 'text', description: 'text', category: 'text' });

export const Project = model('Project', ProjectSchema);
