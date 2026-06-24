import { Schema, model } from 'mongoose';

const SettingSchema = new Schema({
  key: { type: String, required: true, unique: true, index: true },
  value: { type: Schema.Types.Mixed },
  group: { type: String, enum: ['general', 'branding', 'seo', 'contact', 'checkout', 'shipping', 'vendors', 'maintenance', 'social'], default: 'general', index: true },
  isPublic: { type: Boolean, default: false, index: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export const Setting = model('Setting', SettingSchema);
