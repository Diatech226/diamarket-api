import { Schema, model } from 'mongoose';

const VendorRequestSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    businessName: { type: String, required: true },
    businessEmail: String,
    phone: String,
    country: String,
    city: String,
    notes: String,
    adminComment: String,
    requestedCommissionRate: { type: Number, min: 0, max: 1 },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    decisionHistory: [{ action: { type: String, enum: ['approved', 'rejected'], required: true }, comment: String, decidedBy: { type: Schema.Types.ObjectId, ref: 'User' }, decidedAt: { type: Date, default: Date.now } }],
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
  },
  { timestamps: true },
);
export const VendorRequest = model('VendorRequest', VendorRequestSchema);
