import axios, { AxiosInstance } from 'axios';

export interface KlineData {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteAssetVolume: string;
  numberOfTrades: number;
  takerBuyBaseAssetVolume: string;
  takerBuyQuoteAssetVolume: string;
}

export interface PriceData {
  symbol: string;
  price: string;
}

export interface BookTickerData {
  symbol: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
}

export interface OpenInterestData {
  symbol: string;
  openInterest: string;
  time: number;
}

export interface OpenInterestHistoryData {
  symbol: string;
  sumOpenInterest: string;
  sumOpenInterestValue: string;
  timestamp: number;
}

export interface PremiumIndexData {
  symbol: string;
  markPrice: string;
  indexPrice: string;
  estimatedSettlePrice: string;
  lastFundingRate: string;
  nextFundingTime: number;
  interestRate: string;
  time: number;
}

class BinanceService {
  private baseURL: string;
  private futuresBaseURL: string;
  private symbol: string;
  private interval: string;
  private maxRetries: number;
  private retryDelay: number;
  private client: AxiosInstance;
  private futuresClient: AxiosInstance;

  constructor() {
    this.baseURL = process.env.BINANCE_BASE_URL || 'https://api.binance.com';
    this.futuresBaseURL = process.env.BINANCE_FUTURES_BASE_URL || 'https://fapi.binance.com';
    this.symbol = process.env.SYMBOL || 'BTCUSDT';
    this.interval = process.env.INTERVAL || '15m';
    this.maxRetries = parseInt(process.env.MAX_RETRIES || '3');
    this.retryDelay = parseInt(process.env.RATE_LIMIT_DELAY || '1000');
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
    });

    this.futuresClient = axios.create({
      baseURL: this.futuresBaseURL,
      timeout: 10000,
    });
  }

  private async makeRequest<T>(endpoint: string, params: any = {}, client: AxiosInstance = this.client): Promise<T> {
    let retries = 0;
    
    while (retries < this.maxRetries) {
      try {
        const response = await client.get(endpoint, { params });
        return response.data;
      } catch (error: any) {
        retries++;
        
        if (error.response?.status === 429 || error.response?.status === 418) {
          // Rate limit hit, exponential backoff
          const delay = this.retryDelay * Math.pow(2, retries - 1);
          console.warn(`Rate limit hit, retrying in ${delay}ms (attempt ${retries}/${this.maxRetries})`);
          await this.sleep(delay);
          continue;
        }
        
        if (retries === this.maxRetries) {
          console.error(`Failed to fetch ${endpoint} after ${this.maxRetries} attempts:`, error.message);
          throw error;
        }
        
        // For other errors, wait a bit before retrying
        await this.sleep(this.retryDelay);
      }
    }
    
    throw new Error('Max retries exceeded');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getKlines(limit?: number): Promise<KlineData[]> {
    const params = {
      symbol: this.symbol,
      interval: this.interval,
      limit: limit || parseInt(process.env.MAX_CANDLES || '100')
    };

    const data = await this.makeRequest<any[]>('/api/v3/klines', params);
    
    return data.map(kline => ({
      openTime: kline[0],
      open: kline[1],
      high: kline[2],
      low: kline[3],
      close: kline[4],
      volume: kline[5],
      closeTime: kline[6],
      quoteAssetVolume: kline[7],
      numberOfTrades: kline[8],
      takerBuyBaseAssetVolume: kline[9],
      takerBuyQuoteAssetVolume: kline[10]
    }));
  }

  async getTicker24hr(): Promise<any> {
    const params = { symbol: this.symbol };
    return await this.makeRequest('/api/v3/ticker/24hr', params);
  }

  async getPrice(): Promise<PriceData> {
    const params = { symbol: this.symbol };
    return await this.makeRequest<PriceData>('/api/v3/ticker/price', params);
  }

  async getBookTicker(): Promise<BookTickerData> {
    const params = { symbol: this.symbol };
    return await this.makeRequest<BookTickerData>('/api/v3/ticker/bookTicker', params);
  }

  async getFuturesOpenInterest(): Promise<OpenInterestData> {
    const params = { symbol: this.symbol };
    return await this.makeRequest<OpenInterestData>('/fapi/v1/openInterest', params, this.futuresClient);
  }

  async getFuturesOpenInterestHistory(period: string = '15m', limit: number = 30): Promise<OpenInterestHistoryData[]> {
    const params = {
      symbol: this.symbol,
      period,
      limit
    };

    return await this.makeRequest<OpenInterestHistoryData[]>('/futures/data/openInterestHist', params, this.futuresClient);
  }

  async getPremiumIndex(): Promise<PremiumIndexData> {
    const params = { symbol: this.symbol };
    return await this.makeRequest<PremiumIndexData>('/fapi/v1/premiumIndex', params, this.futuresClient);
  }

  getSymbol(): string {
    return this.symbol;
  }
}

export const binanceService = new BinanceService();
