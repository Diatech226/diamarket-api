import crypto from 'crypto';
import { Request, Response } from 'express';
import { env } from '../config/env';
import { getAuth } from '../middlewares/requireAuth';
import { orderScope } from '../middlewares/resource-access';
import { Order } from '../models/order.model';
import { Setting } from '../models/setting.model';
import { Shipment } from '../models/shipment.model';
import { diaexpressService, mapDiaExpressStatus, SHIPPING_STATUSES } from '../services/diaexpress.service';

const shippingConfigKey = 'shipping';
const defaultShippingConfig = {
  provider: 'diaexpress',
  currency: env.shippingDefaultCurrency,
  demoMode: env.shippingDemoMode,
  origin: { country: env.shippingDefaultOriginCountry, city: env.shippingDefaultOriginCity },
  zones: [
    { id: 'ouagadougou', name: 'Ouagadougou', countries: ['Burkina Faso'], cities: ['Ouagadougou'], baseFee: 2500, perKgFee: 400, estimatedDaysMin: 1, estimatedDaysMax: 3, active: true },
    { id: 'national', name: 'National', countries: ['Burkina Faso'], cities: [], baseFee: 3500, perKgFee: 500, estimatedDaysMin: 2, estimatedDaysMax: 5, active: true },
  ],
  serviceLevels: ['standard'],
};

const orderStatusFor = (status: string) => {
  if (status === 'delivered') return 'delivered';
  if (['picked_up', 'in_transit', 'out_for_delivery'].includes(status)) return 'shipped';
  if (status === 'cancelled') return 'cancelled';
  return 'processing';
};

const getShippingConfig = async () => {
  const setting = await Setting.findOne({ key: shippingConfigKey });
  return { ...defaultShippingConfig, ...(setting?.value && typeof setting.value === 'object' ? setting.value : {}) };
};

const sanitizeShippingConfig = (payload: any) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Invalid shipping configuration');
  const zones = Array.isArray(payload.zones) ? payload.zones.map((zone: any, index: number) => {
    const baseFee = Number(zone.baseFee);
    const perKgFee = Number(zone.perKgFee ?? 0);
    const estimatedDaysMin = Number(zone.estimatedDaysMin ?? zone.estimatedDeliveryDays ?? 1);
    const estimatedDaysMax = Number(zone.estimatedDaysMax ?? zone.estimatedDeliveryDays ?? estimatedDaysMin);
    if (!String(zone.name || '').trim()) throw new Error(`Zone ${index + 1}: name is required`);
    if (!Number.isFinite(baseFee) || baseFee < 0) throw new Error(`Zone ${index + 1}: baseFee must be positive`);
    if (!Number.isFinite(perKgFee) || perKgFee < 0) throw new Error(`Zone ${index + 1}: perKgFee must be positive`);
    if (!Number.isFinite(estimatedDaysMin) || !Number.isFinite(estimatedDaysMax) || estimatedDaysMin < 0 || estimatedDaysMax < estimatedDaysMin) throw new Error(`Zone ${index + 1}: invalid delivery delay`);
    return { id: String(zone.id || zone.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), name: String(zone.name).trim(), countries: Array.isArray(zone.countries) ? zone.countries.map(String).filter(Boolean) : [], cities: Array.isArray(zone.cities) ? zone.cities.map(String).filter(Boolean) : [], baseFee, perKgFee, estimatedDaysMin, estimatedDaysMax, active: zone.active !== false };
  }) : defaultShippingConfig.zones;
  return { provider: 'diaexpress', currency: String(payload.currency || env.shippingDefaultCurrency), demoMode: Boolean(payload.demoMode ?? env.shippingDemoMode), origin: { country: String(payload.origin?.country || env.shippingDefaultOriginCountry), city: String(payload.origin?.city || env.shippingDefaultOriginCity) }, zones, serviceLevels: Array.isArray(payload.serviceLevels) ? payload.serviceLevels.map(String).filter(Boolean) : ['standard'] };
};

const estimateFromConfig = (payload: any, config: any) => {
  const destination = payload.destination || {};
  const city = String(destination.city || '').toLowerCase();
  const country = String(destination.country || '').toLowerCase();
  const zone = (config.zones || []).find((candidate: any) => candidate.active !== false && ((candidate.cities || []).map((x: string) => x.toLowerCase()).includes(city) || (!(candidate.cities || []).length && (candidate.countries || []).map((x: string) => x.toLowerCase()).includes(country))));
  if (!zone) return null;
  const weight = Math.max(Number(payload.weight || 1), 1);
  return { success: true, provider: 'diaexpress', zoneId: zone.id, zoneName: zone.name, amount: Math.round(Number(zone.baseFee) + weight * Number(zone.perKgFee || 0)), currency: config.currency, estimatedDeliveryDays: Number(zone.estimatedDaysMax), estimatedDeliveryDaysMin: Number(zone.estimatedDaysMin), serviceLevel: 'standard', simulated: true };
};

const update = async (shipment: any, status: any, raw: any, source: 'provider'|'sync', eventId?: string) => {
  shipment.status = status;
  shipment.providerPayload = raw;
  shipment.history.push({ eventId, status, source, message: raw.message, location: raw.location, occurredAt: raw.occurredAt || new Date() });
  if (eventId) shipment.processedEventIds.push(eventId);
  await shipment.save();
  await Order.findByIdAndUpdate(shipment.order, { shipmentStatus: status, status: orderStatusFor(status) });
  return shipment;
};

