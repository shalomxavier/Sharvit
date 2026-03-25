import type { Request, Response } from 'express';
import { binanceService } from '../services/binanceService';
import { allowCors } from '../utils/cors';

export const getLivePriceHandler = async (req: Request, res: Response): Promise<void> => {
  if (allowCors(req, res)) {
    return;
  }

  try {
    const priceData = await binanceService.getPrice();

    if (!priceData) {
      res.status(500).json({ error: 'Failed to fetch live price' });
      return;
    }

    const [bookTickerResult, premiumIndexResult] = await Promise.allSettled([
      binanceService.getBookTicker(),
      binanceService.getPremiumIndex()
    ]);

    if (!priceData.price) {
      res.status(500).json({ error: 'Live price unavailable' });
      return;
    }

    const parseNumber = (value?: string | null): number | null => {
      if (typeof value !== 'string') {
        return null;
      }

      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const lastPrice = parseNumber(priceData.price);

    if (lastPrice === null) {
      res.status(500).json({ error: 'Invalid live price received' });
      return;
    }

    const bookTicker = bookTickerResult.status === 'fulfilled' ? bookTickerResult.value : null;
    const premiumIndex = premiumIndexResult.status === 'fulfilled' ? premiumIndexResult.value : null;

    if (bookTickerResult.status === 'rejected') {
      console.warn('Failed to fetch book ticker:', bookTickerResult.reason);
    }

    if (premiumIndexResult.status === 'rejected') {
      console.warn('Failed to fetch premium index:', premiumIndexResult.reason);
    }

    const response = {
      symbol: priceData.symbol,
      lastPrice,
      bidPrice: parseNumber(bookTicker?.bidPrice) ?? lastPrice,
      askPrice: parseNumber(bookTicker?.askPrice) ?? lastPrice,
      markPrice: parseNumber(premiumIndex?.markPrice) ?? lastPrice,
      timestamp: Date.now()
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error fetching live price:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};
