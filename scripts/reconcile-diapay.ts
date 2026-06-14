import { connectDatabase } from '../src/config/db';
import { Order } from '../src/models/order.model';
import { diapayService } from '../src/services/diapay.service';

async function reconcile() {
  await connectDatabase();
  const cutoff = new Date(Date.now() - 30 * 60 * 1000);
  const orders = await Order.find({ paymentProvider: 'diapay', paymentStatus: { $in: ['pending', 'processing'] }, updatedAt: { $lt: cutoff }, diapaySessionId: { $exists: true } });
  for (const order of orders) {
    try {
      const session = await diapayService.retrieveCheckoutSession(order.diapaySessionId!);
      console.info('[diapay:reconcile]', { orderId: order.id, localStatus: order.paymentStatus, providerStatus: session.status });
    } catch (error) {
      console.error('[diapay:reconcile:error]', { orderId: order.id, message: error instanceof Error ? error.message : String(error) });
    }
  }
  process.exit(0);
}

reconcile().catch((error) => {
  console.error('[diapay:reconcile:fatal]', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
