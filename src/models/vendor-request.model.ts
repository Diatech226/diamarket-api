import { Schema, model } from 'mongoose';

const VendorRequestSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    businessName: { type: String, required: true },
    businessEmail: String,
    notes: String,
    status: { type: String, enum: ['pending', 'active', 'suspended', 'rejected'], default: 'pending', index: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
  },
  { timestamps: true },
);
export const VendorRequest = model('VendorRequest', VendorRequestSchema);
