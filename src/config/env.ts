import path from 'path';
import dotenv from 'dotenv';

export const apiEnvPath = path.resolve(__dirname, '../../.env');

dotenv.config({
  path: apiEnvPath,
  override: true
});

console.info(`[env] Loaded API env from: ${apiEnvPath}`);

const parseList = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 5000),
  clerkIssuer: process.env.CLERK_ISSUER_URL ?? '',
  clerkSecretKey: process.env.CLERK_SECRET_KEY ?? '',
  corsAllowedOrigins: parseList(process.env.CORS_ALLOWED_ORIGINS),
  shippingProvider: process.env.SHIPPING_PROVIDER ?? 'mock',
  shippingApiBaseUrl: process.env.SHIPPING_API_BASE_URL ?? '',
  shippingApiKey: process.env.SHIPPING_API_KEY ?? '',
  shippingApiTimeout: Number(process.env.SHIPPING_API_TIMEOUT ?? 15000),
  shippingDefaultOriginCountry: process.env.SHIPPING_DEFAULT_ORIGIN_COUNTRY ?? 'Burkina Faso',
  shippingDefaultOriginCity: process.env.SHIPPING_DEFAULT_ORIGIN_CITY ?? 'Ouagadougou',
  paymentProvider: process.env.PAYMENT_PROVIDER ?? 'mock',
  diapayApiBaseUrl: process.env.DIAPAY_API_BASE_URL ?? '',
  diapayApiKey: process.env.DIAPAY_API_KEY ?? '',
  diapaySecretKey: process.env.DIAPAY_SECRET_KEY ?? '',
  diapayPublicKey: process.env.DIAPAY_PUBLIC_KEY ?? '',
  diapayWebhookSecret: process.env.DIAPAY_WEBHOOK_SECRET ?? '',
  diapayApiTimeout: Number(process.env.DIAPAY_API_TIMEOUT ?? 15000),
  diamarketSuccessUrl: process.env.DIAMARKET_SUCCESS_URL ?? 'http://localhost:3000/orders/success',
  diamarketCancelUrl: process.env.DIAMARKET_CANCEL_URL ?? 'http://localhost:3000/orders/cancel',
  paymentDefaultCurrency: process.env.PAYMENT_DEFAULT_CURRENCY ?? 'FCFA'
};
