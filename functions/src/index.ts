import { initializeApp, getApps } from 'firebase-admin/app';
import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { healthCheckHandler } from './handlers/healthCheck';
import { getMarketDataHandler } from './handlers/marketData';
import { getOHLCVHandler } from './handlers/ohlcv';
import { getLivePriceHandler } from './handlers/livePrice';
import { getOpenInterestHandler } from './handlers/openInterest';
import { tradingScheduler } from './handlers/tradingScheduler';
import { tradingTestHandler } from './handlers/tradingTest';

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp();
}

// Set global options
setGlobalOptions({
  region: 'asia-southeast1'
});

export const healthCheck = onRequest(healthCheckHandler);
export const getMarketData = onRequest(getMarketDataHandler);
export const getOHLCV = onRequest(getOHLCVHandler);
export const getLivePrice = onRequest(getLivePriceHandler);
export const getOpenInterest = onRequest(getOpenInterestHandler);
export const tradingTest = onRequest(tradingTestHandler);

// Scheduled functions
export { tradingScheduler };
