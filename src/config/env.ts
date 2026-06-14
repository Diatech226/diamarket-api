import path from 'path';
import dotenv from 'dotenv';

export const apiEnvPath = path.resolve(__dirname, '../../.env');

dotenv.config({
  path: apiEnvPath,
  override: false
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
  publicRegistrationEnabled: process.env.PUBLIC_REGISTRATION_ENABLED === 'true',
  emailPasswordAuthEnabled: process.env.ENABLE_EMAIL_PASSWORD_AUTH !== 'false',
  defaultPublicRole: 'user',
  jwtSecret: process.env.JWT_SECRET ?? process.env.AUTH_SESSION_SECRET ?? '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  sessionTtlMs: Number(process.env.AUTH_SESSION_TTL_HOURS ?? 168) * 60 * 60 * 1000,
  adminDefaultEmail: (process.env.ADMIN_DEFAULT_EMAIL ?? '').trim().toLowerCase(),
  adminDefaultPassword: process.env.ADMIN_DEFAULT_PASSWORD ?? '',
  adminDefaultName: process.env.ADMIN_DEFAULT_NAME ?? 'Admin Diamarket',
  adminWhitelist: parseList(process.env.ADMIN_WHITELIST).map((email) => email.toLowerCase()),
  allowAuthHeaderBridge: process.env.AUTH_ALLOW_HEADER_BRIDGE === 'true',
  corsAllowedOrigins: parseList(process.env.CORS_ALLOWED_ORIGINS),
  shippingProvider: process.env.SHIPPING_PROVIDER ?? 'diaexpress',
  shippingDemoMode: process.env.SHIPPING_DEMO_MODE === 'true',
  shippingDefaultCurrency: process.env.SHIPPING_DEFAULT_CURRENCY ?? 'XOF',
  diaexpressApiBaseUrl: process.env.DIAEXPRESS_API_BASE_URL ?? '',
  diaexpressApiKey: process.env.DIAEXPRESS_API_KEY ?? '',
  diaexpressWebhookSecret: process.env.DIAEXPRESS_WEBHOOK_SECRET ?? '',
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
  diapayWebhookToleranceMs: Number(process.env.DIAPAY_WEBHOOK_TOLERANCE_SECONDS ?? 300) * 1000,
  diapayApiTimeout: Number(process.env.DIAPAY_API_TIMEOUT ?? 15000),
  diamarketSuccessUrl: process.env.DIAMARKET_SUCCESS_URL ?? 'http://localhost:3000/orders/success',
  diamarketCancelUrl: process.env.DIAMARKET_CANCEL_URL ?? 'http://localhost:3000/orders/cancel',
  paymentDefaultCurrency: process.env.PAYMENT_DEFAULT_CURRENCY ?? 'FCFA'
};
