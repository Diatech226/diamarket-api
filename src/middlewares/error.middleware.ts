import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError) {
    return res.status(400).json({ success: false, message: 'Validation failed' });
  }
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
    return res.status(409).json({ success: false, message: 'Resource already exists' });
  }
  if (process.env.NODE_ENV !== 'production' && error instanceof Error) console.error(error);
  return res.status(500).json({ success: false, message: 'Internal server error' });
}
