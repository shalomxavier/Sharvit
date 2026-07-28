import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import type { CollectionReference } from 'firebase-admin/firestore';
import { binanceService } from './binanceService';
import {
  TradingCollection,
  MarketConditions,
  RuleEvaluationResult,
  TradingRules,
  RULE_KEYS,
  RULE_LABELS,
  PROFIT_THRESHOLD,
  LOSS_THRESHOLD,
  LOSS_THRESHOLD_09,
  RuleState
} from '../types/trading';
import {
  getIntervalDurationMs,
  computeEma,
  computeRsiRma,
  parsePositiveInt,
  REQUIRED_RSI_SOURCE,
  VOLUME_MA_PERIOD
} from '../utils/calculations';

if (!getApps().length) {
  initializeApp();
}

class TradingService {
  private db = getFirestore();
  private collectionsRef = this.db.collection('trading_collections');
  private pureCollectionsRef = this.db.collection('pure_lowest_of_24_collections');
  private pure09CollectionsRef = this.db.collection('pure_lowest_of_24_09_collections');
  private collections3and6Ref = this.db.collection('trading_collections_3and6');

  async processTrading(providedMarketConditions?: MarketConditions): Promise<void> {
    try {
      console.log('Starting trading process...');
      
      // Get market conditions
      const marketConditions = providedMarketConditions ?? await this.getMarketConditions();
      if (!marketConditions) {
        console.log('Market data unavailable, pausing trading evaluations');
        return;
      }

      console.log('Market conditions:', marketConditions);

      // Evaluate trading rules
      const tradingRules = this.evaluateRules(marketConditions);
      console.log('Rule evaluation:', tradingRules);

      // Check for new collection trigger
      if (tradingRules.trigger.isMet) {
        await this.handleTriggerCondition(marketConditions, tradingRules);
      }

      // Process active collections
      await this.processActiveCollections(marketConditions, tradingRules);

    } catch (error) {
      console.error('Error in trading process:', error);
      throw error;
    }
  }

  async processPureLowestOf24(providedMarketConditions?: MarketConditions): Promise<void> {
    await this.processPureLowestOf24WithLoss(
      providedMarketConditions,
      this.pureCollectionsRef,
      LOSS_THRESHOLD,
      'pure lowest of 24',
      'pure'
    );
  }

  async processPureLowestOf24_09(providedMarketConditions?: MarketConditions): Promise<void> {
    await this.processPureLowestOf24WithLoss(
      providedMarketConditions,
      this.pure09CollectionsRef,
      LOSS_THRESHOLD_09,
      'pure lowest of 24 0.9% loss',
      'pure 0.9%'
    );
  }

  private async processPureLowestOf24WithLoss(
    providedMarketConditions: MarketConditions | undefined,
    collectionsRef: CollectionReference,
    lossThreshold: number,
    processLabel: string,
    collectionLabel: string
  ): Promise<void> {
    try {
      console.log(`Starting ${processLabel} trading process...`);
      
      // Get market conditions
      const marketConditions = providedMarketConditions ?? await this.getMarketConditions();
      if (!marketConditions) {
        console.log(`Market data unavailable, pausing ${processLabel} evaluations`);
        return;
      }

      console.log(`Market conditions for ${processLabel} strategy:`, marketConditions);

      // Evaluate only the trigger rule for pure strategy
      const triggerRule = {
        ruleKey: RULE_KEYS.TRIGGER,
        label: RULE_LABELS[RULE_KEYS.TRIGGER],
        isMet: marketConditions.lastLow <= marketConditions.lowestOf24h,
        currentValue: marketConditions.lastLow,
        comparisonValue: marketConditions.lowestOf24h
      };
      console.log(`${processLabel} strategy trigger rule:`, triggerRule);

      // Check for new collection trigger
      if (triggerRule.isMet) {
        await this.handlePureTriggerCondition(marketConditions, triggerRule, collectionsRef, collectionLabel);
      }

      // Process active collections for pure strategy
      await this.processPureActiveCollections(marketConditions, triggerRule, collectionsRef, lossThreshold, collectionLabel);

    } catch (error) {
      console.error(`Error in ${processLabel} trading process:`, error);
      throw error;
    }
  }

