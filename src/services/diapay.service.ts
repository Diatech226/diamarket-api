import crypto from 'crypto';
import { Request } from 'express';
import Diapay from 'diapay-sdk-js';
import { env } from '../config/env';
import { Order } from '../models/order.model';

const diapay = new Diapay({
  baseUrl: env.diapayApiBaseUrl || 'http://localhost:5100',
  secretKey: env.diapaySecretKey,
});

type OrderLike = {
  id?: string;
  _id?: unknown;
  customer?: unknown;
  items?: Array<{ name?: string; quantity?: number; unitPrice?: number; totalPrice?: number }>;
  totalAmount: number;
  currency?: string;
};

type DiapayEvent = {
  id?: string;
  type: string;
  data?: {
    checkoutSession?: Record<string, any>;
    payment?: Record<string, any>;
  };
  [key: string]: any;
};

const toDiapayCurrency = (currency?: string) => (currency === 'FCFA' ? 'XOF' : (currency || env.paymentDefaultCurrency || 'XOF')).toUpperCase();
const fromDiapayCurrency = (currency?: string) => (currency === 'XOF' ? 'FCFA' : currency);
const orderIdOf = (order: OrderLike) => String(order.id || order._id);

function timingSafeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export const diapayService = {
  async createCheckoutSession(order: OrderLike) {
    if (!env.diapaySecretKey) throw new Error('DIAPAY_SECRET_KEY is required to create a Diapay Checkout session');

    const orderId = orderIdOf(order);
    const session = await diapay.checkout.sessions.create(
      {
        amount: Math.round(order.totalAmount),
        currency: toDiapayCurrency(order.currency),
        successUrl: `${env.diamarketSuccessUrl}?orderId=${encodeURIComponent(orderId)}`,
        cancelUrl: `${env.diamarketCancelUrl}?orderId=${encodeURIComponent(orderId)}`,
        customer: String(order.customer || ''),
        items: (order.items || []).map((item) => ({
          name: item.name || 'Article Diamarket',
          quantity: item.quantity || 1,
          amount: Math.round(item.totalPrice ?? item.unitPrice ?? 0),
        })),
        metadata: {
          source: 'diamarket',
          orderId,
          customerId: String(order.customer || ''),
          environment: env.nodeEnv === 'production' ? 'live' : 'test',
        },
      },
      { idempotencyKey: `diamarket-order-${orderId}` },
    ) as Record<string, any>;

    return session;
  },

  retrieveCheckoutSession(sessionId: string) {
    return diapay.checkout.sessions.retrieve(sessionId) as Promise<Record<string, any>>;
  },

  retrievePayment(paymentId: string) {
    return diapay.retrievePayment(paymentId) as Promise<Record<string, any>>;
  },

  verifyWebhookSignature(req: Request) {
    const rawBody = (req as Request & { rawBody?: string }).rawBody || JSON.stringify(req.body || {});
    const signature = req.header('Diapay-Signature') || req.header('diapay-signature') || '';
    if (!env.diapayWebhookSecret || !rawBody || !signature) return false;
    const expected = crypto.createHmac('sha256', env.diapayWebhookSecret).update(rawBody).digest('hex');
    return timingSafeEqual(signature, expected);
  },

  async handleWebhookEvent(event: DiapayEvent) {
    const checkoutSession = event.data?.checkoutSession;
    const payment = event.data?.payment;
    const metadata = payment?.metadata || checkoutSession?.metadata || {};
    const orderId = metadata.orderId;
    if (!orderId) throw Object.assign(new Error('Missing Diamarket orderId in Diapay metadata'), { status: 400 });

    const order = await Order.findById(orderId);
    if (!order) throw Object.assign(new Error('Order not found for Diapay event'), { status: 404 });

    const amount = Number(payment?.amount ?? checkoutSession?.amount);
    const currency = fromDiapayCurrency(String(payment?.currency ?? checkoutSession?.currency ?? ''));
    if (Number.isFinite(amount) && amount !== Math.round(order.totalAmount)) {
      throw Object.assign(new Error('Diapay amount mismatch'), { status: 400 });
    }
    if (currency && currency !== order.currency) {
      throw Object.assign(new Error('Diapay currency mismatch'), { status: 400 });
    }

    const alreadyLogged = Array.isArray((order as any).paymentEvents) && (order as any).paymentEvents.some((item: any) => item.eventId === event.id);
    if (!alreadyLogged) {
      (order as any).paymentEvents = [...((order as any).paymentEvents || []), { eventId: event.id, type: event.type, payload: event }];
    }

    order.paymentProvider = 'diapay';
    order.diapaySessionId = String(checkoutSession?.id || checkoutSession?.paymentSessionId || order.diapaySessionId || '');
    if (payment?.id) order.diapayPaymentId = String(payment.id);
    if (payment?.method) order.paymentMethod = String(payment.method);

    if (['checkout.session.completed', 'payment.succeeded'].includes(event.type)) {
      if (order.paymentStatus !== 'paid') {
        order.paymentStatus = 'paid';
        order.status = 'confirmed';
        order.paidAt = new Date();
      }
    } else if (event.type === 'payment.failed') {
      order.paymentStatus = 'failed';
      order.failedAt = new Date();
    } else if (event.type === 'payment.cancelled') {
      order.paymentStatus = 'cancelled';
      order.cancelledAt = new Date();
    } else if (event.type === 'payment.expired') {
      order.paymentStatus = 'expired';
      order.failedAt = new Date();
    } else if (event.type === 'refund.succeeded') {
      order.paymentStatus = 'refunded';
    }

    await order.save();
    console.info('[diapay:webhook]', { eventId: event.id, type: event.type, orderId: order.id, paymentStatus: order.paymentStatus });
    return order;
  },
};
