import React, { useMemo } from 'react';
import { Timestamp } from 'firebase/firestore';

interface RuleState {
  isMet: boolean;
  metAt?: Timestamp;
  metPrice?: number;
}

interface BuySignal {
  time: Timestamp;
  price: number;
}

interface SellSignal {
  time: Timestamp;
  price: number;
  status: 'profit' | 'loss';
}

interface TradingCollection {
  id: string;
  status: 'active' | 'completed';
  triggerTime: Timestamp;
  triggerPrice: number;
  rules?: {
    [ruleKey: string]: RuleState;
  };
  rule?: RuleState;
  buySignal?: BuySignal;
  sellSignal?: SellSignal;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface ProfitLossSummaryProps {
  collections: TradingCollection[];
}

const ProfitLossSummary: React.FC<ProfitLossSummaryProps> = ({ collections }) => {
  const { totalProfitLoss, profitCount, lossCount, totalTrades } = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let totalProfitLoss = 0;
    let profitCount = 0;
    let lossCount = 0;
    let totalTrades = 0;

    collections.forEach((collection) => {
      if (
        collection.buySignal &&
        collection.sellSignal &&
        collection.sellSignal.time.toDate() >= thirtyDaysAgo
      ) {
        const buyPrice = collection.buySignal.price;
        const sellPrice = collection.sellSignal.price;
        const profitLoss = ((sellPrice - buyPrice) / buyPrice) * 100;

        totalProfitLoss += profitLoss;
        totalTrades++;

        if (profitLoss > 0) {
          profitCount++;
        } else {
          lossCount++;
        }
      }
    });

    return { totalProfitLoss, profitCount, lossCount, totalTrades };
  }, [collections]);

  const formatPercentage = (value: number) => {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  const getColorClass = (value: number) => {
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  if (totalTrades === 0) {
    return (
      <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
        <p className="text-sm text-gray-600">
          <span className="font-semibold">Last 30 Days:</span> No completed trades
        </p>
      </div>
    );
  }

  return (
    <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="font-semibold">Last 30 Days:</span>
        <span className={getColorClass(totalProfitLoss)}>
          Total P/L: <span className="font-bold">{formatPercentage(totalProfitLoss)}</span>
        </span>
        <span className="text-gray-600">
          Trades: <span className="font-semibold">{totalTrades}</span>
        </span>
        <span className="text-green-600">
          Wins: <span className="font-semibold">{profitCount}</span>
        </span>
        <span className="text-red-600">
          Losses: <span className="font-semibold">{lossCount}</span>
        </span>
        <span className="text-gray-600">
          Win Rate: <span className="font-semibold">{((profitCount / totalTrades) * 100).toFixed(1)}%</span>
        </span>
      </div>
    </div>
  );
};

export default ProfitLossSummary;
