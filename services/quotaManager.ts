import { AIMode } from '../types';
import { QUOTA_LIMITS } from '../constants';

interface CallRecord {
  timestamp: number;
  tokens: number;
}

class QuotaManager {
  private callHistory: CallRecord[] = [];

  public checkQuota(mode: AIMode): { allowed: boolean; reason?: string } {
    const now = Date.now();
    const limits = QUOTA_LIMITS[mode];

    // Filter history for relevant time windows
    const oneMinuteAgo = now - 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const recentCalls = this.callHistory.filter(call => call.timestamp > oneMinuteAgo);
    const dailyCalls = this.callHistory.filter(call => call.timestamp > oneDayAgo);

    // Check RPM
    if (recentCalls.length >= limits.RPM) {
      return { allowed: false, reason: 'RPM limit exceeded.' };
    }

    // Check RPD (only for FREE mode)
    if (mode === AIMode.FREE && dailyCalls.length >= limits.RPD) {
      return { allowed: false, reason: 'RPD limit exceeded.' };
    }
    
    // Check TPM
    const tokensInLastMinute = recentCalls.reduce((sum, call) => sum + call.tokens, 0);
    if (tokensInLastMinute >= limits.TPM) {
        return { allowed: false, reason: 'TPM limit exceeded.' };
    }

    return { allowed: true };
  }

  public recordCall(tokens: number): void {
    this.callHistory.push({ timestamp: Date.now(), tokens });
    // Clean up old history to prevent memory leak
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.callHistory = this.callHistory.filter(call => call.timestamp > oneDayAgo);
  }

  public getUsageStats(): { rpm: number; tpm: number; rpd: number } {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const recentCalls = this.callHistory.filter(call => call.timestamp > oneMinuteAgo);
    const dailyCalls = this.callHistory.filter(call => call.timestamp > oneDayAgo);
    
    const tokensInLastMinute = recentCalls.reduce((sum, call) => sum + call.tokens, 0);

    return {
        rpm: recentCalls.length,
        tpm: tokensInLastMinute,
        rpd: dailyCalls.length
    };
  }
}

export const quotaManager = new QuotaManager();