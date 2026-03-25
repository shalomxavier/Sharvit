import type { Request, Response } from 'express';
import { binanceService } from '../services/binanceService';
import { getIntervalDurationMs } from '../utils/calculations';
import { allowCors } from '../utils/cors';

export const getOHLCVHandler = async (req: Request, res: Response): Promise<void> => {
  if (!allowCors(req, res)) {
    return;
  }

  try {

    const interval = process.env.INTERVAL || '15m';
    const intervalMs = getIntervalDurationMs(interval);
    const klineData = await binanceService.getKlines(2);

    if (!klineData.length) {
      throw new Error('No kline data available');
    }

    const now = Date.now();
    const currentBucketStart = Math.floor(now / intervalMs) * intervalMs;
    const lastCandle = klineData[klineData.length - 1];
    const lastCloseTime = lastCandle?.closeTime;
    const lastIsClosed = typeof lastCloseTime === 'number' && lastCloseTime <= currentBucketStart;
    const latestClosedCandle = lastIsClosed ? lastCandle : klineData[0];

    if (!latestClosedCandle || latestClosedCandle.closeTime > currentBucketStart) {
      throw new Error('Unable to determine latest closed candle');
    }

    const response = {
      open: parseFloat(latestClosedCandle.open),
      high: parseFloat(latestClosedCandle.high),
      low: parseFloat(latestClosedCandle.low),
      close: parseFloat(latestClosedCandle.close),
      volume: parseFloat(latestClosedCandle.volume),
      timestamp: latestClosedCandle.closeTime,
      timeframe: interval
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error fetching OHLCV data:', error?.message || error);
    res.status(500).json({ error: 'Failed to fetch OHLCV data' });
  }
};
