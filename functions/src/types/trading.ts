import { Timestamp } from 'firebase-admin/firestore';

export interface RuleState {
  isMet: boolean;
  metAt?: Timestamp;
  metPrice?: number;
}

export interface TradingCollection {
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

export interface MarketConditions {
  lastLow: number;
  lowestOf24h: number;
  lastRsi: number | null;
  previousRsi: number | null;
  previousLow: number;
  lastEma6: number | null;
  lastEma9: number | null;
  livePrice: number;
  previousHigh: number;
  lastVolume: number;
  volumeMa: number;
  timestamp: number;
}

export interface RuleEvaluationResult {
  ruleKey: string;
  label: string;
  isMet: boolean;
  currentValue?: number | null;
  comparisonValue?: number | null;
}

export interface TradingRules {
  trigger: RuleEvaluationResult;
  rules: RuleEvaluationResult[];
}

export const RULE_KEYS = {
  TRIGGER: 'lastLowLessEqualLowest24h',
  RSI_MOMENTUM: 'lastRsiGreaterPreviousRsi',
  PRICE_RECOVERY: 'lastLowGreaterPreviousLow',
  EMA_CROSSOVER: 'lastEma6GreaterEma9',
  BREAKOUT: 'livePriceGreaterPreviousHigh',
  VOLUME_CONFIRMATION: 'lastVolumeGreaterVolumeMa'
} as const;

export const RULE_LABELS = {
  [RULE_KEYS.TRIGGER]: 'Last Candle Low ≤ 24h Lowest Price',
  [RULE_KEYS.RSI_MOMENTUM]: 'Last RSI > Previous RSI',
  [RULE_KEYS.PRICE_RECOVERY]: 'Last Candle Low > Previous Candle Low',
  [RULE_KEYS.EMA_CROSSOVER]: 'Last EMA6 > Last EMA9',
  [RULE_KEYS.BREAKOUT]: 'Live Price > Previous Candle High',
  [RULE_KEYS.VOLUME_CONFIRMATION]: 'Last Volume > Volume MA'
} as const;

export const PROFIT_THRESHOLD = 1.009; // 100.9%
export const LOSS_THRESHOLD = 0.982; // 98.2%
