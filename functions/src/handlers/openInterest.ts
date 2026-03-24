import type { Request, Response } from 'express';
import { binanceService } from '../services/binanceService';
import { cacheService } from '../services/cacheService';
import {
  getIntervalDurationMs,
  getOpenInterestPeriod,
  createInsufficientDataError,
  OPEN_INTEREST_MA_PERIOD
} from '../utils/calculations';
import { allowCors } from '../utils/cors';

export const getOpenInterestHandler = async (req: Request, res: Response): Promise<void> => {
  if (allowCors(req, res)) {
    return;
  }

  try {
    const cacheKey = 'open-interest';
    const cacheTtl = parseInt(process.env.CACHE_TTL_OPEN_INTEREST || '5', 10);
    const cached = await cacheService.get(cacheKey);

    if (cached) {
      res.json(cached);
      return;
    }

    const interval = process.env.INTERVAL || '15m';
    const intervalMs = getIntervalDurationMs(interval);
    const openInterestPeriod = getOpenInterestPeriod(interval);

    const [openInterestData, premiumIndexData, openInterestHistoryData, klineData] = await Promise.all([
      binanceService.getFuturesOpenInterest(),
      binanceService.getPremiumIndex(),
      binanceService.getFuturesOpenInterestHistory(openInterestPeriod, 30),
      binanceService.getKlines(10)
    ]);

    const now = Date.now();
    const currentBucketStart = Math.floor(now / intervalMs) * intervalMs;
    const lastKline = klineData[klineData.length - 1];
    const lastCloseTime = lastKline?.closeTime;
    const lastIsClosed = typeof lastCloseTime === 'number' && lastCloseTime <= currentBucketStart;
    const closedCandles = lastIsClosed ? klineData : klineData.slice(0, -1);

    if (!closedCandles.length) {
      throw createInsufficientDataError(1, 0, 'No candle data available for open interest alignment');
    }

    const latestClosedCandle = closedCandles[closedCandles.length - 1] ?? null;
    const latestClosedTimestamp = latestClosedCandle?.closeTime ?? null;
    const previousClosedTimestamp = closedCandles.length > 1 ? closedCandles[closedCandles.length - 2]?.closeTime : null;
    const thirdClosedTimestamp = closedCandles.length > 2 ? closedCandles[closedCandles.length - 3]?.closeTime : null;
    const fourthClosedTimestamp = closedCandles.length > 4 ? closedCandles[closedCandles.length - 5]?.closeTime : null;

    const parsedOpenInterestHistory = Array.isArray(openInterestHistoryData)
      ? openInterestHistoryData
          .map(entry => ({
            timestamp: typeof entry.timestamp === 'number' ? entry.timestamp : Number(entry.timestamp) || null,
            openInterest: parseFloat(entry.sumOpenInterest ?? (entry as any).openInterest ?? '0')
          }))
          .filter(entry => Number.isFinite(entry.openInterest) && Number.isFinite(entry.timestamp))
          .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
      : [];

    const findLatestOiBefore = (targetTimestamp: number | null) => {
      if (!Number.isFinite(targetTimestamp)) {
        return null;
      }

      for (let i = parsedOpenInterestHistory.length - 1; i >= 0; i--) {
        const entry = parsedOpenInterestHistory[i];
        if ((entry.timestamp ?? 0) <= (targetTimestamp ?? 0)) {
          return entry.openInterest;
        }
      }

      return null;
    };

    const latestOiAligned = findLatestOiBefore(latestClosedTimestamp) ?? parseFloat(openInterestData?.openInterest ?? '0');
    const getAlignedOiFallback = (timestampFallback: number | null) => {
      const aligned = findLatestOiBefore(timestampFallback);
      return Number.isFinite(aligned) ? aligned : latestOiAligned;
    };

    const previousOiAligned = getAlignedOiFallback(previousClosedTimestamp);
    const thirdOiAligned = getAlignedOiFallback(thirdClosedTimestamp);
    const fourthOiAligned = getAlignedOiFallback(fourthClosedTimestamp);

    const hasLatest = Number.isFinite(latestOiAligned);
    const hasPrevious = Number.isFinite(previousOiAligned) && previousOiAligned !== 0;
    const hasThird = Number.isFinite(thirdOiAligned) && thirdOiAligned !== 0;
    const hasFourth = Number.isFinite(fourthOiAligned) && fourthOiAligned !== 0;

    const openInterestDelta = hasLatest && Number.isFinite(previousOiAligned) && previousOiAligned !== null
      ? latestOiAligned - previousOiAligned
      : null;
    const openInterestDelta3 = hasLatest && Number.isFinite(fourthOiAligned) && fourthOiAligned !== null
      ? latestOiAligned - fourthOiAligned
      : null;

    const midpoint = hasLatest && hasPrevious && previousOiAligned !== null
      ? (latestOiAligned + previousOiAligned) / 2
      : null;
    const denomSeries3 = hasLatest && hasPrevious && hasThird && hasFourth &&
      previousOiAligned !== null && thirdOiAligned !== null && fourthOiAligned !== null
      ? [latestOiAligned, previousOiAligned, thirdOiAligned, fourthOiAligned]
      : null;
    const midpoint3 = denomSeries3
      ? denomSeries3.reduce((sum, value) => sum + value, 0) / denomSeries3.length
      : null;

    const normalizedOpenInterestDelta = Number.isFinite(midpoint) && midpoint !== null && midpoint !== 0 && openInterestDelta !== null
      ? openInterestDelta / midpoint
      : null;
    const normalizedOpenInterestDelta3 = Number.isFinite(midpoint3) && midpoint3 !== null && midpoint3 !== 0 && openInterestDelta3 !== null
      ? openInterestDelta3 / midpoint3
      : null;

    const logDeltaOpenInterest = hasLatest && hasPrevious && latestOiAligned > 0 && previousOiAligned !== null && previousOiAligned > 0
      ? Math.log(latestOiAligned / previousOiAligned)
      : null;
    const logDeltaOpenInterest3 = hasLatest && hasFourth && latestOiAligned > 0 && fourthOiAligned !== null && fourthOiAligned > 0
      ? Math.log(latestOiAligned / fourthOiAligned)
      : null;

    const openInterestValueParsed = parseFloat(openInterestData?.openInterest ?? '0');
    const openInterestValue = Number.isFinite(openInterestValueParsed) ? openInterestValueParsed : 0;
    const markPrice = premiumIndexData?.markPrice ? parseFloat(premiumIndexData.markPrice) : null;
    const openInterestUsd = markPrice !== null ? openInterestValue * markPrice : null;

    const recentOiValuesForMa = parsedOpenInterestHistory
      .slice(-OPEN_INTEREST_MA_PERIOD)
      .map(entry => entry.openInterest);
    const openInterestMovingAverage = recentOiValuesForMa.length
      ? recentOiValuesForMa.reduce((sum, value) => sum + value, 0) / recentOiValuesForMa.length
      : null;
    const currentOiForRatio = hasLatest ? latestOiAligned : openInterestValue;
    const oiRatio = Number.isFinite(openInterestMovingAverage) && openInterestMovingAverage !== null &&
      openInterestMovingAverage !== 0 && Number.isFinite(currentOiForRatio)
        ? currentOiForRatio / openInterestMovingAverage
        : null;

    const response = {
      symbol: openInterestData?.symbol ?? binanceService.getSymbol(),
      openInterest: openInterestValue,
      openInterestUsd,
      markPrice,
      openInterestMa: Number.isFinite(openInterestMovingAverage) ? openInterestMovingAverage : null,
      oiRatio: Number.isFinite(oiRatio) ? oiRatio : null,
      timestamp: latestClosedTimestamp ?? Date.now(),
      timeframe: interval,
      indicators: {
        deltaOpenInterest: Number.isFinite(openInterestDelta) ? openInterestDelta : null,
        deltaOpenInterest3: Number.isFinite(openInterestDelta3) ? openInterestDelta3 : null,
        normalizedDeltaOpenInterest: Number.isFinite(normalizedOpenInterestDelta) ? normalizedOpenInterestDelta : null,
        normalizedDeltaOpenInterest3: Number.isFinite(normalizedOpenInterestDelta3) ? normalizedOpenInterestDelta3 : null,
        logDeltaOpenInterest: Number.isFinite(logDeltaOpenInterest) ? logDeltaOpenInterest : null,
        logDeltaOpenInterest3: Number.isFinite(logDeltaOpenInterest3) ? logDeltaOpenInterest3 : null
      }
    };

    await cacheService.set(cacheKey, response, cacheTtl);
    res.json(response);
  } catch (error: any) {
    console.error('Error fetching open interest:', error?.message || error);
    res.status(500).json({ error: 'Failed to fetch open interest' });
  }
};
