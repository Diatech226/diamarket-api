import { Request, Response } from 'express';
import { Order } from '../models/order.model';
import { diapayService } from '../services/diapay.service';

const extractSessionId = (session: Record<string, any>) => session.id || session.paymentSessionId;

export const paymentsController = {
  async createDiapayCheckoutSession(req: Request, res: Response) {
    const orderId = req.body.orderId;
    if (!orderId) return res.status(400).json({ message: 'orderId is required' });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.paymentStatus === 'paid') return res.status(409).json({ message: 'Order is already paid' });

    const session = await diapayService.createCheckoutSession(order as any);
    order.paymentProvider = 'diapay';
    order.paymentStatus = 'pending';
    order.diapaySessionId = String(extractSessionId(session));
    order.checkoutUrl = String(session.checkoutUrl || '');
    await order.save();

    return res.status(201).json({
      data: {
        orderId: order.id,
        sessionId: order.diapaySessionId,
        checkoutUrl: order.checkoutUrl,
        paymentStatus: order.paymentStatus,
        raw: session,
      },
    });
  },

  async retrieveDiapaySession(req: Request, res: Response) {
    const session = await diapayService.retrieveCheckoutSession(req.params.sessionId);
    return res.json({ data: session });
  },

  async handleDiapayWebhook(req: Request, res: Response) {
    if (!diapayService.verifyWebhookSignature(req)) {
      return res.status(401).json({ message: 'Invalid Diapay webhook signature' });
    }
    const order = await diapayService.handleWebhookEvent(req.body);
    return res.json({ received: true, data: { orderId: order.id, paymentStatus: order.paymentStatus, status: order.status } });
  },
};
