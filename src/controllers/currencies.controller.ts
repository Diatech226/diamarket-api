import { Request, Response } from 'express';
import { CurrencyRate, Order } from '../models';
import { getAuth } from '../middlewares/requireAuth';
import { logAdminAction } from '../services/admin-audit.service';

const seed = [
  { code: 'XOF', name: 'Franc CFA BCEAO', symbol: 'FCFA', rateToDefault: 1, isActive: true, isDefault: true },
  { code: 'USD', name: 'Dollar américain', symbol: '$', rateToDefault: 0.0017, isActive: true, isDefault: false },
  { code: 'EUR', name: 'Euro', symbol: '€', rateToDefault: 0.0015, isActive: true, isDefault: false },
  { code: 'CAD', name: 'Dollar canadien', symbol: 'CA$', rateToDefault: 0.0023, isActive: true, isDefault: false },
  { code: 'CNY', name: 'Yuan renminbi', symbol: '¥', rateToDefault: 0.012, isActive: true, isDefault: false },
];
const normalize = (code: unknown) => String(code || '').trim().toUpperCase() === 'FCFA' ? 'XOF' : String(code || '').trim().toUpperCase();
const validate = (body: any, partial = false) => {
  const code = normalize(body.code);
  if (!partial && !code) return 'code is required';
  if (body.code !== undefined && !['XOF','USD','EUR','CAD','CNY'].includes(code)) return 'Unsupported currency code';
  if (!partial && !String(body.name || '').trim()) return 'name is required';
  if (!partial && !String(body.symbol || '').trim()) return 'symbol is required';
  if (body.rateToDefault !== undefined && (!Number.isFinite(Number(body.rateToDefault)) || Number(body.rateToDefault) <= 0)) return 'rateToDefault must be positive';
  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') return 'isActive must be boolean';
  if (body.isDefault !== undefined && typeof body.isDefault !== 'boolean') return 'isDefault must be boolean';
  return null;
};
const isDuplicateKeyError = (error: unknown) => typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 11000;
async function ensureSeed() {
  await CurrencyRate.bulkWrite(seed.map((currency) => ({
    updateOne: {
      filter: { code: currency.code },
      update: {
        $setOnInsert: {
          code: currency.code,
          name: currency.name,
          symbol: currency.symbol,
        },
        $set: {
          rateToDefault: currency.rateToDefault,
          isActive: currency.isActive,
          isDefault: currency.isDefault,
          source: 'seed',
          lastUpdatedAt: new Date(),
        },
      },
      upsert: true,
    },
  })), { ordered: false });

  const defaultCurrency = await CurrencyRate.findOne({ code: 'XOF' });
  if (defaultCurrency) await setSingleDefault(defaultCurrency.id);
  console.info('[currency-seed] Default currencies ensured.');
}
async function setSingleDefault(id: string) { await CurrencyRate.updateMany({ _id: { $ne: id } }, { isDefault: false }); await CurrencyRate.findByIdAndUpdate(id, { isDefault: true, isActive: true, rateToDefault: 1, lastUpdatedAt: new Date() }); }
export const currenciesController = {
  async list(_req: Request, res: Response) { await ensureSeed(); return res.json({ success: true, data: await CurrencyRate.find().sort({ isDefault: -1, code: 1 }) }); },
  async publicList(_req: Request, res: Response) { await ensureSeed(); return res.json({ success: true, data: await CurrencyRate.find({ isActive: true }).sort({ isDefault: -1, code: 1 }) }); },
  async create(req: Request, res: Response) { const err = validate(req.body); if (err) return res.status(400).json({ success: false, message: err }); const payload = { ...req.body, code: normalize(req.body.code), rateToDefault: Number(req.body.rateToDefault), lastUpdatedAt: new Date() }; try { const data = await CurrencyRate.create(payload); if (data.isDefault) await setSingleDefault(data.id); await logAdminAction(getAuth(req)!.userId, 'currency.created', 'currency', data.id, payload); return res.status(201).json({ success: true, data }); } catch (error) { if (isDuplicateKeyError(error)) return res.status(409).json({ success: false, message: 'Currency code already exists' }); throw error; } },
  async update(req: Request, res: Response) { const err = validate(req.body, true); if (err) return res.status(400).json({ success: false, message: err }); const payload = { ...req.body, ...(req.body.code !== undefined ? { code: normalize(req.body.code) } : {}), ...(req.body.rateToDefault !== undefined ? { rateToDefault: Number(req.body.rateToDefault) } : {}), lastUpdatedAt: new Date() }; const data = await CurrencyRate.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true }); if (!data) return res.status(404).json({ success: false, message: 'Currency not found' }); if (data.isDefault) await setSingleDefault(data.id); await logAdminAction(getAuth(req)!.userId, 'currency.updated', 'currency', data.id, payload); return res.json({ success: true, data: await CurrencyRate.findById(data.id) }); },
  async remove(req: Request, res: Response) { const data = await CurrencyRate.findById(req.params.id); if (!data) return res.status(404).json({ success: false, message: 'Currency not found' }); if (data.isDefault) return res.status(409).json({ success: false, message: 'Default currency cannot be deleted' }); const used = await Order.exists({ currency: { $in: [data.code, data.code === 'XOF' ? 'FCFA' : data.code] } }); if (used) return res.status(409).json({ success: false, message: 'Currency is used by orders' }); await data.deleteOne(); await logAdminAction(getAuth(req)!.userId, 'currency.deleted', 'currency', data.id, { code: data.code }); return res.status(204).send(); },
};
