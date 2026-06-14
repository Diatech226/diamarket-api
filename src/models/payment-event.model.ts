import { Schema, model } from 'mongoose';

const PaymentEventSchema = new Schema(
  {
    provider: { type: String, required: true, default: 'diapay' },
    eventId: { type: String, required: true },
    type: { type: String, required: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order', index: true },
    receivedAt: { type: Date, default: Date.now },
    processedAt: Date,
    status: { type: String, enum: ['processing', 'processed', 'ignored', 'failed'], default: 'processing' },
    error: String,
  },
  { timestamps: true },
);

PaymentEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

export const PaymentEvent = model('PaymentEvent', PaymentEventSchema);
