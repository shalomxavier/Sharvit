import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService, MarketData } from '../services/apiService';
import DataCard from './DataCard';
import LivePriceBanner from './LivePriceBanner';
import TradingCollectionsTable3and6 from './TradingCollectionsTable3and6';

const LowestOf24_3and6: React.FC = () => {
  const navigate = useNavigate();
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [previousData, setPreviousData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lowHistoryOpen, setLowHistoryOpen] = useState(false);

  const fetchMarketData = useCallback(async () => {
    try {
      setError(null);
      const data = await apiService.getMarketData();
      setPreviousData(marketData);
      setMarketData(data);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch market data');
      setLoading(false);
    }
  }, [marketData]);

  useEffect(() => {
    fetchMarketData();
    const interval = setInterval(fetchMarketData, 30000);
    return () => clearInterval(interval);
  }, [fetchMarketData]);

  const formatPrice = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return 'N/A';
    const numericValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 3,
      maximumFractionDigits: 3
    }).format(numericValue);
  };

  const formatVolume = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return 'N/A';
    const numericValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
    if (numericValue >= 1000000) {
      return `${(numericValue / 1000000).toFixed(3)}M`;
    } else if (numericValue >= 1000) {
      return `${(numericValue / 1000).toFixed(3)}K`;
    }
    return numericValue.toFixed(3);
  };

  const formatFixed = (digits: number) => (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return 'N/A';
    const numericValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
    return numericValue.toFixed(digits);
  };

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
    return Math.min(...lowHistoryEntries.map(entry => {
      const val = typeof entry.low === 'string' ? parseFloat(entry.low) : entry.low;
      return Number.isFinite(val) ? val : 0;
    }));
  }, [lowHistoryEntries]);

  const lowSubtitle = useMemo(() => {
    const rows: { label: string; value: string }[] = [];
    if (lowestValue !== null) {
      rows.push({ label: 'Lowest', value: formatPrice(lowestValue) });
    }
    if (previousData?.low !== undefined && previousData?.low !== null) {
      const val = typeof previousData.low === 'string' ? parseFloat(previousData.low) : previousData.low;
      rows.push({ label: 'Prev', value: formatPrice(Number.isFinite(val) ? val : 0) });
    }
    if (!rows.length) return null;
    return (
      <div className="space-y-1">
        {rows.map(row => (
          <p key={row.label}>{row.label}: {row.value}</p>
        ))}
      </div>
    );
  }, [lowestValue, previousData]);

  const highSubtitle = useMemo(() => {
    if (previousData?.high === undefined || previousData?.high === null) return null;
    const val = typeof previousData.high === 'string' ? parseFloat(previousData.high) : previousData.high;
    return <div>Prev: {formatPrice(Number.isFinite(val) ? val : 0)}</div>;
  }, [previousData]);

  const rsi14 = marketData?.indicators?.rsi14 ?? null;
  const rsi14Prev = marketData?.indicators?.rsi14Prev ?? null;
  const ema6 = marketData?.indicators?.ema6 ?? null;
  const ema3 = marketData?.indicators?.ema3 ?? null;
  const volumeMaValue = marketData?.volumeMa ?? marketData?.volume_ma ?? null;

  // Track EMA3 > EMA6 rule
  const [ema3GreaterEma6LastTrue, setEma3GreaterEma6LastTrue] = useState<number | null>(null);
  const prevEma3GreaterEma6 = useRef<boolean>(false);

  const ema3GreaterEma6 = ema3 !== null && ema6 !== null && ema3 > ema6;

  useEffect(() => {
    if (ema3GreaterEma6 && !prevEma3GreaterEma6.current) {
      setEma3GreaterEma6LastTrue(Date.now());
    }
    prevEma3GreaterEma6.current = ema3GreaterEma6;
  }, [ema3GreaterEma6]);

  const rsiSubtitle = useMemo(() => {
    if (rsi14Prev === null || rsi14Prev === undefined) return null;
    return <div>Prev: {formatFixed(2)(rsi14Prev)}</div>;
  }, [rsi14Prev]);

  const volumeSubtitle = useMemo(() => {
    if (volumeMaValue === null || volumeMaValue === undefined) return null;
    return <div>MA9: {formatVolume(volumeMaValue)}</div>;
  }, [volumeMaValue]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <LivePriceBanner />
        <div className="container mx-auto px-4 py-8">
          <div className="border border-red-400 px-4 py-3 rounded">
            <strong className="font-bold">Error: </strong>
            <span>{error}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <LivePriceBanner />
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center mb-6">
          <button
            onClick={() => navigate('/')}
            className="mr-4 text-2xl leading-none focus:outline-none"
            aria-label="Back to dashboard"
          >
            ←
          </button>
          <h2 className="text-2xl font-bold">Lowest of 24 3&amp;6 Strategy</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
            titleClassName="text-blue-500"
            valueClassName="text-blue-600"
            onClick={lowHistoryEntries.length ? () => setLowHistoryOpen(true) : undefined}
          />
          <DataCard
            title="Volume (15m)"
            value={marketData?.volume || 0}
            previousValue={previousData?.volume}
            loading={loading}
            formatValue={formatVolume}
            subtitle={volumeSubtitle ?? undefined}
            titleClassName="text-blue-500"
            valueClassName="text-blue-600"
            subtitleClassName="text-black font-semibold"
          />
          <DataCard
            title="RSI-14"
            value={rsi14 ?? 0}
            loading={loading}
            formatValue={formatFixed(2)}
            subtitle={rsiSubtitle ?? undefined}
            titleClassName="text-blue-500"
            valueClassName="text-blue-600"
            subtitleClassName="text-black font-semibold"
          />
          <DataCard
            title="EMA-6"
            value={ema6 ?? 0}
            loading={loading}
            formatValue={formatPrice}
            titleClassName="text-blue-500"
            valueClassName="text-blue-600"
          />
          <DataCard
            title="EMA-3"
            value={ema3 ?? 0}
            loading={loading}
            formatValue={formatPrice}
            titleClassName="text-blue-500"
            valueClassName="text-blue-600"
          />
        </div>

        <div className="mt-8 bg-white border rounded-lg p-6 shadow-sm space-y-4">
          <h3 className="text-xl font-bold">Rules to Buy</h3>
          <ul className="list-disc pl-5 space-y-2 text-sm font-semibold">
            <li className="text-red-500">
              <span>Last Candle Low ≤ 24h Lowest Price</span>
              <span className="block text-xs font-normal text-gray-600">Last true: Never</span>
            </li>
            <li className="text-red-500">
              <span>Last RSI &gt; Previous RSI</span>
              <span className="block text-xs font-normal text-gray-600">Last true: Never</span>
            </li>
            <li className="text-red-500">
              <span>Last Candle Low &gt; Previous Candle Low</span>
              <span className="block text-xs font-normal text-gray-600">Last true: Never</span>
            </li>
            <li className={ema3GreaterEma6 ? 'text-green-600' : 'text-red-500'}>
              <span>Last EMA3 &gt; Last EMA6</span>
              <span className="block text-xs font-normal text-gray-600">
                {ema3GreaterEma6LastTrue
                  ? `Last true: ${new Date(ema3GreaterEma6LastTrue).toLocaleTimeString()}`
                  : 'Last true: Never'}
              </span>
            </li>
            <li className="text-red-500">
              <span>Live Price &gt; Previous Candle High</span>
              <span className="block text-xs font-normal text-gray-600">Last true: Never</span>
            </li>
            <li className="text-red-500">
              <span>Last Volume &gt; Volume MA</span>
              <span className="block text-xs font-normal text-gray-600">Last true: Never</span>
            </li>
          </ul>
        </div>

        <div className="mt-8">
          <TradingCollectionsTable3and6 />
        </div>

        {lowHistoryOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
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
                      const val = typeof entry.low === 'string' ? parseFloat(entry.low) : entry.low;
                      const value = Number.isFinite(val) ? val : 0;
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

export default LowestOf24_3and6;
