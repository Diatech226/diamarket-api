import { Router } from 'express';
import mongoose from 'mongoose';

const databaseStates: Record<number, string> = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
const databaseStatus = () => ({ status: databaseStates[mongoose.connection.readyState] ?? 'unknown', ready: mongoose.connection.readyState === 1 });
const publicEnv = () => Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(NODE_ENV|PORT|APP_|PUBLIC_|NEXT_PUBLIC_)/.test(key) && !/(secret|password|mongodb|uri|token|api[_-]?key|jwt)/i.test(key)));

export const systemRouter = Router();

systemRouter.get('/health', (_req, res) => { res.json({ status: 'ok', service: 'diamarket-api', check: 'liveness' }); });
systemRouter.get('/ready', async (_req, res) => {
  const database = databaseStatus();
  if (database.ready && mongoose.connection.db) { try { await mongoose.connection.db.admin().ping(); } catch { database.ready = false; database.status = 'unreachable'; } }
  res.status(database.ready ? 200 : 503).json({ status: database.ready ? 'ready' : 'not_ready', service: 'diamarket-api', check: 'readiness', dependencies: { database } });
});
systemRouter.get('/system/health', async (_req, res) => {
  const database = databaseStatus();
  res.json({ success: true, data: { api: { status: 'ok' }, mongo: database, storage: { status: 'ok', provider: 'local' }, email: { status: 'unknown' }, diapay: { status: 'unknown' }, diaexpress: { status: 'unknown' }, recentErrors: [] } });
});
systemRouter.get('/system/env', (_req, res) => res.json({ success: true, data: publicEnv() }));
systemRouter.get('/system/jobs', (_req, res) => res.json({ success: true, data: [{ name: 'audit-retention', status: 'scheduled' }, { name: 'payment-reconciliation', status: 'scheduled' }, { name: 'shipping-sync', status: 'scheduled' }] }));
