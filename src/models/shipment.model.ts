import { Schema, model } from 'mongoose';

const ShipmentSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    logisticsAgent: { type: Schema.Types.ObjectId, ref: 'User' },
    carrier: String,
    trackingNumber: String,
    status: {
      type: String,
      enum: ['not_created', 'estimated', 'created', 'in_transit', 'delivered', 'failed'],
      default: 'not_created',
      index: true,
    },
    externalProviderPayload: Schema.Types.Mixed,
  },
  { timestamps: true },
);

export const Shipment = model('Shipment', ShipmentSchema);
