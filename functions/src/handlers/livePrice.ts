import type { Request, Response } from 'express';
import { binanceService } from '../services/binanceService';
import { cacheService } from '../services/cacheService';
import { allowCors } from '../utils/cors';

export const getLivePriceHandler = async (req: Request, res: Response): Promise<void> => {
  if (allowCors(req, res)) {
    return;
  }

  try {
    const cacheKey = 'live-price';
    const cached = await cacheService.get(cacheKey);

    if (cached) {
      res.json(cached);
      return;
    }

    const [priceData, bookTickerData] = await Promise.all([
      binanceService.getPrice(),
      binanceService.getBookTicker()
    ]);

    const response = {
      lastPrice: parseFloat(priceData.price),
      markPrice: (parseFloat(bookTickerData.bidPrice) + parseFloat(bookTickerData.askPrice)) / 2,
      bidPrice: parseFloat(bookTickerData.bidPrice),
      askPrice: parseFloat(bookTickerData.askPrice),
      timestamp: Date.now()
    };

    await cacheService.set(cacheKey, response, parseInt(process.env.CACHE_TTL_LIVE_PRICE || '5'));
    res.json(response);
  } catch (error: any) {
    console.error('Error fetching live price:', error.message);
    res.status(500).json({ error: 'Failed to fetch live price' });
  }
};
