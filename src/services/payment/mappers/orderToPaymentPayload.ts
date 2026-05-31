import { PaymentIntentInput } from '../payment.service';

export type DiapayPaymentPayload = {
  order_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  customer: {
    id?: string;
    email?: string;
    phone?: string;
  };
  metadata?: Record<string, any>;
};

export const orderToPaymentPayload = (input: PaymentIntentInput, defaultCurrency: string): DiapayPaymentPayload => {
  return {
    order_id: input.orderId,
    amount: input.amount,
    currency: input.currency || defaultCurrency,
    payment_method: input.method,
    customer: {
      id: input.customerId,
      email: input.customerEmail,
      phone: input.customerPhone,
    },
    metadata: input.metadata,
  };
};
