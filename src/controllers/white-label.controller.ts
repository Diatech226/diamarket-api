import { Request, Response } from 'express';
import { Category, Product, Vendor } from '../models';
const ok = (res: Response, data: unknown) => res.json({ success: true, data });
const fallbackConfig = (vendorId: string) => ({ vendorId, shopName: 'Boutique Diamarket', slogan: 'Marketplace premium', colors: { primary: '#1f2a1d', secondary: '#d6b56d', background: '#faf8f3', text: '#18181b' }, fonts: { heading: 'Playfair Display', body: 'Inter' }, buttons: { radius: '999px', style: 'solid' }, socialLinks: {} });
const fallbackHome = (vendorId: string) => ({ vendorId, blocks: [{ id: 'hero', type: 'hero', title: 'Nouvelle collection', enabled: true }, { id: 'featured', type: 'featuredProducts', title: 'Produits vedettes', enabled: true }] });
export const whiteLabelController = {
  getConfig: (req: Request, res: Response) => ok(res, fallbackConfig(req.params.vendor_id)),
  putConfig: (req: Request, res: Response) => ok(res, { ...fallbackConfig(req.params.vendor_id), ...req.body, vendorId: req.params.vendor_id, updatedAt: new Date().toISOString() }),
  getHome: (req: Request, res: Response) => ok(res, fallbackHome(req.params.vendor_id)),
  putHome: (req: Request, res: Response) => ok(res, { ...fallbackHome(req.params.vendor_id), ...req.body, vendorId: req.params.vendor_id, updatedAt: new Date().toISOString() }),
  postDomain: (req: Request, res: Response) => ok(res, { vendorId: req.params.vendor_id, domain: req.body?.domain, status: 'pending_dns_verification' }),
  publicStorefront: async (req: Request, res: Response) => {
    const domain = req.params.domain;
    const vendor = await Vendor.findOne({ $or: [{ slug: domain }, { domain }, { shopName: domain }] }).lean().catch(() => null);
    const vendorId = String(vendor?._id ?? domain);
    const [products, categories] = await Promise.all([Product.find(vendor?._id ? { vendor: vendor._id, status: 'active' } : { status: 'active' }).limit(24).lean().catch(() => []), Category.find({ active: { $ne: false } }).limit(24).lean().catch(() => [])]);
    return ok(res, { domain, vendor: vendor ?? { _id: vendorId, shopName: domain, status: 'active' }, config: fallbackConfig(vendorId), homePage: fallbackHome(vendorId), products, categories });
  },
  promotions: (_req: Request, res: Response) => ok(res, []),
  createPromotion: (req: Request, res: Response) => ok(res, { _id: `promo_${Date.now()}`, ...req.body, status: req.body?.status ?? 'draft' }),
  campaignAnalytics: (req: Request, res: Response) => ok(res, { campaignId: req.params.id, impressions: 0, clicks: 0, conversions: 0 }),
  emailTemplates: (_req: Request, res: Response) => ok(res, []),
  updateEmailTemplate: (req: Request, res: Response) => ok(res, { _id: req.params.id, ...req.body, updatedAt: new Date().toISOString() }),
  vendorPayouts: (req: Request, res: Response) => ok(res, [{ _id: `payout_${req.params.id}_sample`, vendor: req.params.id, amount: 0, currency: 'FCFA', status: 'pending' }]),
  createVendorPayout: (req: Request, res: Response) => ok(res, { _id: `payout_${Date.now()}`, vendor: req.params.id, ...req.body, status: req.body?.status ?? 'pending' }),
  updateBankDetails: (req: Request, res: Response) => ok(res, { vendor: req.params.id, bankDetails: req.body, updatedAt: new Date().toISOString() }),
  vendorMessaging: (req: Request, res: Response) => ok(res, [{ _id: `thread_${req.params.id}`, subject: 'Support vendeur', unreadCount: 0, messages: [] }]),
  createVendorMessage: (req: Request, res: Response) => ok(res, { _id: `msg_${Date.now()}`, vendor: req.params.id, body: req.body?.body ?? '', attachments: req.body?.attachments ?? [], status: 'queued', websocket: 'planned', createdAt: new Date().toISOString() }),
  productExport: (_req: Request, res: Response) => ok(res, { format: 'csv', status: 'not_persisted', message: 'Export endpoint foundation; streaming export remains to implement.' }),
};
