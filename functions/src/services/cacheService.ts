import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp();
}

interface CacheItem {
  value: any;
  expiresAt: Timestamp;
  nextUpdateTime?: number;
}

class CacheService {
  private db = getFirestore();
  private collection = 'cache';

  async set(key: string, value: any, ttlSeconds: number, nextUpdateTime?: number): Promise<void> {
    const expiresAt = Timestamp.fromMillis(Date.now() + (ttlSeconds * 1000));
    
    const cacheItem: CacheItem = {
      value,
      expiresAt,
      ...(nextUpdateTime && { nextUpdateTime })
    };

    await this.db.collection(this.collection).doc(key).set(cacheItem);
  }

  async get(key: string): Promise<any> {
    try {
      const doc = await this.db.collection(this.collection).doc(key).get();
      
      if (!doc.exists) {
        return null;
      }

      const item = doc.data() as CacheItem;
      
      if (!item) {
        return null;
      }

      // Check if expired
      if (Date.now() > item.expiresAt.toMillis()) {
        // Delete expired item
        await this.delete(key);
        return null;
      }

      return item.value;
    } catch (error) {
      console.error(`Error getting cache item ${key}:`, error);
      return null;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      await this.db.collection(this.collection).doc(key).delete();
      return true;
    } catch (error) {
      console.error(`Error deleting cache item ${key}:`, error);
      return false;
    }
  }

  async clear(): Promise<void> {
    try {
      const snapshot = await this.db.collection(this.collection).get();
      const batch = this.db.batch();
      
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  async size(): Promise<number> {
    try {
      const snapshot = await this.db.collection(this.collection).get();
      return snapshot.size;
    } catch (error) {
      console.error('Error getting cache size:', error);
      return 0;
    }
  }

  // Clean up expired entries
  async cleanup(): Promise<void> {
    try {
      const now = Timestamp.now();
      const snapshot = await this.db.collection(this.collection)
        .where('expiresAt', '<=', now)
        .get();
      
      if (snapshot.empty) {
        return;
      }

      const batch = this.db.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      console.log(`Cleaned up ${snapshot.size} expired cache entries`);
    } catch (error) {
      console.error('Error during cache cleanup:', error);
    }
  }
}

export const cacheService = new CacheService();
