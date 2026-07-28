import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService, MarketData } from '../services/apiService';
import DataCard from './DataCard';
import LivePriceBanner from './LivePriceBanner';
import PureLowestOf24Table from './PureLowestOf24Table';

interface PureLowestOf24Props {
  collectionName?: string;
  title?: string;
}

const PureLowestOf24: React.FC<PureLowestOf24Props> = ({
  collectionName = 'pure_lowest_of_24_collections',
  title = 'Pure Lowest of 24'
}) => {
  const navigate = useNavigate();
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [previousData, setPreviousData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lowHistoryOpen, setLowHistoryOpen] = useState(false);
  const latestDataRef = useRef<MarketData | null>(null);
  const [lastTrueTimestamp, setLastTrueTimestamp] = useState<number | null>(null);
  const previousRuleMetRef = useRef(false);

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

  const POLL_INTERVAL_MS = 30000;

  useEffect(() => {
    fetchMarketData();
    const marketInterval = setInterval(fetchMarketData, POLL_INTERVAL_MS);
    return () => clearInterval(marketInterval);
  }, [fetchMarketData]);

  const formatPrice = (value: string | number) => {
    const numericValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 3,
      maximumFractionDigits: 3
    }).format(numericValue);
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

  const lastLow = marketData?.low !== undefined && marketData?.low !== null ? coerceNumber(marketData.low) : null;
  const lowestTrackedLow = lowestValue;

  const ruleMet = useMemo(() => {
    return lastLow !== null && lowestTrackedLow !== null && lastLow <= lowestTrackedLow;
  }, [lastLow, lowestTrackedLow]);

  useEffect(() => {
    if (ruleMet && !previousRuleMetRef.current) {
      setLastTrueTimestamp(Date.now());
    }
    previousRuleMetRef.current = ruleMet;
  }, [ruleMet]);

  if (error) {
    return (
      <div className="min-h-screen">
        <LivePriceBanner />
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
      </div>
    );
  }

  return (
    <div className="min-h-screen">
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
          <h2 className="text-2xl font-bold">{title}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
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
        </div>

        <div className="bg-white border rounded-lg p-6 shadow-sm space-y-4">
          <h3 className="text-xl font-bold">Rules to Buy</h3>
          <ul className="list-disc pl-5 space-y-2 text-sm font-semibold">
            <li className={ruleMet ? 'text-green-600' : 'text-red-500'}>
              <span>Last Candle Low ≤ 24h Lowest Price</span>
              <span className="block text-xs font-normal text-gray-600">
                {lastTrueTimestamp
                  ? `Last true: ${new Date(lastTrueTimestamp).toLocaleTimeString()}`
                  : 'Last true: Never'}
              </span>
            </li>
          </ul>
        </div>

        <div className="mt-8">
          <PureLowestOf24Table collectionName={collectionName} title={`${title} Collections`} />
        </div>
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
  );
};

export default PureLowestOf24;
