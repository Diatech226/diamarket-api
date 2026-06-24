import { Schema, model } from 'mongoose';

export const CURRENCY_CODES = ['XOF', 'FCFA', 'USD', 'EUR', 'CAD', 'CNY'] as const;

const CurrencyRateSchema = new Schema(
  {
    code: { type: String, required: true, uppercase: true, trim: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    symbol: { type: String, required: true, trim: true },
    rateToDefault: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
    isDefault: { type: Boolean, default: false, index: true },
    lastUpdatedAt: { type: Date, default: Date.now },
    source: { type: String, default: 'admin' },
    base: String,
    target: String,
    rate: Number,
    fetchedAt: Date,
  },
  { timestamps: true },
);

CurrencyRateSchema.pre('validate', function normalize(next) {
  if (this.code === 'FCFA') this.code = 'XOF';
  if (this.isDefault) this.rateToDefault = 1;
  this.lastUpdatedAt = new Date();
  next();
});

export const CurrencyRate = model('CurrencyRate', CurrencyRateSchema);
