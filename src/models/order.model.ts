import { Schema, model } from 'mongoose';

export const ORDER_STATUSES = ['pending', 'confirmed', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'] as const;
export const SHIPMENT_STATUSES = ['not_created', 'estimated', 'created', 'in_transit', 'delivered', 'failed'] as const;
export const PAYMENT_STATUSES = ['unpaid', 'pending', 'paid', 'failed', 'cancelled', 'expired', 'refunded'] as const;
export const PAYMENT_PROVIDERS = ['cash_on_delivery', 'diapay'] as const;

const OrderItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const OrderSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    vendor: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    items: { type: [OrderItemSchema], required: true },
    totalAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ['FCFA', 'XOF', 'USD'], default: 'FCFA' },
    status: { type: String, enum: ORDER_STATUSES, default: 'pending', index: true },
    paymentProvider: { type: String, enum: PAYMENT_PROVIDERS, default: 'cash_on_delivery', index: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'unpaid', index: true },
    paymentMethod: { type: String },
    diapaySessionId: { type: String, index: true },
    diapayPaymentId: { type: String, index: true },
    checkoutUrl: { type: String },
    paidAt: { type: Date },
    cancelledAt: { type: Date },
    failedAt: { type: Date },
    shipmentStatus: { type: String, enum: SHIPMENT_STATUSES, default: 'not_created', index: true },
    marketplacePointId: { type: Schema.Types.ObjectId, ref: 'MarketplacePoint' },
    shippingEstimate: {
      provider: String,
      estimatedCost: Number,
      estimatedDeliveryDays: Number,
      simulated: { type: Boolean, default: true },
    },
    paymentEvents: [
      {
        eventId: String,
        type: String,
        receivedAt: { type: Date, default: Date.now },
        payload: Schema.Types.Mixed,
      },
    ],
  },
  { timestamps: true },
);

export const Order = model('Order', OrderSchema);
