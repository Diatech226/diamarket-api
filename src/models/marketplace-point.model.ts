import { Schema, model } from 'mongoose';
const MarketplacePointSchema = new Schema({ name: String, city: String, country: String, zones: { type: [String], default: [] }, managerId: { type: Schema.Types.ObjectId, ref: 'User' }, contactPhone: String, isActive: { type: Boolean, default: true } }, { timestamps: true });
export const MarketplacePoint = model('MarketplacePoint', MarketplacePointSchema);
