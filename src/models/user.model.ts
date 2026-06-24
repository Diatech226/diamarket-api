import { Schema, model } from 'mongoose';

const UserSchema = new Schema(
  {
    clerkId: { type: String, unique: true, sparse: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    name: { type: String, trim: true },
    passwordHash: { type: String, select: false },
    disabled: { type: Boolean, default: false },
    role: { type: String, enum: ['user', 'vendor', 'admin'], default: 'user' },
    permissions: { type: [String], default: [] },
    marketplacePointId: { type: Schema.Types.ObjectId, ref: 'MarketplacePoint' },
    countryScope: { type: [String], default: [] },
    locale: { type: String, default: 'fr' },
    preferredCurrency: { type: String, enum: ['FCFA', 'XOF', 'USD', 'EUR', 'CAD', 'CNY'], default: 'XOF' },
  },
  { timestamps: true },
);

export const User = model('User', UserSchema);
