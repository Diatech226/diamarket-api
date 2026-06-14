import { Schema, model } from 'mongoose';
import { SHIPPING_STATUSES } from '../services/diaexpress.service';
const HistorySchema = new Schema({ eventId: String, status: { type: String, enum: SHIPPING_STATUSES }, message: String, location: String, occurredAt: { type: Date, default: Date.now }, source: { type: String, enum: ['provider','sync','system'], default: 'system' } }, { _id: false });
const ShipmentSchema = new Schema({
  order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true, index: true }, provider: { type: String, required: true, default: 'diaexpress' }, providerShipmentId: { type: String, index: true }, trackingNumber: { type: String, index: true, unique: true, sparse: true }, status: { type: String, enum: SHIPPING_STATUSES, default: 'pending', index: true }, estimatedDeliveryDate: Date, providerPayload: Schema.Types.Mixed, history: { type: [HistorySchema], default: [] }, processedEventIds: { type: [String], default: [], select: false },
}, { timestamps: true });
export const Shipment = model('Shipment', ShipmentSchema);
