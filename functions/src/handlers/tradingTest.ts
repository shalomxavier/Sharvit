import type { Request, Response } from 'express';
import { tradingService } from '../services/tradingService';
import { allowCors } from '../utils/cors';

export const tradingTestHandler = async (req: Request, res: Response): Promise<void> => {
  if (allowCors(req, res)) {
    return;
  }

  try {
    console.log('Manual trading test initiated...');
    
    // Run the trading process once
    await tradingService.processTrading();
    
    // Get current active collections
    const activeCollections = await tradingService.getActiveCollections();
    
    // Get recent collections for context
    const recentCollections = await tradingService.getRecentCollections(5);
    
    res.json({
      success: true,
      message: 'Trading process executed successfully',
      activeCollections: activeCollections.length,
      recentCollections: recentCollections.map(collection => ({
        id: collection.id,
        status: collection.status,
        triggerTime: collection.triggerTime,
        triggerPrice: collection.triggerPrice,
        rulesMetCount: Object.values(collection.rules).filter(rule => rule.isMet).length,
        totalRules: Object.keys(collection.rules).length,
        hasBuySignal: !!collection.buySignal,
        hasSellSignal: !!collection.sellSignal,
        sellStatus: collection.sellSignal?.status
      }))
    });
    
  } catch (error: any) {
    console.error('Trading test error:', error);
    res.status(500).json({ 
      error: 'Trading test failed',
      message: error.message 
    });
  }
};
