import { Schema, model } from 'mongoose';

const CategorySchema = new Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  description: { type: String, trim: true, default: '' },
  parentId: { type: Schema.Types.ObjectId, ref: 'Category' },
  active: { type: Boolean, default: true, index: true },
  order: { type: Number, default: 0 },
  image: String,
  icon: String,
  commissionRate: { type: Number, min: 0, max: 1 },
  translations: { fr: Object, en: Object, zh: Object },
}, { timestamps: true });

export const Category = model('Category', CategorySchema);