  async processLowestOf24_3and6(providedMarketConditions?: MarketConditions): Promise<void> {
    try {
      console.log('Starting lowest of 24 3&6 trading process...');
      
      // Get market conditions
      const marketConditions = providedMarketConditions ?? await this.getMarketConditions();
      if (!marketConditions) {
        console.log('Market data unavailable, pausing lowest of 24 3&6 evaluations');
        return;
      }

      console.log('Market conditions for 3&6 strategy:', marketConditions);

      // Evaluate trading rules with EMA3 > EMA6 instead of EMA6 > EMA9
      const tradingRules = this.evaluateRules3and6(marketConditions);
      console.log('3&6 strategy rule evaluation:', tradingRules);

      // Check for new collection trigger
      if (tradingRules.trigger.isMet) {
        await this.handleTriggerCondition3and6(marketConditions, tradingRules);
      }

      // Process active collections for 3&6 strategy
      await this.processActiveCollections3and6(marketConditions, tradingRules);

    } catch (error) {
      console.error('Error in lowest of 24 3&6 trading process:', error);
      throw error;
    }
  }

  async getMarketConditions(): Promise<MarketConditions | null> {
    try {
      const interval = process.env.INTERVAL || '15m';
      const intervalMs = getIntervalDurationMs(interval);
      const requiredHistory = Math.max(
        parsePositiveInt(process.env.MAX_HISTORY, REQUIRED_RSI_SOURCE),
        REQUIRED_RSI_SOURCE
      );
      const fetchLimit = Math.max(requiredHistory + 1, 100);

      // Fetch fresh data directly from Binance
      const klineData = await binanceService.getKlines(fetchLimit);
      
      const now = Date.now();
      const currentBucketStart = Math.floor(now / intervalMs) * intervalMs;
      const lastKline = klineData[klineData.length - 1];
      const lastCloseTime = lastKline?.closeTime;
      const lastIsClosed = typeof lastCloseTime === 'number' && lastCloseTime <= currentBucketStart;
      const closedCandles = lastIsClosed ? klineData : klineData.slice(0, -1);

      if (!closedCandles.length || closedCandles.length < REQUIRED_RSI_SOURCE) {
        return null;
      }

      const latestClosedCandle = closedCandles[closedCandles.length - 1];
      const closes = closedCandles.map(candle => parseFloat(candle.close));
      const volumes = closedCandles.map(candle => parseFloat(candle.volume));
      
      const ema3 = computeEma(closes, 3);
      const ema6 = computeEma(closes, 6);
      const ema9 = computeEma(closes, 9);
      const closesForRsi = closes.slice(-REQUIRED_RSI_SOURCE);
      const rsi14 = computeRsiRma(closesForRsi, 14);
      const closesForPreviousRsi = closesForRsi.slice(0, -1);
      const rsi14Previous = closesForPreviousRsi.length >= 15
        ? computeRsiRma(closesForPreviousRsi, 14)
        : null;

      const recentVolumes = volumes.slice(-VOLUME_MA_PERIOD);
      const volumeMa = recentVolumes.length === VOLUME_MA_PERIOD
        ? recentVolumes.reduce((sum, value) => sum + value, 0) / VOLUME_MA_PERIOD
        : null;

      const marketData = {
        open: parseFloat(latestClosedCandle.open),
        high: parseFloat(latestClosedCandle.high),
        low: parseFloat(latestClosedCandle.low),
        close: parseFloat(latestClosedCandle.close),
        volume: parseFloat(latestClosedCandle.volume),
        volumeMa,
        timestamp: latestClosedCandle.closeTime,
        indicators: {
          ema3,
          ema6,
          ema9,
          rsi14,
          rsi14Prev: rsi14Previous
        },
        history: closedCandles.slice(-96).map((candle: any) => ({
          open: parseFloat(candle.open),
          high: parseFloat(candle.high),
          low: parseFloat(candle.low),
          close: parseFloat(candle.close),
          volume: parseFloat(candle.volume),
          timestamp: candle.closeTime
        }))
      };


      // Get live price
      const livePriceData = await binanceService.getPrice();
      const livePrice = parseFloat(livePriceData.price);

      // Calculate 24h lowest from history
      const recentHistory = marketData.history || [];
      const last96Lows = recentHistory.map((entry: any) => entry.low);
      const lowestOf24h = last96Lows.length > 0 ? Math.min(...last96Lows) : null;

      if (lowestOf24h === null || !marketData.indicators) {
        return null;
      }

      // Get previous candle data
      const previousCandle = recentHistory.length >= 2 ? recentHistory[recentHistory.length - 2] : null;

      return {
        lastLow: marketData.low,
        lowestOf24h,
        lastRsi: marketData.indicators.rsi14,
        previousRsi: marketData.indicators.rsi14Prev,
        previousLow: previousCandle?.low || 0,
        lastEma3: marketData.indicators.ema3,
        lastEma6: marketData.indicators.ema6,
        lastEma9: marketData.indicators.ema9,
        livePrice,
        previousHigh: previousCandle?.high || 0,
        lastVolume: marketData.volume,
        volumeMa: marketData.volumeMa || 0,
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('Error getting market conditions:', error);
      return null;
    }
  }

  private evaluateRules(conditions: MarketConditions): TradingRules {
    const rules: RuleEvaluationResult[] = [
      {
        ruleKey: RULE_KEYS.RSI_MOMENTUM,
        label: RULE_LABELS[RULE_KEYS.RSI_MOMENTUM],
        isMet: conditions.lastRsi !== null && conditions.previousRsi !== null && 
               conditions.lastRsi > conditions.previousRsi,
        currentValue: conditions.lastRsi,
        comparisonValue: conditions.previousRsi
      },
      {
        ruleKey: RULE_KEYS.PRICE_RECOVERY,
        label: RULE_LABELS[RULE_KEYS.PRICE_RECOVERY],
        isMet: conditions.lastLow > conditions.previousLow,
        currentValue: conditions.lastLow,
        comparisonValue: conditions.previousLow
      },
      {
        ruleKey: RULE_KEYS.EMA_CROSSOVER,
        label: RULE_LABELS[RULE_KEYS.EMA_CROSSOVER],
        isMet: conditions.lastEma6 !== null && conditions.lastEma9 !== null && 
               conditions.lastEma6 > conditions.lastEma9,
        currentValue: conditions.lastEma6,
        comparisonValue: conditions.lastEma9
      },
      {
        ruleKey: RULE_KEYS.BREAKOUT,
        label: RULE_LABELS[RULE_KEYS.BREAKOUT],
        isMet: conditions.livePrice > conditions.previousHigh,
        currentValue: conditions.livePrice,
        comparisonValue: conditions.previousHigh
      },
      {
        ruleKey: RULE_KEYS.VOLUME_CONFIRMATION,
        label: RULE_LABELS[RULE_KEYS.VOLUME_CONFIRMATION],
        isMet: conditions.lastVolume > conditions.volumeMa,
        currentValue: conditions.lastVolume,
        comparisonValue: conditions.volumeMa
      }
    ];

    const trigger: RuleEvaluationResult = {
      ruleKey: RULE_KEYS.TRIGGER,
      label: RULE_LABELS[RULE_KEYS.TRIGGER],
      isMet: conditions.lastLow <= conditions.lowestOf24h,
      currentValue: conditions.lastLow,
      comparisonValue: conditions.lowestOf24h
    };

    return { trigger, rules };
  }

  private evaluateRules3and6(conditions: MarketConditions): TradingRules {
    const rules: RuleEvaluationResult[] = [
      {
        ruleKey: RULE_KEYS.RSI_MOMENTUM,
        label: RULE_LABELS[RULE_KEYS.RSI_MOMENTUM],
        isMet: conditions.lastRsi !== null && conditions.previousRsi !== null && 
               conditions.lastRsi > conditions.previousRsi,
        currentValue: conditions.lastRsi,
        comparisonValue: conditions.previousRsi
      },
      {
        ruleKey: RULE_KEYS.PRICE_RECOVERY,
        label: RULE_LABELS[RULE_KEYS.PRICE_RECOVERY],
        isMet: conditions.lastLow > conditions.previousLow,
        currentValue: conditions.lastLow,
        comparisonValue: conditions.previousLow
      },
      {
        ruleKey: 'ema3_crossover',
        label: 'Last EMA3 > Last EMA6',
        isMet: conditions.lastEma3 !== null && conditions.lastEma6 !== null && 
               conditions.lastEma3 > conditions.lastEma6,
        currentValue: conditions.lastEma3,
        comparisonValue: conditions.lastEma6
      },
      {
        ruleKey: RULE_KEYS.BREAKOUT,
        label: RULE_LABELS[RULE_KEYS.BREAKOUT],
        isMet: conditions.livePrice > conditions.previousHigh,
        currentValue: conditions.livePrice,
        comparisonValue: conditions.previousHigh
      },
      {
        ruleKey: RULE_KEYS.VOLUME_CONFIRMATION,
        label: RULE_LABELS[RULE_KEYS.VOLUME_CONFIRMATION],
        isMet: conditions.lastVolume > conditions.volumeMa,
        currentValue: conditions.lastVolume,
        comparisonValue: conditions.volumeMa
      }
    ];

    const trigger: RuleEvaluationResult = {
      ruleKey: RULE_KEYS.TRIGGER,
      label: RULE_LABELS[RULE_KEYS.TRIGGER],
      isMet: conditions.lastLow <= conditions.lowestOf24h,
      currentValue: conditions.lastLow,
      comparisonValue: conditions.lowestOf24h
    };

    return { trigger, rules };
  }

  private async handleTriggerCondition(conditions: MarketConditions, tradingRules: TradingRules): Promise<void> {
    try {
      // Check if there's already an active collection
      const activeCollections = await this.collectionsRef
        .where('status', '==', 'active')
        .limit(1)
        .get();

      if (!activeCollections.empty) {
        const activeDoc = activeCollections.docs[0];
        const activeCollection = activeDoc.data() as TradingCollection;
        
        // If the active collection has a buy signal, don't refresh it
        if (activeCollection.buySignal) {
          console.log(`Collection ${activeDoc.id} has buy signal - skipping refresh`);
          return;
        }

        // If the trigger is from the exact same lowest candle, don't reset
        // This prevents resetting the trigger time and rules continuously during the 15-minute window
        // where this candle remains the "latest closed candle"
        if (activeCollection.triggerPrice === conditions.lastLow) {
          console.log(`Collection ${activeDoc.id} already triggered at price ${conditions.lastLow} - skipping reset`);
          return;
        }

        const now = Timestamp.now();

        const resetRules: Record<string, RuleState> = {};
        tradingRules.rules.forEach(rule => {
          resetRules[rule.ruleKey] = {
            isMet: false
          };
        });

        await activeDoc.ref.update({
          triggerTime: now,
          triggerPrice: conditions.lastLow,
          rules: resetRules,
          buySignal: null,
          sellSignal: null,
          status: 'active',
          updatedAt: now
        });

        console.log(`Reset trading collection ${activeDoc.id} due to new trigger`);
        return;
      }

      console.log('Creating new trading collection...');

      // Create new collection
      const now = Timestamp.now();
      const collectionId = `collection_${Date.now()}`;
      
      const initialRules: { [key: string]: any } = {};
      tradingRules.rules.forEach(rule => {
        initialRules[rule.ruleKey] = {
          isMet: false
        };
      });

      const newCollection: TradingCollection = {
        id: collectionId,
        status: 'active',
        triggerTime: now,
        triggerPrice: conditions.lastLow,
        rules: initialRules,
        createdAt: now,
        updatedAt: now
      };

      await this.collectionsRef.doc(collectionId).set(newCollection);
      console.log(`Created new trading collection: ${collectionId}`);

    } catch (error) {
      console.error('Error handling trigger condition:', error);
      throw error;
    }
  }

  private async handlePureTriggerCondition(
    conditions: MarketConditions,
    triggerRule: RuleEvaluationResult,
    collectionsRef: CollectionReference,
    collectionLabel: string
  ): Promise<void> {
    try {
      // Check if there's already an active collection
      const activeCollections = await collectionsRef
        .where('status', '==', 'active')
        .limit(1)
        .get();

      if (!activeCollections.empty) {
        const activeDoc = activeCollections.docs[0];
        const activeCollection = activeDoc.data() as TradingCollection;
        
        // If the active collection has a buy signal, don't refresh it
        if (activeCollection.buySignal) {
          console.log(`${collectionLabel} collection ${activeDoc.id} has buy signal - skipping refresh`);
          return;
        }

        // If the trigger is from the exact same lowest candle, don't reset
        if (activeCollection.triggerPrice === conditions.lastLow) {
          console.log(`${collectionLabel} collection ${activeDoc.id} already triggered at price ${conditions.lastLow} - skipping reset`);
          return;
        }

        const now = Timestamp.now();

        await activeDoc.ref.update({
          triggerTime: now,
          triggerPrice: conditions.lastLow,
          rule: {
            isMet: true,
            metAt: now,
            metPrice: conditions.lastLow
          },
          buySignal: null,
          sellSignal: null,
          status: 'active',
          updatedAt: now
        });

        console.log(`Reset ${collectionLabel} trading collection ${activeDoc.id} due to new trigger`);
        return;
      }

      console.log(`Creating new ${collectionLabel} trading collection...`);

      // Create new collection
      const now = Timestamp.now();
      const collectionId = `collection_${Date.now()}`;

      const newCollection: TradingCollection = {
        id: collectionId,
        status: 'active',
        triggerTime: now,
        triggerPrice: conditions.lastLow,
        rules: {},
        rule: {
          isMet: true,
          metAt: now,
          metPrice: conditions.lastLow
        },
        createdAt: now,
        updatedAt: now
      };

      await collectionsRef.doc(collectionId).set(newCollection);
      console.log(`Created new ${collectionLabel} trading collection: ${collectionId}`);

    } catch (error) {
      console.error(`Error handling ${collectionLabel} trigger condition:`, error);
      throw error;
    }
  }

  private async processActiveCollections(conditions: MarketConditions, tradingRules: TradingRules): Promise<void> {
    try {
      const activeCollections = await this.collectionsRef
        .where('status', '==', 'active')
        .get();

      for (const doc of activeCollections.docs) {
        const collection = doc.data() as TradingCollection;
        await this.processCollection(doc.id, collection, conditions, tradingRules);
      }

    } catch (error) {
      console.error('Error processing active collections:', error);
      throw error;
    }
  }

  private async processPureActiveCollections(
    conditions: MarketConditions,
    triggerRule: RuleEvaluationResult,
    collectionsRef: CollectionReference,
    lossThreshold: number,
    collectionLabel: string
  ): Promise<void> {
    try {
      const activeCollections = await collectionsRef
        .where('status', '==', 'active')
        .get();

      for (const doc of activeCollections.docs) {
        const collection = doc.data() as TradingCollection;
        await this.processPureCollection(doc.id, collection, conditions, triggerRule, collectionsRef, lossThreshold, collectionLabel);
      }

    } catch (error) {
      console.error(`Error processing ${collectionLabel} active collections:`, error);
      throw error;
    }
  }

  private async processCollection(
    docId: string,
    collection: TradingCollection,
    conditions: MarketConditions,
    tradingRules: TradingRules
  ): Promise<void> {
    try {
      let hasUpdates = false;
      const updates: any = {
        updatedAt: Timestamp.now()
      };

      // Check exit conditions first if we have a buy signal
      if (collection.buySignal) {
        const buyPrice = collection.buySignal.price;
        const currentPrice = conditions.livePrice;
        
        if (currentPrice >= buyPrice * PROFIT_THRESHOLD) {
          // Profit exit
          updates.sellSignal = {
            time: Timestamp.now(),
            price: currentPrice,
            status: 'profit'
          };
          updates.status = 'completed';
          hasUpdates = true;
          console.log(`Collection ${docId} completed with profit: ${currentPrice} >= ${buyPrice * PROFIT_THRESHOLD}`);
        } else if (currentPrice <= buyPrice * LOSS_THRESHOLD) {
          // Loss exit
          updates.sellSignal = {
            time: Timestamp.now(),
            price: currentPrice,
            status: 'loss'
          };
          updates.status = 'completed';
          hasUpdates = true;
          console.log(`Collection ${docId} completed with loss: ${currentPrice} <= ${buyPrice * LOSS_THRESHOLD}`);
        }
      }

      // If not exiting, check rule updates
      if (!updates.sellSignal) {
        // Update rule states (rules can only go from false to true, never back)
        for (const rule of tradingRules.rules) {
          const currentRuleState = collection.rules?.[rule.ruleKey];
          
          if (currentRuleState && !currentRuleState.isMet && rule.isMet) {
            updates[`rules.${rule.ruleKey}`] = {
              isMet: true,
              metAt: Timestamp.now(),
              metPrice: rule.currentValue || conditions.livePrice
            };
            hasUpdates = true;
            console.log(`Rule ${rule.ruleKey} met for collection ${docId}`);
          }
        }

        // Check if all rules are now met for buy signal
        if (!collection.buySignal) {
          const allRulesMet = tradingRules.rules.every(rule => {
            const ruleState = collection.rules?.[rule.ruleKey];
            return ruleState?.isMet || rule.isMet;
          });

          if (allRulesMet) {
            updates.buySignal = {
              time: Timestamp.now(),
              price: conditions.livePrice
            };
            hasUpdates = true;
            console.log(`Buy signal generated for collection ${docId} at price ${conditions.livePrice}`);
          }
        }
      }

      // Apply updates if any
      if (hasUpdates) {
        await this.collectionsRef.doc(docId).update(updates);
        console.log(`Updated collection ${docId}`);
      }

    } catch (error) {
      console.error(`Error processing collection ${docId}:`, error);
      throw error;
    }
  }

  private async processPureCollection(
    docId: string,
    collection: TradingCollection,
    conditions: MarketConditions,
    triggerRule: RuleEvaluationResult,
    collectionsRef: CollectionReference,
    lossThreshold: number,
    collectionLabel: string
  ): Promise<void> {
    try {
      let hasUpdates = false;
      const updates: any = {
        updatedAt: Timestamp.now()
      };

      // Check exit conditions first if we have a buy signal
      if (collection.buySignal) {
        const buyPrice = collection.buySignal.price;
        const currentPrice = conditions.livePrice;
        
        if (currentPrice >= buyPrice * PROFIT_THRESHOLD) {
          // Profit exit
          updates.sellSignal = {
            time: Timestamp.now(),
            price: currentPrice,
            status: 'profit'
          };
          updates.status = 'completed';
          hasUpdates = true;
          console.log(`${collectionLabel} collection ${docId} completed with profit: ${currentPrice} >= ${buyPrice * PROFIT_THRESHOLD}`);
        } else if (currentPrice <= buyPrice * lossThreshold) {
          // Loss exit
          updates.sellSignal = {
            time: Timestamp.now(),
            price: currentPrice,
            status: 'loss'
          };
          updates.status = 'completed';
          hasUpdates = true;
          console.log(`${collectionLabel} collection ${docId} completed with loss: ${currentPrice} <= ${buyPrice * lossThreshold}`);
        }
      }

      // If not exiting and no buy signal yet, generate buy signal immediately since rule is always met
      if (!updates.sellSignal && !collection.buySignal) {
        updates.buySignal = {
          time: Timestamp.now(),
          price: conditions.livePrice
        };
        hasUpdates = true;
        console.log(`Buy signal generated for ${collectionLabel} collection ${docId} at price ${conditions.livePrice}`);
      }

      // Apply updates if any
      if (hasUpdates) {
        await collectionsRef.doc(docId).update(updates);
        console.log(`Updated ${collectionLabel} collection ${docId}`);
      }

    } catch (error) {
      console.error(`Error processing ${collectionLabel} collection ${docId}:`, error);
      throw error;
    }
  }

  private async handleTriggerCondition3and6(conditions: MarketConditions, tradingRules: TradingRules): Promise<void> {
    try {
      const activeCollections = await this.collections3and6Ref
        .where('status', '==', 'active')
        .limit(1)
        .get();

      if (!activeCollections.empty) {
        const activeDoc = activeCollections.docs[0];
        const activeCollection = activeDoc.data() as TradingCollection;
        
        if (activeCollection.buySignal) {
          console.log(`3&6 Collection ${activeDoc.id} has buy signal - skipping refresh`);
          return;
        }

        if (activeCollection.triggerPrice === conditions.lastLow) {
          console.log(`3&6 Collection ${activeDoc.id} already triggered at price ${conditions.lastLow} - skipping reset`);
          return;
        }

        const now = Timestamp.now();
        const resetRules: Record<string, RuleState> = {};
        tradingRules.rules.forEach(rule => {
          resetRules[rule.ruleKey] = { isMet: false };
        });

        await activeDoc.ref.update({
          triggerTime: now,
          triggerPrice: conditions.lastLow,
          rules: resetRules,
          buySignal: null,
          sellSignal: null,
          status: 'active',
          updatedAt: now
        });

        console.log(`Reset 3&6 trading collection ${activeDoc.id} due to new trigger`);
        return;
      }

      console.log('Creating new 3&6 trading collection...');
      const now = Timestamp.now();
      const collectionId = `collection_${Date.now()}`;
      
      const initialRules: { [key: string]: any } = {};
      tradingRules.rules.forEach(rule => {
        initialRules[rule.ruleKey] = { isMet: false };
      });

      const newCollection: TradingCollection = {
        id: collectionId,
        status: 'active',
        triggerTime: now,
        triggerPrice: conditions.lastLow,
        rules: initialRules,
        createdAt: now,
        updatedAt: now
      };

      await this.collections3and6Ref.doc(collectionId).set(newCollection);
      console.log(`Created new 3&6 trading collection: ${collectionId}`);

    } catch (error) {
      console.error('Error handling 3&6 trigger condition:', error);
      throw error;
    }
  }

  private async processActiveCollections3and6(conditions: MarketConditions, tradingRules: TradingRules): Promise<void> {
    try {
      const activeCollections = await this.collections3and6Ref
        .where('status', '==', 'active')
        .get();

      for (const doc of activeCollections.docs) {
        const collection = doc.data() as TradingCollection;
        await this.processCollection3and6(doc.id, collection, conditions, tradingRules);
      }

    } catch (error) {
      console.error('Error processing 3&6 active collections:', error);
      throw error;
    }
  }

  private async processCollection3and6(
    docId: string,
    collection: TradingCollection,
    conditions: MarketConditions,
    tradingRules: TradingRules
  ): Promise<void> {
    try {
      let hasUpdates = false;
      const updates: any = { updatedAt: Timestamp.now() };

      if (collection.buySignal) {
        const buyPrice = collection.buySignal.price;
        const currentPrice = conditions.livePrice;
        
        if (currentPrice >= buyPrice * PROFIT_THRESHOLD) {
          updates.sellSignal = { time: Timestamp.now(), price: currentPrice, status: 'profit' };
          updates.status = 'completed';
          hasUpdates = true;
          console.log(`3&6 Collection ${docId} completed with profit`);
        } else if (currentPrice <= buyPrice * LOSS_THRESHOLD) {
          updates.sellSignal = { time: Timestamp.now(), price: currentPrice, status: 'loss' };
          updates.status = 'completed';
          hasUpdates = true;
          console.log(`3&6 Collection ${docId} completed with loss`);
        }
      }

      if (!updates.sellSignal) {
        for (const rule of tradingRules.rules) {
          const currentRuleState = collection.rules?.[rule.ruleKey];
          
          if (currentRuleState && !currentRuleState.isMet && rule.isMet) {
            updates[`rules.${rule.ruleKey}`] = { isMet: true, metAt: Timestamp.now(), metPrice: rule.currentValue || conditions.livePrice };
            hasUpdates = true;
            console.log(`3&6 Rule ${rule.ruleKey} met for collection ${docId}`);
          }
        }

        if (!collection.buySignal) {
          const allRulesMet = tradingRules.rules.every(rule => {
            const ruleState = collection.rules?.[rule.ruleKey];
            return ruleState?.isMet || rule.isMet;
          });

          if (allRulesMet) {
            updates.buySignal = { time: Timestamp.now(), price: conditions.livePrice };
            hasUpdates = true;
            console.log(`3&6 Buy signal generated for collection ${docId} at price ${conditions.livePrice}`);
          }
        }
      }

      if (hasUpdates) {
        await this.collections3and6Ref.doc(docId).update(updates);
        console.log(`Updated 3&6 collection ${docId}`);
      }

    } catch (error) {
      console.error(`Error processing 3&6 collection ${docId}:`, error);
      throw error;
    }
  }

  async getActiveCollections(): Promise<TradingCollection[]> {
    try {
      const snapshot = await this.collectionsRef
        .where('status', '==', 'active')
        .orderBy('createdAt', 'desc')
        .get();

      return snapshot.docs.map(doc => doc.data() as TradingCollection);
    } catch (error) {
      console.error('Error getting active collections:', error);
      throw error;
    }
  }

  async getRecentCollections(limit: number = 10): Promise<TradingCollection[]> {
    try {
      const snapshot = await this.collectionsRef
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => doc.data() as TradingCollection);
    } catch (error) {
      console.error('Error getting recent collections:', error);
      throw error;
    }
  }
}

export const tradingService = new TradingService();
