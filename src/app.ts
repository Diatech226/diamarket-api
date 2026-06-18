import express from 'express';
import path from 'path';
import cors from 'cors';
import morgan from 'morgan';
import { apiRouter } from './routes';
import { errorHandler } from './middlewares/error.middleware';
import { env } from './config/env';
import { systemRouter } from './routes/system.routes';
import { sanitizeRequest } from './middlewares/sanitize.middleware';

const rateBucket = new Map<string, { count: number; resetAt: number }>();

const isAllowedOrigin = (origin: string | undefined) => {
  if (!origin) return true;

  if (env.corsAllowedOrigins.length > 0) {
    return env.corsAllowedOrigins.includes(origin);
  }

  return env.nodeEnv === 'development' && /localhost|diamarket/.test(origin);
};

export const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (env.nodeEnv === 'production') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
app.use(
  cors({
    origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  })
);
app.use((req, res, next) => {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const current = rateBucket.get(key) || { count: 0, resetAt: now + 15 * 60 * 1000 };
  if (now > current.resetAt) {
    current.count = 0;
    current.resetAt = now + 15 * 60 * 1000;
  }
  current.count += 1;
  rateBucket.set(key, current);
  if (current.count > 300) return res.status(429).json({ message: 'Too many requests' });
  next();
});
app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => {
    (req as express.Request & { rawBody?: string }).rawBody = buf.toString('utf8');
  }
}));
app.use(sanitizeRequest);
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads'), { fallthrough: false, dotfiles: 'deny' }));
app.use(systemRouter);
app.use('/api', apiRouter);
app.use(errorHandler);
