import { Schema, model } from 'mongoose';
const SettingSchema = new Schema({ key: { type: String, unique: true }, value: Schema.Types.Mixed, scope: { type: String, default: 'global' } }, { timestamps: true });
export const Setting = model('Setting', SettingSchema);
