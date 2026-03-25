import type { Request, Response } from 'express';
import { binanceService } from '../services/binanceService';
import {
  getIntervalDurationMs,
  computeEma,
  computeRsiRma,
  computeAtrRma,
  computeAdx,
  parsePositiveInt,
  createInsufficientDataError,
  REQUIRED_RSI_SOURCE,
  ATR_PERIOD,
  VOLUME_MA_PERIOD,
  RSI_OVERSOLD_THRESHOLD,
  RSI_OVERBOUGHT_THRESHOLD
} from '../utils/calculations';
import { allowCors } from '../utils/cors';

export const getMarketDataHandler = async (req: Request, res: Response): Promise<void> => {
  if (allowCors(req, res)) {
    return;
  }

  try {
    const interval = process.env.INTERVAL || '15m';
    const intervalMs = getIntervalDurationMs(interval);
    const configuredHistory = Math.max(
      parsePositiveInt(process.env.MAX_HISTORY, REQUIRED_RSI_SOURCE),
      REQUIRED_RSI_SOURCE
    );
    const requiredHistory = Math.max(configuredHistory, REQUIRED_RSI_SOURCE);
    const maxCandlesConfig = parsePositiveInt(process.env.MAX_CANDLES, requiredHistory + 1);
    const fetchLimit = Math.max(requiredHistory + 1, maxCandlesConfig);

    const klineData = await binanceService.getKlines(fetchLimit);

    const now = Date.now();
    const currentBucketStart = Math.floor(now / intervalMs) * intervalMs;
    const lastKline = klineData[klineData.length - 1];
    const lastCloseTime = lastKline?.closeTime;
    const lastIsClosed = typeof lastCloseTime === 'number' && lastCloseTime <= currentBucketStart;
    const closedCandles = lastIsClosed ? klineData : klineData.slice(0, -1);

    if (!closedCandles.length) {
      throw createInsufficientDataError(REQUIRED_RSI_SOURCE, 0, 'No candle data available');
    }

    if (closedCandles.length < REQUIRED_RSI_SOURCE) {
      throw createInsufficientDataError(
        REQUIRED_RSI_SOURCE,
        closedCandles.length,
        'Insufficient closed candles after filtering',
        'INSUFFICIENT_MARKET_DATA'
      );
    }

    const requiredCandles = requiredHistory;

    if (closedCandles.length < requiredCandles) {
      throw createInsufficientDataError(
        requiredCandles,
        closedCandles.length,
        'Requested history exceeds available closed candles',
        'INVALID_HISTORY_REQUEST'
      );
    }

    const latestClosedCandle = closedCandles[closedCandles.length - 1];

    const historySource = closedCandles.length ? closedCandles : klineData;
    const history = historySource.slice(-configuredHistory);

    const closes = closedCandles.map(candle => parseFloat(candle.close));
    const volumes = closedCandles.map(candle => parseFloat(candle.volume));
    const ema6 = computeEma(closes, 6);
    const ema9 = computeEma(closes, 9);
    const ema20 = computeEma(closes, 20);
    const ema50 = computeEma(closes, 50);
    const closesForRsi = closes.slice(-REQUIRED_RSI_SOURCE);
    const rsi14 = computeRsiRma(closesForRsi, 14);
    const closesForPreviousRsi = closesForRsi.slice(0, -1);
    const rsi14Previous = closesForPreviousRsi.length >= 15
      ? computeRsiRma(closesForPreviousRsi, 14)
      : null;
    const rsiState = Number.isFinite(rsi14) && rsi14 !== null
      ? (rsi14 < RSI_OVERSOLD_THRESHOLD
        ? 'oversold'
        : rsi14 > RSI_OVERBOUGHT_THRESHOLD
          ? 'overbought'
          : 'neutral')
      : null;
    const atr14 = computeAtrRma(closedCandles, ATR_PERIOD);
    const adx14 = computeAdx(closedCandles, ATR_PERIOD);
    const recentVolumes = volumes.slice(-VOLUME_MA_PERIOD);
    const volumeMa = recentVolumes.length === VOLUME_MA_PERIOD
      ? recentVolumes.reduce((sum, value) => sum + value, 0) / VOLUME_MA_PERIOD
      : null;
    const latestVolume = parseFloat(latestClosedCandle.volume);
    const volumeRatio = volumeMa && volumeMa !== 0 ? latestVolume / volumeMa : null;

    const trend = Number.isFinite(ema20) && Number.isFinite(ema50) && ema20 !== null && ema50 !== null
      ? ema20 > ema50
        ? 'bullish'
        : ema20 < ema50
          ? 'bearish'
          : 'neutral'
      : 'neutral';

    const response = {
      open: parseFloat(latestClosedCandle.open),
      high: parseFloat(latestClosedCandle.high),
      low: parseFloat(latestClosedCandle.low),
      close: parseFloat(latestClosedCandle.close),
      volume: parseFloat(latestClosedCandle.volume),
      volumeMa,
      volume_ma: volumeMa,
      volumeRatio,
      volume_ratio: volumeRatio,
      accountEquity: 'placeholder_account_equity',
      timestamp: latestClosedCandle.closeTime,
      timeframe: interval,
      trend,
      indicators: {
        ema6,
        ema9,
        ema20,
        ema50,
        rsi14,
        rsi14Prev: rsi14Previous,
        rsiState,
        atr14,
        adx14
      },
      history: history.map(candle => ({
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close),
        volume: parseFloat(candle.volume),
        timestamp: candle.closeTime
      }))
    };

    res.json(response);
  } catch (error: any) {
    if (error?.code === 'INSUFFICIENT_MARKET_DATA' || error?.code === 'INVALID_HISTORY_REQUEST') {
      res.status(400).json({
        error: error.code,
        required: error.required ?? REQUIRED_RSI_SOURCE,
        received: error.received ?? 0
      });
      return;
    }

    console.error('Error fetching market data:', error?.message || error);
    res.status(500).json({ error: 'Failed to fetch market data' });
  }
};
