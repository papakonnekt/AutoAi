import { AIMode } from '../types';
import { QUOTA_LIMITS } from '../constants';

// Use a constant for the free mode key to avoid magic strings
const FREE_MODE_KEY = 'FREE_MODE_KEY';

class QuotaManager {
  private histories: Map<string, number[]> = new Map();

  public checkQuota(mode: AIMode, apiKey: string | null): { allowed: boolean; reason?: string } {
    const key = mode === AIMode.PAID ? apiKey : FREE_MODE_KEY;
    if (!key) {
        // This can happen in paid mode if no key is provided.
        return { allowed: false, reason: 'API Key is missing for Paid Mode.' };
    }
    
    const limits = QUOTA_LIMITS[mode];
    const stats = this.getUsageStats(key);

    // Check RPM
    if (stats.rpm >= limits.RPM) {
      return { allowed: false, reason: 'RPM limit exceeded.' };
    }

    // Check RPD (only for FREE mode)
    if (mode === AIMode.FREE && stats.rpd >= limits.RPD) {
      return { allowed: false, reason: 'RPD limit exceeded.' };
    }
    
    return { allowed: true };
  }

  public recordCall(apiKey: string | null): void {
    const key = apiKey || FREE_MODE_KEY;
    if (!this.histories.has(key)) {
      this.histories.set(key, []);
    }
    const history = this.histories.get(key)!;
    history.push(Date.now());
    
    // Clean up old history to prevent memory leak
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.histories.set(key, history.filter(call => call > oneDayAgo));
  }

  public getUsageStats(apiKey: string | null): { rpm: number; rpd: number } {
    const key = apiKey || FREE_MODE_KEY;
    const history = this.histories.get(key) || [];
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;

    const recentCalls = history.filter(call => call > oneMinuteAgo);
    
    return {
        rpm: recentCalls.length,
        rpd: history.length // The array is already cleaned of entries older than a day
    };
  }
}

export const quotaManager = new QuotaManager();