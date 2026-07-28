import { onSchedule } from 'firebase-functions/v2/scheduler';
import { tradingService } from '../services/tradingService';

export const tradingScheduler = onSchedule({
  schedule: '* * * * *',
  timeZone: 'Asia/Singapore',
  region: 'asia-southeast1',
  memory: '256MiB',
  timeoutSeconds: 60
}, async (event) => {
  console.log('Trading scheduler triggered at:', new Date().toISOString());
  
  try {
    // Fetch a single shared market snapshot for this cycle
    const marketConditions = await tradingService.getMarketConditions();
    if (!marketConditions) {
      console.log('Market data unavailable, skipping trading cycle');
      return;
    }

    // Process original full strategy
    await tradingService.processTrading(marketConditions);
    console.log('Trading process completed successfully');
    
    // Process pure lowest of 24 strategy
    await tradingService.processPureLowestOf24(marketConditions);
    console.log('Pure lowest of 24 process completed successfully');

    // Process pure lowest of 24 strategy with 0.9% loss
    await tradingService.processPureLowestOf24_09(marketConditions);
    console.log('Pure lowest of 24 0.9% loss process completed successfully');
    
    // Process lowest of 24 3&6 strategy
    await tradingService.processLowestOf24_3and6(marketConditions);
    console.log('Lowest of 24 3&6 process completed successfully');
  } catch (error) {
    console.error('Trading scheduler error:', error);
    
    // Log additional context for debugging
    console.error('Event context:', {
      scheduleTime: event.scheduleTime
    });
    
    // Re-throw to trigger retry mechanism
    throw error;
  }
});
