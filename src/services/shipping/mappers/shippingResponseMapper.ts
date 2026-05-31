import { ShipmentStatusResult } from '../shipping.service';

const mapProviderStatus = (providerStatus: string) => {
  const normalized = providerStatus.toLowerCase();

  if (['created', 'pending_pickup', 'pickup_scheduled'].includes(normalized)) {
    return { shipmentStatus: 'created', orderStatus: 'processing' } as const;
  }

  if (['in_transit', 'on_the_way', 'out_for_delivery'].includes(normalized)) {
    return { shipmentStatus: 'in_transit', orderStatus: 'shipped' } as const;
  }

  if (['delivered', 'completed'].includes(normalized)) {
    return { shipmentStatus: 'delivered', orderStatus: 'delivered' } as const;
  }

  if (['failed', 'cancelled', 'exception'].includes(normalized)) {
    return { shipmentStatus: 'failed', orderStatus: 'cancelled' } as const;
  }

  return { shipmentStatus: 'created', orderStatus: 'processing' } as const;
};

export const shippingResponseMapper = (response: any): ShipmentStatusResult => {
  const providerStatus = response?.status || response?.shipment_status || 'created';
  const mapped = mapProviderStatus(providerStatus);

  return {
    providerStatus,
    shipmentStatus: mapped.shipmentStatus,
    orderStatus: mapped.orderStatus,
    trackingNumber: response?.tracking_number || response?.trackingNumber || '',
    simulated: false,
    raw: response,
  };
};
