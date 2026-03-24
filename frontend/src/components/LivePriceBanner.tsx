import React from 'react';
import { useLivePrice } from '../hooks/useLivePrice';

const LivePriceBanner: React.FC = () => {
  const { data, loading, error } = useLivePrice(5000);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price);
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).toUpperCase();
  };

  if (loading) {
    return (
      <div className="p-4 mb-6">
        <div className="container mx-auto flex items-center justify-center">
          <div className="animate-pulse flex items-center space-x-4">
            <div className="h-4 rounded w-24 border"></div>
            <div className="h-6 rounded w-32 border"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 mb-6">
        <div className="container mx-auto flex items-center justify-center">
          <span className="text-sm">⚠️ Failed to load live price: {error}</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-4 mb-6">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div>
            <span className="text-sm font-semibold text-blue-500">Live Price (BTC/USDT)</span>
            <div className="text-2xl font-bold text-blue-600">{formatPrice(data.lastPrice)}</div>
          </div>
        </div>
        <span className="text-sm text-blue-400">{formatTimestamp(data.timestamp)}</span>
      </div>
    </div>
  );
};

export default LivePriceBanner;
