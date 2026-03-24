import { KlineData } from '../services/binanceService';

export const INTERVAL_MS_MAP: Record<string, number> = {
  '1m': 60_000,
  '3m': 180_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '2h': 7_200_000,
  '4h': 14_400_000,
  '6h': 21_600_000,
  '8h': 28_800_000,
  '12h': 43_200_000,
  '1d': 86_400_000,
  '3d': 259_200_000,
  '1w': 604_800_000,
  '1M': 2_592_000_000
};

export const REQUIRED_RSI_SOURCE = 150;
export const ATR_PERIOD = 14;
export const SUPPORTED_OPEN_INTEREST_PERIODS = new Set(['5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h']);
export const VOLUME_MA_PERIOD = 9;
export const OPEN_INTEREST_MA_PERIOD = 20;
export const RSI_OVERSOLD_THRESHOLD = 30;
export const RSI_OVERBOUGHT_THRESHOLD = 70;

export const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const createInsufficientDataError = (
  required: number, 
  received: number, 
  message: string = 'Insufficient closed candles', 
  code: string = 'INSUFFICIENT_MARKET_DATA'
) => {
  const error = new Error(message) as any;
  error.code = code;
  error.required = required;
  error.received = received;
  return error;
};

export const getIntervalDurationMs = (interval: string): number => {
  return INTERVAL_MS_MAP[interval] ?? INTERVAL_MS_MAP['15m'];
};

export const getOpenInterestPeriod = (interval: string): string => {
  return SUPPORTED_OPEN_INTEREST_PERIODS.has(interval) ? interval : '15m';
};

export const computeEma = (values: number[], period: number): number | null => {
  if (values.length < period) {
    return null;
  }

  const smoothing = 2 / (period + 1);
  const initialSlice = values.slice(0, period);
  let ema = initialSlice.reduce((sum, value) => sum + value, 0) / period;

  for (let i = period; i < values.length; i++) {
    ema = (values[i] - ema) * smoothing + ema;
  }

  return ema;
};

export const computeRsiRma = (values: number[], period: number = 14): number | null => {
  if (values.length < period + 1) {
    return null;
  }

  let gainSum = 0;
  let lossSum = 0;

  for (let i = 1; i <= period; i++) {
    const delta = values[i] - values[i - 1];
    if (delta > 0) {
      gainSum += delta;
    } else if (delta < 0) {
      lossSum += Math.abs(delta);
    }
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  const smoothingDenominator = period;
  const smoothingMultiplier = period - 1;

  for (let i = period + 1; i < values.length; i++) {
    const delta = values[i] - values[i - 1];
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? Math.abs(delta) : 0;
    avgGain = ((avgGain * smoothingMultiplier) + gain) / smoothingDenominator;
    avgLoss = ((avgLoss * smoothingMultiplier) + loss) / smoothingDenominator;
  }

  if (avgLoss === 0) {
    if (avgGain === 0) {
      return 50;
    }
    return 100;
  }

  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
};

export const computeAtrRma = (candles: KlineData[], period: number = ATR_PERIOD): number | null => {
  if (!Array.isArray(candles) || candles.length < period + 1) {
    return null;
  }

  const trueRanges: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const current = candles[i];
    const previous = candles[i - 1];
    const high = parseFloat(current.high);
    const low = parseFloat(current.low);
    const prevClose = parseFloat(previous.close);
    const trueRange = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(trueRange);
  }

  if (trueRanges.length < period) {
    return null;
  }

  let atr = trueRanges.slice(0, period).reduce((sum, value) => sum + value, 0) / period;

  for (let i = period; i < trueRanges.length; i++) {
    atr = ((atr * (period - 1)) + trueRanges[i]) / period;
  }

  return atr;
};

export const computeAdx = (candles: KlineData[], period: number = ATR_PERIOD): number | null => {
  if (!Array.isArray(candles) || candles.length < period + 1) {
    return null;
  }

  const trValues: number[] = [];
  const plusDmValues: number[] = [];
  const minusDmValues: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const current = candles[i];
    const previous = candles[i - 1];
    const high = parseFloat(current.high);
    const low = parseFloat(current.low);
    const prevHigh = parseFloat(previous.high);
    const prevLow = parseFloat(previous.low);
    const prevClose = parseFloat(previous.close);

    const upMove = high - prevHigh;
    const downMove = prevLow - low;
    const plusDm = upMove > downMove && upMove > 0 ? upMove : 0;
    const minusDm = downMove > upMove && downMove > 0 ? downMove : 0;
    const trueRange = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );

    trValues.push(trueRange);
    plusDmValues.push(plusDm);
    minusDmValues.push(minusDm);
  }

  if (trValues.length < period) {
    return null;
  }

  let atrSmoothed = trValues.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  let plusDmSmoothed = plusDmValues.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  let minusDmSmoothed = minusDmValues.slice(0, period).reduce((sum, value) => sum + value, 0) / period;

  const computeDx = (): number => {
    if (atrSmoothed === 0) {
      return 0;
    }
    const plusDi = (plusDmSmoothed / atrSmoothed) * 100;
    const minusDi = (minusDmSmoothed / atrSmoothed) * 100;
    const diSum = plusDi + minusDi;
    if (diSum === 0) {
      return 0;
    }
    return (Math.abs(plusDi - minusDi) / diSum) * 100;
  };

  const dxValues = [computeDx()];

  for (let i = period; i < trValues.length; i++) {
    atrSmoothed = atrSmoothed - (atrSmoothed / period) + trValues[i];
    plusDmSmoothed = plusDmSmoothed - (plusDmSmoothed / period) + plusDmValues[i];
    minusDmSmoothed = minusDmSmoothed - (minusDmSmoothed / period) + minusDmValues[i];
    dxValues.push(computeDx());
  }

  if (dxValues.length < period) {
    return null;
  }

  let adx = dxValues.slice(0, period).reduce((sum, value) => sum + value, 0) / period;

  for (let i = period; i < dxValues.length; i++) {
    adx = ((adx * (period - 1)) + dxValues[i]) / period;
  }

  return adx;
};