export const shippingController = {
  async list(req: Request, res: Response) {
    const auth = getAuth(req)!;
    const orderFilter = orderScope(auth);
    const orders = await Order.find(orderFilter).select('_id');
    const filter: Record<string, unknown> = auth.role === 'admin' ? {} : { order: { $in: orders.map((order) => order._id) } };
    if (req.query.status && SHIPPING_STATUSES.includes(req.query.status as any)) filter.status = req.query.status;
    if (req.query.tracking) filter.trackingNumber = new RegExp(String(req.query.tracking), 'i');
    const data = await Shipment.find(filter).populate('order').sort({ createdAt: -1 });
    return res.json({ data });
  },
  async estimate(req: Request, res: Response) {
    if (!req.body?.destination?.country || !req.body?.destination?.city || !Number.isFinite(Number(req.body.weight))) return res.status(400).json({ message: 'destination.country, destination.city and numeric weight are required' });
    const config = await getShippingConfig();
    const configuredEstimate = estimateFromConfig(req.body, config);
    if (configuredEstimate) return res.json(configuredEstimate);
    const data = await diaexpressService.estimateShipping(req.body);
    return res.json(data);
  },
  async adminConfig(_req: Request, res: Response) { return res.json({ success: true, data: await getShippingConfig(), statuses: SHIPPING_STATUSES }); },
  async updateAdminConfig(req: Request, res: Response) {
    try {
      const value = sanitizeShippingConfig(req.body);
      const data = await Setting.findOneAndUpdate({ key: shippingConfigKey }, { key: shippingConfigKey, value, group: 'shipping', isPublic: true, updatedBy: getAuth(req)!.userId }, { upsert: true, new: true, runValidators: true });
      return res.json({ success: true, data: data.value, statuses: SHIPPING_STATUSES });
    } catch (error) { return res.status(400).json({ success: false, message: error instanceof Error ? error.message : 'Invalid shipping configuration' }); }
  },
  async create(req: Request, res: Response) { const order = await Order.findOne({ _id: req.params.id, ...orderScope(getAuth(req)!) }).populate('customer'); if (!order) return res.status(404).json({ message: 'Order not found' }); const existing = await Shipment.findOne({ order: order.id }); if (existing) return res.json({ success: true, data: existing, idempotent: true }); if (order.paymentProvider === 'diapay' && order.paymentStatus !== 'paid') return res.status(409).json({ message: 'Online payment must be confirmed before shipment creation' }); if (!order.address?.country || !order.address?.city || !order.address?.phone || !order.items.length) return res.status(409).json({ message: 'Shipping address and items are required' }); const created = await diaexpressService.createShipment(order); const shipment = await Shipment.create({ order: order.id, provider: 'diaexpress', ...created, providerPayload: created.raw, history: [{ status: created.status, source: 'system', message: 'Shipment created' }] }); order.shipmentStatus = created.status; order.status = 'processing'; await order.save(); return res.status(201).json({ success: true, data: shipment }); },
  async byOrder(req: Request, res: Response) { const order = await Order.findOne({ _id: req.params.id, ...orderScope(getAuth(req)!) }); if (!order) return res.status(404).json({ message: 'Order not found' }); const data = await Shipment.findOne({ order: order.id }); if (!data) return res.status(404).json({ message: 'Shipment not found' }); return res.json({ data }); },
  async byTracking(req: Request, res: Response) { const shipment = await Shipment.findOne({ trackingNumber: req.params.trackingNumber }); if (!shipment) return res.status(404).json({ message: 'Shipment not found' }); const order = await Order.findOne({ _id: shipment.order, ...orderScope(getAuth(req)!) }); if (!order) return res.status(403).json({ message: 'Forbidden' }); return res.json({ data: shipment }); },
  async sync(req: Request, res: Response) { const order = await Order.findOne({ _id: req.params.id, ...orderScope(getAuth(req)!) }); if (!order) return res.status(404).json({ message: 'Order not found' }); const shipment = await Shipment.findOne({ order: order.id }); if (!shipment?.trackingNumber) return res.status(404).json({ message: 'Shipment not found or tracking unavailable' }); const result = await diaexpressService.getShipmentStatus(shipment.trackingNumber); await update(shipment, result.status, result.raw, 'sync'); return res.json({ data: shipment }); },
  async webhook(req: Request, res: Response) { const signature = String(req.headers['x-diaexpress-signature'] || ''); const raw = (req as Request & { rawBody?: string }).rawBody || ''; if (!env.diaexpressWebhookSecret) return res.status(503).json({ message: 'Webhook unavailable' }); const expected = crypto.createHmac('sha256', env.diaexpressWebhookSecret).update(raw).digest('hex'); if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return res.status(401).json({ message: 'Invalid signature' }); const eventId = String(req.body.eventId || ''); const shipment = await Shipment.findOne({ $or: [{ providerShipmentId: req.body.shipmentId }, { trackingNumber: req.body.trackingNumber }] }).select('+processedEventIds'); if (!shipment) return res.status(404).json({ message: 'Shipment not found' }); if (eventId && shipment.processedEventIds.includes(eventId)) return res.json({ success: true, idempotent: true }); await update(shipment, mapDiaExpressStatus(req.body.status), req.body, 'provider', eventId || undefined); return res.json({ success: true }); },
};
