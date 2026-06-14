import { Router } from 'express';
import mongoose from 'mongoose';

const databaseStates: Record<number, string> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting'
};

const databaseStatus = () => ({
  status: databaseStates[mongoose.connection.readyState] ?? 'unknown',
  ready: mongoose.connection.readyState === 1
});

export const systemRouter = Router();

systemRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'diamarket-api', check: 'liveness' });
});

systemRouter.get('/ready', async (_req, res) => {
  const database = databaseStatus();

  if (database.ready && mongoose.connection.db) {
    try {
      await mongoose.connection.db.admin().ping();
    } catch {
      database.ready = false;
      database.status = 'unreachable';
    }
  }

  res.status(database.ready ? 200 : 503).json({
    status: database.ready ? 'ready' : 'not_ready',
    service: 'diamarket-api',
    check: 'readiness',
    dependencies: { database }
  });
});
