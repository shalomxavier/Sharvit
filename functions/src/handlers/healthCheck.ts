import type { Request, Response } from 'express';
import { allowCors } from '../utils/cors';

export const healthCheckHandler = async (req: Request, res: Response): Promise<void> => {
  if (allowCors(req, res)) {
    return;
  }

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
};
