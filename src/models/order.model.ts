import { Schema, model } from 'mongoose';

export const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'] as const;
export const SHIPMENT_STATUSES = ['pending', 'created', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned', 'cancelled'] as const;
export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'cancelled', 'expired', 'refunded'] as const;
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
    subtotalAmount: { type: Number, required: true, min: 0 },
    shippingAmount: { type: Number, required: true, min: 0, default: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ['FCFA', 'XOF', 'USD', 'EUR', 'CAD', 'CNY'], default: 'XOF' },
    commissionRate: { type: Number, min: 0, max: 1, default: 0 },
    commissionAmount: { type: Number, min: 0, default: 0 },
    vendorNetAmount: { type: Number, min: 0, default: 0 },
    marketplaceRevenue: { type: Number, min: 0, default: 0 },
    commissionSource: { type: String, enum: ['product', 'vendor', 'category', 'global'], default: 'global' },
    status: { type: String, enum: ORDER_STATUSES, default: 'pending', index: true },
    paymentProvider: { type: String, enum: PAYMENT_PROVIDERS, default: 'cash_on_delivery', index: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'pending', index: true },
    paymentMethod: { type: String, required: true },
    shippingOptionId: { type: String, required: true },
    address: { country: { type: String, required: true }, city: { type: String, required: true }, phone: { type: String, required: true }, line1: String },
    diapaySessionId: { type: String, index: true },
    diapayPaymentId: { type: String, index: true },
    checkoutUrl: { type: String },
    paidAt: { type: Date },
    cancelledAt: { type: Date },
    failedAt: { type: Date },
    shipmentStatus: { type: String, enum: SHIPMENT_STATUSES, default: 'pending', index: true },
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
        processedAt: Date,
        status: { type: String, enum: ['processing', 'processed', 'ignored', 'failed'], default: 'processing' },
      },
    ],
  },
  { timestamps: true },
);

export const Order = model('Order', OrderSchema);
