import { Request, Response } from 'express';
import { Order } from '../models/order.model';
import { diapayService } from '../services/diapay.service';
import { getAuth } from '../middlewares/requireAuth';
import { orderScope } from '../middlewares/resource-access';

const extractSessionId = (session: Record<string, any>) => session.id || session.paymentSessionId;

export const paymentsController = {
  async createDiapayCheckoutSession(req: Request, res: Response) {
    const orderId = req.body.orderId;
    if (!orderId) return res.status(400).json({ message: 'orderId is required' });

    const order = await Order.findOne({ _id: orderId, ...orderScope(getAuth(req)!) });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (['paid', 'refunded'].includes(order.paymentStatus)) return res.status(409).json({ message: 'Order is already paid' });
    if (['cancelled', 'expired'].includes(order.paymentStatus) || order.status === 'cancelled') return res.status(409).json({ message: 'Order is not payable' });

    if (order.diapaySessionId && order.checkoutUrl) return res.json({ success: true, orderId: order.id, sessionId: order.diapaySessionId, checkoutUrl: order.checkoutUrl });

    const session = await diapayService.createCheckoutSession(order as any);
    order.paymentProvider = 'diapay';
    order.paymentStatus = 'pending';
    order.diapaySessionId = String(extractSessionId(session));
    order.checkoutUrl = String(session.checkoutUrl || '');
    await order.save();

    return res.status(201).json({ success: true, orderId: order.id, sessionId: order.diapaySessionId, checkoutUrl: order.checkoutUrl });
  },

  async retrieveDiapaySession(req: Request, res: Response) {
    const order = await Order.findOne({ diapaySessionId: req.params.sessionId, ...orderScope(getAuth(req)!) });
    if (!order) return res.status(404).json({ message: 'Payment session not found' });
    const session = await diapayService.retrieveCheckoutSession(req.params.sessionId);
    return res.json({ data: { orderId: order.id, sessionId: order.diapaySessionId, status: session.status, paymentStatus: order.paymentStatus, checkoutUrl: order.checkoutUrl } });
  },

  async handleDiapayWebhook(req: Request, res: Response) {
    if (!diapayService.verifyWebhookSignature(req)) {
      return res.status(401).json({ message: 'Invalid Diapay webhook signature' });
    }
    const order: any = await diapayService.handleWebhookEvent(req.body);
    if (order.duplicate) return res.json({ received: true, duplicate: true });
    return res.json({ received: true, data: { orderId: order.id, paymentStatus: order.paymentStatus, status: order.status } });
  },
};
