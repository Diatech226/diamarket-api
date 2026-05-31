import { Schema, model } from 'mongoose';
const CurrencyRateSchema = new Schema({ base: { type: String, enum: ['FCFA','USD'] }, target: { type: String, enum: ['FCFA','USD'] }, rate: Number, source: String, fetchedAt: Date }, { timestamps: true });
export const CurrencyRate = model('CurrencyRate', CurrencyRateSchema);
