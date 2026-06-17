import { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { rateLimit } from '../middlewares/rate-limit.middleware';
import { requireAuth } from '../middlewares/requireAuth';

const asyncHandler = (handler: RequestHandler) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export const authRouter = Router();
const authRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, prefix: 'auth' });
authRouter.post('/register', authRateLimit, asyncHandler(authController.register));
authRouter.post('/login', authRateLimit, asyncHandler(authController.login));
authRouter.post('/forgot-password', authRateLimit, asyncHandler(authController.forgotPassword));
authRouter.post('/reset-password', authRateLimit, asyncHandler(authController.resetPassword));
authRouter.get('/me', requireAuth, asyncHandler(authController.me));
authRouter.get('/session', requireAuth, asyncHandler(authController.me));
authRouter.post('/logout', authController.logout);
authRouter.get('/oauth/providers', authController.providers);
