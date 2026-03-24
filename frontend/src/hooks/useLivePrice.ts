import { useState, useEffect, useCallback } from 'react';
import { apiService, LivePriceData } from '../services/apiService';

interface UseLivePriceReturn {
  data: LivePriceData | null;
  loading: boolean;
  error: string | null;
}

export const useLivePrice = (intervalMs: number = 5000): UseLivePriceReturn => {
  const [data, setData] = useState<LivePriceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLivePrice = useCallback(async () => {
    try {
      setError(null);
      const result = await apiService.getLivePrice();
      setData(result);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch live price');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLivePrice();
    
    const interval = setInterval(fetchLivePrice, intervalMs);
    
    return () => clearInterval(interval);
  }, [fetchLivePrice, intervalMs]);

  return { data, loading, error };
};
