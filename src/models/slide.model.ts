import { Schema, model } from 'mongoose';

const SlideSchema = new Schema(
  {
    title: { type: String, trim: true, required: true },
    subtitle: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    imageDesktop: { type: String, trim: true, default: '' },
    imageMobile: { type: String, trim: true, default: '' },
    imageUrl: { type: String, trim: true, default: '' },
    ctaLabel: { type: String, trim: true, default: '' },
    ctaLink: { type: String, trim: true, default: '' },
    cta: { type: String, trim: true, default: '' },
    ctaUrl: { type: String, trim: true, default: '' },
    badge: { type: String, trim: true, default: '' },
    backgroundColor: { type: String, trim: true, default: '' },
    position: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true, index: true },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    translations: { fr: Object, en: Object, zh: Object },
  },
  { timestamps: true },
);

export const Slide = model('Slide', SlideSchema);
