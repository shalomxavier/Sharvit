import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService, MarketData, OpenInterestData } from '../services/apiService';
import DataCard from './DataCard';
import LivePriceBanner from './LivePriceBanner';
import TradingCollectionsTable from './TradingCollectionsTable';
import { useLivePrice } from '../hooks/useLivePrice';

interface IndicatorEntry {
  label: string;
  value: number | string | null;
  formatter: (value?: number | string | null) => string;
  secondaryValue?: number | string | null;
  secondaryFormatter?: (value?: number | string | null) => string;
  titleClassName?: string;
  valueClassName?: string;
}

const LowestOf24: React.FC = () => {
  const navigate = useNavigate();
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [previousData, setPreviousData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openInterestData, setOpenInterestData] = useState<OpenInterestData | null>(null);
  const [previousOpenInterestData, setPreviousOpenInterestData] = useState<OpenInterestData | null>(null);
  const [openInterestLoading, setOpenInterestLoading] = useState(true);
  const [openInterestError, setOpenInterestError] = useState<string | null>(null);
  const latestDataRef = useRef<MarketData | null>(null);
  const latestOpenInterestRef = useRef<OpenInterestData | null>(null);
  const [lowHistoryOpen, setLowHistoryOpen] = useState(false);
  const [buySignal, setBuySignal] = useState<{ timestamp: number; price: number } | null>(null);
  const { data: livePriceData } = useLivePrice(5000);
  const previousAllRulesMetRef = useRef(false);
  const previousRuleStatusesRef = useRef<Record<string, boolean>>({});
  const [lastTrueTimestamps, setLastTrueTimestamps] = useState<Record<string, number>>({});

  const fetchMarketData = useCallback(async () => {
    try {
      setError(null);
      const data = await apiService.getMarketData();
      setPreviousData(latestDataRef.current);
      latestDataRef.current = data;
      setMarketData(data);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch market data');
      setLoading(false);
    }
  }, []);

  const fetchOpenInterestData = useCallback(async () => {
    try {
      setOpenInterestError(null);
      const data = await apiService.getOpenInterest();
      setPreviousOpenInterestData(latestOpenInterestRef.current);
      latestOpenInterestRef.current = data;
      setOpenInterestData(data);
      setOpenInterestLoading(false);
    } catch (err) {
      setOpenInterestError(err instanceof Error ? err.message : 'Failed to fetch open interest');
      setOpenInterestLoading(false);
    }
  }, []);

  const POLL_INTERVAL_MS = 30000;

  useEffect(() => {
    fetchMarketData();
    fetchOpenInterestData();

    const marketInterval = setInterval(fetchMarketData, POLL_INTERVAL_MS);
    const oiInterval = setInterval(fetchOpenInterestData, POLL_INTERVAL_MS);

    return () => {
      clearInterval(marketInterval);
      clearInterval(oiInterval);
    };
  }, [fetchMarketData, fetchOpenInterestData]);

  const formatPrice = (value: string | number) => {
    const numericValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 3,
      maximumFractionDigits: 3
    }).format(numericValue);
  };

  const formatVolume = (value: string | number) => {
    const numericValue = typeof value === 'string' ? parseFloat(value) || 0 : value;

    if (numericValue >= 1000000) {
      return `${(numericValue / 1000000).toFixed(3)}M`;
    } else if (numericValue >= 1000) {
      return `${(numericValue / 1000).toFixed(3)}K`;
    }
    return numericValue.toFixed(3);
  };

  const coerceNumber = (value?: number | string | null) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  const formatPriceSafe = (value?: number | string | null) => formatPrice(coerceNumber(value));
  const formatFixed = (digits: number) => (value?: number | string | null) => coerceNumber(value).toFixed(digits);
  const blueTitleClass = 'text-blue-500';
  const blueValueClass = 'text-blue-600';

  const recentHistory = useMemo(() => {
    if (!marketData?.history) return [];
    return marketData.history.slice(-96);
  }, [marketData]);

  const lowHistoryEntries = useMemo(() => {
    return recentHistory.map(entry => ({
      timestamp: entry.timestamp,
      low: entry.low
    }));
  }, [recentHistory]);

  const lowestValue = useMemo(() => {
    if (!lowHistoryEntries.length) return null;
    return Math.min(...lowHistoryEntries.map(entry => coerceNumber(entry.low)));
  }, [lowHistoryEntries]);

  const lowSubtitle = useMemo(() => {
    const rows: { label: string; value: string }[] = [];
    if (lowestValue !== null) {
      rows.push({ label: 'Lowest', value: formatPrice(lowestValue) });
    }
    if (previousData?.low !== undefined && previousData?.low !== null) {
      rows.push({ label: 'Prev', value: formatPrice(coerceNumber(previousData.low)) });
    }
    if (!rows.length) return null;

    return (
      <div className="space-y-1">
        {rows.map(row => (
          <p key={row.label}>
            {row.label}: {row.value}
          </p>
        ))}
      </div>
    );
  }, [lowestValue, previousData]);

  const highSubtitle = useMemo(() => {
    if (previousData?.high === undefined || previousData?.high === null) return null;
    return (
      <div>
        Prev: {formatPrice(coerceNumber(previousData.high))}
      </div>
    );
  }, [previousData]);

  const ema6 = marketData?.indicators?.ema6 ?? null;
  const ema9 = marketData?.indicators?.ema9 ?? null;
  const ema20 = marketData?.indicators?.ema20 ?? null;
  const rsi14 = marketData?.indicators?.rsi14 ?? null;
  const rsi14Prev = marketData?.indicators?.rsi14Prev ?? null;
  const adx14 = marketData?.indicators?.adx14 ?? null;
  const rsiSubtitle = useMemo(() => {
    if (rsi14Prev === null || rsi14Prev === undefined) return null;
    return (
      <div>
        Prev: {formatFixed(2)(rsi14Prev)}
      </div>
    );
  }, [rsi14Prev]);

  const volumeMaValue = marketData?.volumeMa ?? marketData?.volume_ma ?? null;
  const volumeSubtitle = useMemo(() => {
    if (volumeMaValue === null || volumeMaValue === undefined) return null;
    return (
      <div>
        MA9: {formatVolume(volumeMaValue)}
      </div>
    );
  }, [volumeMaValue]);

  const lastLow = marketData?.low !== undefined && marketData?.low !== null ? coerceNumber(marketData.low) : null;
  const lowestTrackedLow = lowestValue;
  const lastRsi = rsi14 !== null && rsi14 !== undefined ? coerceNumber(rsi14) : null;
  const previousRsi = rsi14Prev !== null && rsi14Prev !== undefined ? coerceNumber(rsi14Prev) : null;
  const previousLow = previousData?.low !== undefined && previousData?.low !== null ? coerceNumber(previousData.low) : null;
  const lastEma6 = ema6 !== null && ema6 !== undefined ? coerceNumber(ema6) : null;
  const lastEma9 = ema9 !== null && ema9 !== undefined ? coerceNumber(ema9) : null;
  const livePrice = livePriceData?.lastPrice ?? null;
  const previousHigh = previousData?.high !== undefined && previousData?.high !== null ? coerceNumber(previousData.high) : null;
  const lastVolume = marketData?.volume !== undefined && marketData?.volume !== null ? coerceNumber(marketData.volume) : null;
  const volumeMa = volumeMaValue !== null && volumeMaValue !== undefined ? coerceNumber(volumeMaValue) : null;

  const ruleStatuses = useMemo(() => {
    return [
      {
        label: 'Last Candle Low ≤ 24h Lowest Price',
        isMet: lastLow !== null && lowestTrackedLow !== null && lastLow <= lowestTrackedLow
      },
      {
        label: 'Last RSI > Previous RSI',
        isMet: lastRsi !== null && previousRsi !== null && lastRsi > previousRsi
      },
      {
        label: 'Last Candle Low > Previous Candle Low',
        isMet: lastLow !== null && previousLow !== null && lastLow > previousLow
      },
      {
        label: 'Last EMA6 > Last EMA9',
        isMet: lastEma6 !== null && lastEma9 !== null && lastEma6 > lastEma9
      },
      {
        label: 'Live Price > Previous Candle High',
        isMet: livePrice !== null && previousHigh !== null && livePrice > previousHigh
      },
      {
        label: 'Last Volume > Volume MA',
        isMet: lastVolume !== null && volumeMa !== null && lastVolume > volumeMa
      }
    ];
  }, [lastLow, lowestTrackedLow, lastRsi, previousRsi, previousLow, lastEma6, lastEma9, livePrice, previousHigh, lastVolume, volumeMa]);

  const allRulesMet = ruleStatuses.every(rule => rule.isMet);

  useEffect(() => {
    const updates: Record<string, number> = {};

    ruleStatuses.forEach(rule => {
      const wasMet = previousRuleStatusesRef.current[rule.label] ?? false;
      if (rule.isMet && !wasMet) {
        updates[rule.label] = Date.now();
      }
    });

    if (Object.keys(updates).length) {
      setLastTrueTimestamps(prev => ({
        ...prev,
        ...updates
      }));
    }

    previousRuleStatusesRef.current = ruleStatuses.reduce((acc, rule) => {
      acc[rule.label] = rule.isMet;
      return acc;
    }, {} as Record<string, boolean>);
  }, [ruleStatuses]);

  useEffect(() => {
    if (allRulesMet && !previousAllRulesMetRef.current && livePrice !== null) {
      setBuySignal({ timestamp: Date.now(), price: livePrice });
    }

    if (!allRulesMet && previousAllRulesMetRef.current) {
      setBuySignal(null);
    }

    previousAllRulesMetRef.current = allRulesMet;
  }, [allRulesMet, livePrice]);

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="border border-red-400 px-4 py-3 rounded mb-4">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
          <button 
            onClick={fetchMarketData}
            className="mt-2 border border-red-500 font-bold py-2 px-4 rounded"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* LivePriceBanner */}
      <LivePriceBanner />
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-6">
          <button
            onClick={() => navigate('/')}
            className="mr-4 text-2xl leading-none focus:outline-none"
            aria-label="Back to dashboard"
          >
            ←
          </button>
          <h2 className="text-2xl font-bold">Lowest of 24 Strategy</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Price/volume cards */}
          <DataCard
            title="Low Price"
            value={marketData?.low || 0}
            previousValue={previousData?.low}
            loading={loading}
            formatValue={formatPrice}
            onClick={lowHistoryEntries.length ? () => setLowHistoryOpen(true) : undefined}
            subtitle={lowSubtitle ?? undefined}
            subtitleClassName="text-black font-semibold"
          />
          
          <DataCard
            title="Open Price"
            value={marketData?.open || 0}
            previousValue={previousData?.open}
            loading={loading}
            formatValue={formatPrice}
          />
          
          <DataCard
            title="High Price"
            value={marketData?.high || 0}
            previousValue={previousData?.high}
            loading={loading}
            formatValue={formatPrice}
            subtitle={highSubtitle ?? undefined}
            subtitleClassName="text-black font-semibold"
          />
          
          <DataCard
            title="Close Price"
            value={marketData?.close || 0}
            previousValue={previousData?.close}
            loading={loading}
            formatValue={formatPrice}
            titleClassName={blueTitleClass}
            valueClassName={blueValueClass}
            onClick={lowHistoryEntries.length ? () => setLowHistoryOpen(true) : undefined}
          />

          <DataCard
            title="Volume (15m)"
            value={marketData?.volume || 0}
            previousValue={previousData?.volume}
            loading={loading}
            formatValue={formatVolume}
            subtitle={volumeSubtitle ?? undefined}
            titleClassName={blueTitleClass}
            valueClassName={blueValueClass}
            subtitleClassName="text-black font-semibold"
          />

          {/* Indicator cards */}
          <DataCard
            title="RSI-14"
            value={rsi14 ?? 0}
            loading={loading}
            formatValue={(value) => formatFixed(2)(value)}
            subtitle={rsiSubtitle ?? '(Neutral)'}
            subtitleClassName={rsiSubtitle ? 'text-black font-semibold' : undefined}
          />

          <DataCard
            title="EMA-6"
            value={ema6 ?? 0}
            loading={loading}
            formatValue={formatPriceSafe}
          />

          <DataCard
            title="EMA-9"
            value={ema9 ?? 0}
            loading={loading}
            formatValue={formatPriceSafe}
          />
        </div>

        <div className="bg-white border rounded-lg p-6 shadow-sm space-y-4">
          <h3 className="text-xl font-bold">Rules to Buy</h3>
          <ul className="list-disc pl-5 space-y-2 text-sm font-semibold">
            {ruleStatuses.map(rule => (
              <li
                key={rule.label}
                className={rule.isMet ? 'text-green-600' : 'text-red-500'}
              >
                <span>{rule.label}</span>
                <span className="block text-xs font-normal text-gray-600">
                  {lastTrueTimestamps[rule.label]
                    ? `Last true: ${new Date(lastTrueTimestamps[rule.label]).toLocaleTimeString()}`
                    : 'Last true: Never'}
                </span>
              </li>
            ))}
          </ul>

          {allRulesMet && buySignal && (
            <div className="mt-4 rounded-lg border border-green-500 bg-green-50 text-green-900 p-4">
              <p className="text-lg font-bold">Buy Signal</p>
              <p className="text-sm mt-1">
                Triggered at {new Date(buySignal.timestamp).toLocaleTimeString()}
              </p>
              <p className="text-sm">
                Live Price: {formatPrice(buySignal.price)}
              </p>
            </div>
          )}
        </div>

        {/* Trading Collections Table */}
        <div className="mt-8">
          <TradingCollectionsTable />
        </div>

        {lowHistoryOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between border-b px-6 py-4">
                <h2 className="text-lg font-bold">Last 96 Low Prices</h2>
                <button
                  onClick={() => setLowHistoryOpen(false)}
                  className="text-sm font-medium border px-3 py-1 rounded"
                >
                  Close
                </button>
              </div>
              <div className="px-6 py-4 overflow-y-auto">
                {lowHistoryEntries.length ? (
                  <ul className="space-y-2 text-sm font-mono">
                    {[...lowHistoryEntries].reverse().map((entry, index) => {
                      const value = coerceNumber(entry.low);
                      const isLowest = lowestValue !== null && value === lowestValue;
                      return (
                        <li
                          key={`${entry.timestamp}-${index}`}
                          className={`flex justify-between ${isLowest ? 'text-red-600 font-semibold' : ''}`.trim()}
                        >
                          <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                          <span>{formatPrice(value)}</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p>No history available.</p>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default LowestOf24;
