import { Schema, model } from 'mongoose';

const UserSchema = new Schema(
  {
    clerkId: { type: String, unique: true },
    email: String,
    role: { type: String, enum: ['client', 'vendeur', 'marketplace_point_focal', 'admin', 'super_admin', 'agent_logistique'], default: 'client' },
    permissions: { type: [String], default: [] },
    marketplacePointId: { type: Schema.Types.ObjectId, ref: 'MarketplacePoint' },
    countryScope: { type: [String], default: [] },
    locale: { type: String, default: 'fr' },
    preferredCurrency: { type: String, enum: ['FCFA', 'USD'], default: 'FCFA' },
  },
  { timestamps: true },
);

export const User = model('User', UserSchema);
