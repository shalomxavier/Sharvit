import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService, MarketData, OpenInterestData } from '../services/apiService';
import DataCard from './DataCard';

interface IndicatorEntry {
  label: string;
  value: number | string | null;
  formatter: (value?: number | string | null) => string;
  secondaryValue?: number | string | null;
  secondaryFormatter?: (value?: number | string | null) => string;
  titleClassName?: string;
  valueClassName?: string;
}

const Dashboard: React.FC = () => {
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
  const [historyModalType, setHistoryModalType] = useState<'open' | 'high' | 'low' | 'close' | 'volume' | null>(null);

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
  const DEFAULT_MODAL_ENTRY_LIMIT = 150;
  const MODAL_ENTRY_LIMITS: Record<NonNullable<typeof historyModalType>, number> = {
    open: DEFAULT_MODAL_ENTRY_LIMIT,
    high: DEFAULT_MODAL_ENTRY_LIMIT,
    low: DEFAULT_MODAL_ENTRY_LIMIT,
    close: DEFAULT_MODAL_ENTRY_LIMIT,
    volume: 20
  };

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

  const formatDeltaOpenInterest = (value?: number | string | null) => {
    const numericValue = coerceNumber(value);
    if (numericValue === 0) {
      return '0.000';
    }

    const formattedMagnitude = formatVolume(Math.abs(numericValue));
    return `${numericValue > 0 ? '+' : '−'}${formattedMagnitude}`;
  };

  const formatNormalizedDelta = (value?: number | string | null) => {
    const numericValue = coerceNumber(value);
    const percentage = numericValue * 100;

    if (percentage === 0) {
      return '0.00%';
    }

    const sign = percentage > 0 ? '+' : '−';
    return `${sign}${Math.abs(percentage).toFixed(2)}%`;
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
  const formatMultiplier = (value?: number | string | null) => `${coerceNumber(value).toFixed(2)}x`;
  const formatTrend = (value?: string | number | null) => {
    const normalized = typeof value === 'string' ? value.toLowerCase() : String(value).toLowerCase();
    if (normalized === 'bullish') return 'Bullish';
    if (normalized === 'bearish') return 'Bearish';
    return 'Neutral';
  };
  const formatRsiState = (value?: string | number | null) => {
    const normalized = typeof value === 'string' ? value.toLowerCase() : String(value).toLowerCase();
    if (normalized === 'oversold') return 'Oversold';
    if (normalized === 'overbought') return 'Overbought';
    return 'Neutral';
  };
  const blueTitleClass = 'text-blue-500';
  const blueValueClass = 'text-blue-600';

  const recentHistory = useMemo(() => {
    if (!marketData?.history) return [];
    return marketData.history.slice(-150);
  }, [marketData]);

  const historyEntries = useMemo(() => {
    if (!recentHistory.length) return [];
    return [...recentHistory].reverse();
  }, [recentHistory]);

  const modalEntries = useMemo(() => {
    if (!historyModalType) return [];
    const entryLimit = MODAL_ENTRY_LIMITS[historyModalType] ?? DEFAULT_MODAL_ENTRY_LIMIT;
    return historyEntries
      .map(entry => ({
        timestamp: entry.timestamp,
        value:
          historyModalType === 'open'
            ? entry.open
            : historyModalType === 'high'
              ? entry.high
              : historyModalType === 'low'
                ? entry.low
                : historyModalType === 'close'
                  ? entry.close
                  : entry.volume
      }))
      .slice(0, entryLimit);
  }, [historyEntries, historyModalType, DEFAULT_MODAL_ENTRY_LIMIT]);

  const modalEntryLimit = historyModalType ? MODAL_ENTRY_LIMITS[historyModalType] ?? DEFAULT_MODAL_ENTRY_LIMIT : DEFAULT_MODAL_ENTRY_LIMIT;

  const modalStats = useMemo(() => {
    if (!modalEntries.length) return null;
    const sum = modalEntries.reduce((acc, entry) => acc + coerceNumber(entry.value), 0);
    const average = sum / modalEntries.length;
    return { sum, average };
  }, [modalEntries]);

  const modalMetricLabel = historyModalType === 'high'
    ? 'High Prices'
    : historyModalType === 'low'
      ? 'Low Prices'
      : historyModalType === 'close'
        ? 'Close Prices'
        : historyModalType === 'volume'
          ? 'Volumes'
          : 'Open Prices';

  const modalTitle = `Last ${modalEntryLimit} ${modalMetricLabel}`;

  const modalFormatter = historyModalType === 'volume' ? formatVolume : formatPrice;

  const ema20 = marketData?.indicators?.ema20 ?? null;
  const ema50 = marketData?.indicators?.ema50 ?? null;
  const rsi14 = marketData?.indicators?.rsi14 ?? null;
  const rsiState = marketData?.indicators?.rsiState ?? null;
  const atr14 = marketData?.indicators?.atr14 ?? null;
  const adx14 = marketData?.indicators?.adx14 ?? null;
  const indicatorEntries: IndicatorEntry[] = [
    { label: 'EMA-20', value: ema20, formatter: formatPriceSafe, titleClassName: blueTitleClass, valueClassName: blueValueClass },
    { label: 'EMA-50', value: ema50, formatter: formatPriceSafe, titleClassName: blueTitleClass, valueClassName: blueValueClass },
    {
      label: 'RSI-14',
      value: rsi14,
      formatter: formatFixed(2),
      secondaryValue: rsiState,
      secondaryFormatter: formatRsiState,
      titleClassName: blueTitleClass,
      valueClassName: blueValueClass
    },
    { label: 'ATR-14', value: atr14, formatter: formatFixed(3), titleClassName: blueTitleClass, valueClassName: blueValueClass },
    { label: 'ADX-14', value: adx14, formatter: formatFixed(2), titleClassName: blueTitleClass, valueClassName: blueValueClass }
  ];

  const openInterestIndicators = openInterestData?.indicators;
  const openInterestMaValue = openInterestData?.openInterestMa ?? null;
  const oiRatioValue = openInterestData?.oiRatio ?? null;

  const volumeMaValue = marketData?.volumeMa ?? marketData?.volume_ma ?? null;
  const volumeRatioValue = marketData?.volumeRatio ?? marketData?.volume_ratio ?? null;
  const volumeSubtitle = volumeMaValue !== null
    ? `MA9: ${formatVolume(volumeMaValue)}${volumeRatioValue !== null && volumeRatioValue !== undefined ? ` · ${coerceNumber(volumeRatioValue).toFixed(2)}×` : ''}`
    : undefined;

  if (openInterestIndicators?.deltaOpenInterest !== null && openInterestIndicators?.deltaOpenInterest !== undefined) {
    indicatorEntries.push({
      label: 'Δ Open Interest',
      value: openInterestIndicators.deltaOpenInterest,
      formatter: formatDeltaOpenInterest,
      secondaryValue: openInterestIndicators.normalizedDeltaOpenInterest,
      secondaryFormatter: formatNormalizedDelta
    });
  }

  if (openInterestIndicators?.deltaOpenInterest3 !== null && openInterestIndicators?.deltaOpenInterest3 !== undefined) {
    indicatorEntries.push({
      label: 'Δ Open Interest (3)',
      value: openInterestIndicators.deltaOpenInterest3,
      formatter: formatDeltaOpenInterest,
      secondaryValue: openInterestIndicators.normalizedDeltaOpenInterest3,
      secondaryFormatter: formatNormalizedDelta
    });
  }

  // Removed log Δ Open Interest indicators per request

  if (oiRatioValue !== null && oiRatioValue !== undefined) {
    indicatorEntries.push({
      label: 'OI Ratio',
      value: oiRatioValue,
      formatter: formatMultiplier
    });
  }

  const openInterestValue = openInterestData?.openInterest ?? null;
  const openInterestUsd = openInterestData?.openInterestUsd ?? (
    openInterestValue !== null && openInterestData?.markPrice
      ? openInterestValue * openInterestData.markPrice
      : null
  );
  const openInterestSubtitleParts: string[] = [];
  if (openInterestUsd !== null) {
    openInterestSubtitleParts.push(`≈ ${formatPrice(openInterestUsd)}`);
  }
  if (openInterestMaValue !== null && openInterestMaValue !== undefined) {
    openInterestSubtitleParts.push(`MA (20): ${formatVolume(openInterestMaValue)}`);
  }
  if (oiRatioValue !== null && oiRatioValue !== undefined) {
    openInterestSubtitleParts.push(`Ratio: ${formatMultiplier(oiRatioValue)}`);
  }
  const openInterestSubtitle = openInterestSubtitleParts.length
    ? openInterestSubtitleParts.join(' • ')
    : openInterestError
      ? 'Open interest unavailable'
      : undefined;
  const openInterestFormatValue = openInterestValue !== null ? formatVolume : undefined;

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
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold mb-6">Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <DataCard
          title="Open Price"
          value={marketData?.open || 0}
          previousValue={previousData?.open}
          loading={loading}
          formatValue={formatPrice}
          onClick={marketData ? () => setHistoryModalType('open') : undefined}
        />
        
        <DataCard
          title="High Price"
          value={marketData?.high || 0}
          previousValue={previousData?.high}
          loading={loading}
          formatValue={formatPrice}
          onClick={marketData ? () => setHistoryModalType('high') : undefined}
        />
        
        <DataCard
          title="Low Price"
          value={marketData?.low || 0}
          previousValue={previousData?.low}
          loading={loading}
          formatValue={formatPrice}
          onClick={marketData ? () => setHistoryModalType('low') : undefined}
        />
        
        <DataCard
          title="Close Price"
          value={marketData?.close || 0}
          previousValue={previousData?.close}
          loading={loading}
          formatValue={formatPrice}
          onClick={marketData ? () => setHistoryModalType('close') : undefined}
          titleClassName={blueTitleClass}
          valueClassName={blueValueClass}
        />
        
        <DataCard
          title="Volume (15m)"
          value={marketData?.volume || 0}
          previousValue={previousData?.volume}
          loading={loading}
          formatValue={formatVolume}
          subtitle={volumeSubtitle}
          onClick={marketData ? () => setHistoryModalType('volume') : undefined}
          titleClassName={blueTitleClass}
          valueClassName={blueValueClass}
        />

        <DataCard
          title="Futures Open Interest"
          value={openInterestValue ?? 'N/A'}
          previousValue={previousOpenInterestData?.openInterest}
          loading={openInterestLoading}
          formatValue={openInterestFormatValue}
          subtitle={openInterestSubtitle}
          titleClassName={blueTitleClass}
          valueClassName={blueValueClass}
        />

        <DataCard
          title="Account Equity"
          value={marketData?.accountEquity || 'N/A'}
          previousValue={previousData?.accountEquity}
          loading={loading}
          showTrend={false}
        />

        <DataCard
          title="Trend State"
          value={marketData?.trend ?? 'neutral'}
          loading={loading}
          formatValue={(value) => formatTrend(value)}
          showTrend={false}
        />
      </div>

      {indicatorEntries.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xl font-bold mb-3">Technical Indicators</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {indicatorEntries.map(entry => (
              <div key={entry.label} className="rounded-lg border px-6 py-4 flex items-center justify-between">
                <div>
                  <p className={`text-xl font-bold ${entry.titleClassName ?? ''}`.trim()}>{entry.label}</p>
                </div>
                <div className="text-right">
                  <span className={`text-2xl font-bold ${entry.valueClassName ?? ''}`.trim()}>
                    {entry.value !== null && entry.value !== undefined
                      ? entry.formatter(entry.value)
                      : 'N/A'}
                  </span>
                  {entry.value !== null && entry.value !== undefined && entry.secondaryValue !== null && entry.secondaryValue !== undefined && entry.secondaryFormatter && (
                    <p className="text-sm text-gray-500 mt-1">
                      ({entry.secondaryFormatter(entry.secondaryValue)})
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8">
        <h3 className="text-xl font-bold mb-3">Strategies</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div 
            className="rounded-lg border px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => navigate('/lowest-of-24')}
          >
            <div>
              <p className="text-xl font-bold">Lowest of 24</p>
            </div>
            <div className="text-right">
              <span className="text-sm text-gray-500">Click to open →</span>
            </div>
          </div>
        </div>
      </div>

      {historyModalType && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-bold">{modalTitle}</h2>
              <button
                onClick={() => setHistoryModalType(null)}
                className="text-sm font-medium border px-3 py-1 rounded"
              >
                Close
              </button>
            </div>
            <div className="px-6 py-4 overflow-y-auto">
              {modalEntries.length ? (
                <>
                  <ul className="space-y-2 text-sm font-mono">
                    {modalEntries.map((entry, index) => (
                      <li key={`${entry.timestamp}-${index}`} className="flex justify-between">
                        <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                        <span>{modalFormatter(entry.value)}</span>
                      </li>
                    ))}
                  </ul>
                  {modalStats && (
                    <div className="mt-6 border-t pt-4 text-sm">
                      <p className="font-semibold mb-2">Summary</p>
                      <div className="flex justify-between">
                        <span>Total</span>
                        <span>{modalFormatter(modalStats.sum)}</span>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span>Average</span>
                        <span>{modalFormatter(modalStats.average)}</span>
                      </div>
                    </div>
                  )}
                </>
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

export default Dashboard;
