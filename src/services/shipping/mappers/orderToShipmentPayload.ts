import { ShipmentCreationInput } from '../shipping.service';

export type ExternalShipmentPayload = {
  order_id: string;
  recipient: {
    name: string;
    phone: string;
    city: string;
    country: string;
  };
  parcel: {
    value: number;
    currency: string;
    weight_kg: number;
  };
  origin: {
    city: string;
    country: string;
  };
};

export const orderToShipmentPayload = (
  input: ShipmentCreationInput,
  origin: { city: string; country: string },
): ExternalShipmentPayload => {
  return {
    order_id: input.orderId,
    recipient: {
      name: input.customerName || 'Client Diamarket',
      phone: input.customerPhone || 'N/A',
      city: input.destinationCity || 'N/A',
      country: input.destinationCountry || 'N/A',
    },
    parcel: {
      value: input.totalAmount,
      currency: input.currency || 'FCFA',
      weight_kg: input.totalWeight || 1,
    },
    origin,
  };
};
