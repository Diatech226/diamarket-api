import { Request, Response } from 'express';
import { Order, ORDER_STATUSES } from '../models/order.model';
import { Shipment } from '../models/shipment.model';
import { shippingService } from '../services/shipping';

export const ordersController = {
  async create(req: Request, res: Response) {
    const estimate = await shippingService.estimateShipping(req.body);
    const order = await Order.create({ ...req.body, paymentStatus: req.body.paymentMode === 'cod' ? 'unpaid' : req.body.paymentStatus || 'unpaid', shipmentStatus: 'estimated', shippingEstimate: estimate });
    return res.status(201).json({ data: order });
  },
  async list(_req: Request, res: Response) {
    const data = await Order.find().populate('customer vendor items.product').sort({ createdAt: -1 });
    return res.json({ data });
  },
  async getById(req: Request, res: Response) {
    const data = await Order.findById(req.params.id).populate('customer vendor items.product');
    if (!data) return res.status(404).json({ message: 'Order not found' });
    return res.json({ data });
  },
  async updateStatus(req: Request, res: Response) {
    if (!ORDER_STATUSES.includes(req.body.status)) {
      return res.status(400).json({ message: 'Invalid order status' });
    }
    const data = await Order.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!data) return res.status(404).json({ message: 'Order not found' });

    if (req.body.status === 'processing') {
      const shipment = await shippingService.createShipment({
        orderId: data.id,
        estimatedCost: data.shippingEstimate?.estimatedCost || 0,
        totalAmount: data.totalAmount,
        currency: data.currency,
      });

      data.shipmentStatus = 'created';
      await data.save();

      await Shipment.create({
        order: data.id,
        carrier: shipment.simulated ? 'mock' : 'external',
        trackingNumber: shipment.trackingNumber,
        status: 'created',
        externalProviderPayload: shipment.raw,
      });

      return res.json({ data, shipment });
    }

    return res.json({ data });
  },
  async getPaymentStatus(req: Request, res: Response) {
    const data = await Order.findById(req.params.id).select('status paymentProvider paymentStatus paymentMethod diapaySessionId diapayPaymentId checkoutUrl paidAt cancelledAt failedAt totalAmount currency');
    if (!data) return res.status(404).json({ message: 'Order not found' });
    return res.json({ data });
  },
  async syncShipmentStatus(req: Request, res: Response) {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const shipment = await Shipment.findOne({ order: order.id }).sort({ createdAt: -1 });
    if (!shipment?.trackingNumber) {
      return res.status(404).json({ message: 'Shipment not found or tracking number unavailable' });
    }

    const status = await shippingService.syncShipmentStatus(shipment.trackingNumber);

    order.shipmentStatus = status.shipmentStatus;
    order.status = status.orderStatus;
    await order.save();

    shipment.status = status.shipmentStatus;
    shipment.externalProviderPayload = status.raw;
    await shipment.save();

    return res.json({
      data: {
        order,
        shipment,
        providerStatus: status.providerStatus,
      },
    });
  },
};
