import { Request, Response } from 'express';

export const baseController = {
  health: (_req: Request, res: Response) => res.json({ status: 'ok', service: 'diamarket-api' }),
  notImplemented: (name: string) => (_req: Request, res: Response) => res.status(501).json({ message: `${name} endpoint scaffolded` })
};
