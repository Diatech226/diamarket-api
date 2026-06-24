import { Category, Product, Setting, Vendor } from '../models';

type Source = 'product' | 'vendor' | 'category' | 'global';
const asRate = (value: unknown) => {
  const rate = Number(value);
  return Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : null;
};

export async function getDefaultCommissionRate() {
  const setting = await Setting.findOne({ key: 'defaultCommission' });
  const value = setting?.value;
  const normalized = Number(value) > 1 ? Number(value) / 100 : Number(value);
  return asRate(normalized) ?? 0.1;
}

export async function resolveCommission({ product, vendor, category, amount = 0 }: { product?: any; vendor?: any; category?: any; amount?: number }) {
  const docs: any = { product, vendor, category };
  if (product && !('commissionRate' in product)) docs.product = await Product.findById(product);
  if (vendor && !('commissionRate' in vendor)) docs.vendor = await Vendor.findById(vendor);
  if (category && !('commissionRate' in category)) docs.category = await Category.findById(category);
  const candidates: Array<[Source, unknown]> = [['product', docs.product?.commissionRate], ['vendor', docs.vendor?.commissionRate], ['category', docs.category?.commissionRate], ['global', await getDefaultCommissionRate()]];
  const [source, rawRate] = candidates.find(([, value]) => asRate(value) !== null)!;
  const rate = asRate(rawRate) ?? 0;
  return { rate, source, amount: Math.round(Number(amount || 0) * rate) };
}
