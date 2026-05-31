import { Schema, model } from 'mongoose';

const CommissionSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    rate: { type: Number, required: true, min: 0, max: 1 },
    currency: { type: String, enum: ['FCFA', 'USD'], default: 'FCFA' },
    status: { type: String, enum: ['pending', 'invoiced', 'paid'], default: 'pending', index: true },
  },
  { timestamps: true },
);

export const Commission = model('Commission', CommissionSchema);
