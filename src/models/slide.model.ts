import { Schema, model } from 'mongoose';
const SlideSchema = new Schema({ title: String, imageUrl: String, ctaUrl: String, isActive: { type: Boolean, default: true }, translations: { fr: Object, en: Object, zh: Object } }, { timestamps: true });
export const Slide = model('Slide', SlideSchema);
