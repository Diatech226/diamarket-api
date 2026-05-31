import { Schema, model } from 'mongoose';
const CategorySchema = new Schema({ name: String, slug: String, parentId: { type: Schema.Types.ObjectId, ref: 'Category' }, translations: { fr: Object, en: Object, zh: Object } }, { timestamps: true });
export const Category = model('Category', CategorySchema);
