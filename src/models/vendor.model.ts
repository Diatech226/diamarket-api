import { Schema, model } from 'mongoose';
const VendorSchema = new Schema({ userId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, shopName: String, status: { type: String, enum: ['pending', 'active', 'suspended', 'rejected'], default: 'pending', index: true }, isActive: { type: Boolean, default: true }, marketplacePointId: { type: Schema.Types.ObjectId, ref: 'MarketplacePoint' }, commissionRate: { type: Number, default: 0.1, min: 0, max: 1 } }, { timestamps: true });
export const Vendor = model('Vendor', VendorSchema);
