const DEFAULT_FUNCTIONS_BASE_URL = 'https://asia-southeast1-sharvit-1.cloudfunctions.net';
const FUNCTIONS_BASE_URL = process.env.REACT_APP_FUNCTIONS_BASE_URL || DEFAULT_FUNCTIONS_BASE_URL;

export interface MarketData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  volumeMa?: number | null;
  volume_ma?: number | null;
  volumeRatio?: number | null;
  volume_ratio?: number | null;
  accountEquity: string;
  timestamp: number;
  timeframe: string;
  trend?: 'bullish' | 'bearish' | 'neutral';
  indicators?: {
    ema6?: number | null;
    ema9?: number | null;
    ema20: number | null;
    ema50: number | null;
    rsi14: number | null;
    rsi14Prev?: number | null;
    rsiState?: 'oversold' | 'overbought' | 'neutral' | null;
    atr14: number | null;
    adx14: number | null;
  };
  history: Array<{
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    timestamp: number;
  }>;
}

export interface OHLCVData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
  timeframe: string;
}

export interface LivePriceData {
  lastPrice: number;
  markPrice: number;
  bidPrice: number;
  askPrice: number;
  timestamp: number;
}

export interface OpenInterestData {
  symbol: string;
  openInterest: number;
  openInterestUsd?: number | null;
  markPrice?: number | null;
  openInterestMa?: number | null;
  oiRatio?: number | null;
  timestamp: number;
  timeframe: string;
  indicators?: {
    deltaOpenInterest?: number | null;
    deltaOpenInterest3?: number | null;
    normalizedDeltaOpenInterest?: number | null;
    normalizedDeltaOpenInterest3?: number | null;
    logDeltaOpenInterest?: number | null;
    logDeltaOpenInterest3?: number | null;
  };
}

class ApiService {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${FUNCTIONS_BASE_URL.replace(/\/$/, '')}/${endpoint}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options?.headers ?? {})
        }
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${message}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error calling Firebase function ${endpoint}:`, error);
      throw error;
    }
  }

  async getMarketData(): Promise<MarketData> {
    return this.request<MarketData>('getMarketData');
  }

  async getOHLCV(): Promise<OHLCVData> {
    return this.request<OHLCVData>('getOHLCV');
  }

  async getLivePrice(): Promise<LivePriceData> {
    return this.request<LivePriceData>('getLivePrice');
  }

  async getHealth(): Promise<{ status: string; timestamp: string; uptime: number }> {
    return this.request('healthCheck');
  }

  async getOpenInterest(): Promise<OpenInterestData> {
    return this.request<OpenInterestData>('getOpenInterest');
  }
}

export const apiService = new ApiService();
