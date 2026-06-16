import { Schema, model } from 'mongoose';

const SlideSchema = new Schema(
  {
    title: { type: String, trim: true, default: '' },
    subtitle: { type: String, trim: true, default: '' },
    imageUrl: { type: String, trim: true, default: '' },
    cta: { type: String, trim: true, default: '' },
    ctaUrl: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
    translations: { fr: Object, en: Object, zh: Object },
  },
  { timestamps: true },
);

export const Slide = model('Slide', SlideSchema);
