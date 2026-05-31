import { NextFunction, Request, Response } from 'express';

type Validator = (req: Request) => string | null;

export const validateRequest = (validator: Validator) => (req: Request, res: Response, next: NextFunction) => {
  const error = validator(req);
  if (error) {
    return res.status(400).json({ message: 'Validation failed', error });
  }
  next();
};
