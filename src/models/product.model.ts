import { Schema, model } from 'mongoose';

export const PRODUCT_STATUSES = ['draft', 'active', 'archived'] as const;

const ProductSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    description: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ['FCFA', 'USD'], default: 'FCFA', required: true },
    images: { type: [String], default: [] },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    vendor: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    stock: { type: Number, required: true, min: 0, default: 0 },
    weight: { type: Number, min: 0 },
    length: { type: Number, min: 0 },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
    originCountry: { type: String, trim: true },
    originCity: { type: String, trim: true },
    status: { type: String, enum: PRODUCT_STATUSES, default: 'draft', index: true },
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    isFeatured: { type: Boolean, default: false, index: true },
    isPromoted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

ProductSchema.index({ name: 'text', description: 'text' });

export const Product = model('Product', ProductSchema);
