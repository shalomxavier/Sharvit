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
    await tradingService.processTrading();
    console.log('Trading process completed successfully');
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
