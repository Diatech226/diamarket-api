import { PaymentStatusResult } from '../payment.service';

const mapProviderStatus = (providerStatus: string) => {
  const normalized = providerStatus.toLowerCase();

  if (['pending', 'created', 'awaiting_payment'].includes(normalized)) return 'pending' as const;
  if (['processing', 'authorized', 'in_progress'].includes(normalized)) return 'processing' as const;
  if (['succeeded', 'success', 'paid', 'completed'].includes(normalized)) return 'succeeded' as const;
  if (['failed', 'error', 'declined'].includes(normalized)) return 'failed' as const;
  if (['cancelled', 'canceled', 'expired'].includes(normalized)) return 'cancelled' as const;

  return 'pending' as const;
};

export const paymentResponseMapper = (response: any): PaymentStatusResult => {
  const providerStatus = response?.status || response?.payment_status || 'pending';

  return {
    paymentId: response?.id || response?.payment_id || '',
    providerStatus,
    status: mapProviderStatus(providerStatus),
    simulated: false,
    raw: response,
  };
};
