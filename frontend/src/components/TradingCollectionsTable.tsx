import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

interface RuleState {
  isMet: boolean;
  metAt?: Timestamp;
  metPrice?: number;
}

interface TradingCollection {
  id: string;
  status: 'active' | 'completed';
  triggerTime: Timestamp;
  triggerPrice: number;
  rules: {
    [ruleKey: string]: RuleState;
  };
  buySignal?: {
    time: Timestamp;
    price: number;
  };
  sellSignal?: {
    time: Timestamp;
    price: number;
    status: 'profit' | 'loss';
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}


const TradingCollectionsTable: React.FC = () => {
  const [collections, setCollections] = useState<TradingCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'trading_collections'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const collectionsData: TradingCollection[] = [];
        querySnapshot.forEach((doc) => {
          collectionsData.push({ id: doc.id, ...doc.data() } as TradingCollection);
        });
        setCollections(collectionsData);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching trading collections:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const formatTimestamp = (timestamp: Timestamp) => {
    return timestamp.toDate().toLocaleString();
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 3,
      maximumFractionDigits: 3
    }).format(price);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSellStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'profit':
        return 'bg-green-100 text-green-800';
      case 'loss':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRulesMet = (rules: { [ruleKey: string]: RuleState }) => {
    const ruleKeys = Object.keys(rules);
    const metCount = ruleKeys.filter(key => rules[key].isMet).length;
    return `${metCount}/${ruleKeys.length}`;
  };

  if (loading) {
    return (
      <div className="bg-white border rounded-lg p-6 shadow-sm">
        <h3 className="text-xl font-bold mb-4">Trading Collections</h3>
        <div className="flex items-center justify-center py-8">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border rounded-lg p-6 shadow-sm">
        <h3 className="text-xl font-bold mb-4">Trading Collections</h3>
        <div className="border border-red-400 px-4 py-3 rounded">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-lg p-6 shadow-sm">
      <h3 className="text-xl font-bold mb-4">Trading Collections</h3>
      
      {collections.length === 0 ? (
        <div className="text-gray-500 text-center py-8">
          No trading collections found
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3 font-semibold text-sm">ID</th>
                <th className="text-left py-2 px-3 font-semibold text-sm">Status</th>
                <th className="text-left py-2 px-3 font-semibold text-sm">Trigger Time</th>
                <th className="text-left py-2 px-3 font-semibold text-sm">Trigger Price</th>
                <th className="text-left py-2 px-3 font-semibold text-sm">Rules Met</th>
                <th className="text-left py-2 px-3 font-semibold text-sm">Buy Signal</th>
                <th className="text-left py-2 px-3 font-semibold text-sm">Sell Signal</th>
                <th className="text-left py-2 px-3 font-semibold text-sm">Updated</th>
              </tr>
            </thead>
            <tbody>
              {collections.map((collection) => (
                <tr key={collection.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-3 text-sm font-mono">
                    {collection.id.replace('collection_', '').slice(-8)}
                  </td>
                  <td className="py-2 px-3">
                    <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeClass(collection.status)}`}>
                      {collection.status}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-sm">
                    {formatTimestamp(collection.triggerTime)}
                  </td>
                  <td className="py-2 px-3 text-sm font-mono">
                    {formatPrice(collection.triggerPrice)}
                  </td>
                  <td className="py-2 px-3 text-sm font-semibold">
                    {getRulesMet(collection.rules)}
                  </td>
                  <td className="py-2 px-3 text-sm">
                    {collection.buySignal ? (
                      <div>
                        <div className="font-mono">{formatPrice(collection.buySignal.price)}</div>
                        <div className="text-xs text-gray-500">
                          {formatTimestamp(collection.buySignal.time)}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-sm">
                    {collection.sellSignal ? (
                      <div>
                        <div className="font-mono">{formatPrice(collection.sellSignal.price)}</div>
                        <div className="text-xs">
                          <span className={`inline-block px-1 py-0.5 text-xs font-semibold rounded ${getSellStatusBadgeClass(collection.sellSignal.status)}`}>
                            {collection.sellSignal.status}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatTimestamp(collection.sellSignal.time)}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-sm text-gray-500">
                    {formatTimestamp(collection.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TradingCollectionsTable;
