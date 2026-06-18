import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Order, ORDER_STATUSES } from '../models/order.model';
import { Product } from '../models/product.model';
import { Shipment } from '../models/shipment.model';
import { shippingService } from '../services/shipping';
import { diaexpressService } from '../services/diaexpress.service';
import { getAuth } from '../middlewares/requireAuth';
import { orderScope } from '../middlewares/resource-access';

export const ordersController = {
  async create(req: Request, res: Response) {
    const auth = getAuth(req)!;
    const requestedItems = req.body.items as Array<{ productId: string; quantity: number }>;
    const ids = requestedItems.map((item) => item.productId);
    const products = await Product.find({ _id: { $in: ids }, status: 'active' });
    if (products.length !== new Set(ids).size) return res.status(409).json({ message: 'Un ou plusieurs produits sont introuvables ou inactifs' });
    const byId = new Map(products.map((product) => [product.id, product]));
    const vendors = new Set(products.map((product) => String(product.vendor)));
    if (vendors.size !== 1) return res.status(400).json({ message: 'Une commande doit contenir les produits d’un seul vendeur' });

    const items = requestedItems.map(({ productId, quantity }) => {
      const product = byId.get(productId)!;
      return { product: product._id, name: product.name, quantity, unitPrice: product.price, totalPrice: product.price * quantity };
    });
    const subtotalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const estimate = await diaexpressService.estimateShipping({ origin: { country: 'Burkina Faso', city: 'Ouagadougou' }, destination: req.body.address, weight: Math.max(1, items.reduce((sum, item) => sum + item.quantity, 0)), items });
    const shippingEstimate = { provider: estimate.provider, estimatedCost: estimate.amount, estimatedDeliveryDays: estimate.estimatedDeliveryDays, simulated: estimate.simulated };
    const shippingAmount = Number(estimate.amount || 0);

    const session = await mongoose.startSession();
    try {
      let created: InstanceType<typeof Order> | undefined;
      await session.withTransaction(async () => {
        for (const item of requestedItems) {
          const updated = await Product.findOneAndUpdate({ _id: item.productId, status: 'active', stock: { $gte: item.quantity } }, { $inc: { stock: -item.quantity } }, { session, new: true });
          if (!updated) throw new Error('INSUFFICIENT_STOCK');
        }
        [created] = await Order.create([{ customer: auth.userId, vendor: products[0].vendor, items, subtotalAmount, shippingAmount, totalAmount: subtotalAmount + shippingAmount, currency: products[0].currency, address: req.body.address, shippingOptionId: req.body.shippingOptionId, paymentProvider: req.body.paymentMethod === 'diapay' ? 'diapay' : 'cash_on_delivery', paymentMethod: req.body.paymentMethod, status: 'pending', paymentStatus: 'pending', shipmentStatus: 'pending', shippingEstimate }], { session });
      });
      return res.status(201).json({ data: created });
    } catch (error) {
      if (error instanceof Error && error.message === 'INSUFFICIENT_STOCK') return res.status(409).json({ message: 'Stock insuffisant; actualisez votre panier' });
      throw error;
    } finally { await session.endSession(); }
  },
  async list(req: Request, res: Response) {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const search = String(req.query.search || '').trim();
    const filter: Record<string, unknown> = { ...orderScope(getAuth(req)!) };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;
    if (req.query.shipmentStatus) filter.shipmentStatus = req.query.shipmentStatus;
    if (search) {
      filter.$or = [
        { paymentProvider: new RegExp(search, 'i') },
        { paymentMethod: new RegExp(search, 'i') },
        { diapaySessionId: new RegExp(search, 'i') },
        { diapayPaymentId: new RegExp(search, 'i') },
      ];
      if (mongoose.isValidObjectId(search)) (filter.$or as Record<string, unknown>[]).push({ _id: search });
    }
    const [data, total] = await Promise.all([
      Order.find(filter).populate('customer vendor items.product').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Order.countDocuments(filter),
    ]);
    return res.json({ success: true, data, meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
  },
  async getById(req: Request, res: Response) {
    const data = await Order.findOne({ _id: req.params.id, ...orderScope(getAuth(req)!) }).populate('customer vendor items.product');
    if (!data) return res.status(404).json({ success: false, message: 'Order not found' });
    const shipment = await Shipment.findOne({ order: data.id }).sort({ createdAt: -1 });
    return res.json({ success: true, data: { ...data.toObject(), shipment } });
  },
  async updateStatus(req: Request, res: Response) {
    if (!ORDER_STATUSES.includes(req.body.status)) return res.status(400).json({ success: false, message: 'Invalid order status' });
    const current = await Order.findOne({ _id: req.params.id, ...orderScope(getAuth(req)!) });
    if (!current) return res.status(404).json({ success: false, message: 'Order not found' });
    const transitions: Record<string, string[]> = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['processing', 'cancelled'],
      processing: ['shipped', 'cancelled'],
      shipped: ['delivered'],
      delivered: ['refunded'],
      cancelled: ['refunded'],
      refunded: [],
    };
    if (!transitions[current.status]?.includes(req.body.status)) return res.status(409).json({ success: false, message: `Transition ${current.status} → ${req.body.status} not allowed` });
    current.status = req.body.status;
    if (req.body.status === 'cancelled') current.cancelledAt = new Date();
    await current.save();
    return res.json({ success: true, data: current });
  },
  async getPaymentStatus(req: Request, res: Response) {
    const data = await Order.findOne({ _id: req.params.id, ...orderScope(getAuth(req)!) }).select('status paymentProvider paymentStatus paymentMethod diapaySessionId diapayPaymentId checkoutUrl paidAt cancelledAt failedAt totalAmount currency createdAt updatedAt');
    if (!data) return res.status(404).json({ success: false, message: 'Order not found' });
    return res.json({ success: true, data });
  },
  async syncShipmentStatus(req: Request, res: Response) { const order = await Order.findOne({ _id: req.params.id, ...orderScope(getAuth(req)!) }); if (!order) return res.status(404).json({ success: false, message: 'Order not found' }); const shipment = await Shipment.findOne({ order: order.id }).sort({ createdAt: -1 }); if (!shipment?.trackingNumber) return res.status(404).json({ success: false, message: 'Shipment not found or tracking number unavailable' }); const status = await shippingService.syncShipmentStatus(shipment.trackingNumber); order.shipmentStatus = status.shipmentStatus; order.status = status.orderStatus; await order.save(); shipment.status = status.shipmentStatus; shipment.providerPayload = status.raw; await shipment.save(); return res.json({ success: true, data: { order, shipment, providerStatus: status.providerStatus } }); },
};
