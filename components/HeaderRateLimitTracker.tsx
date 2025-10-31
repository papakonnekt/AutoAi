import React, { useState, useEffect } from 'react';
import { quotaManager } from '../services/quotaManager';
import { QUOTA_LIMITS } from '../constants';
import { AIMode } from '../types';

interface HeaderRateLimitTrackerProps {
  apiKey: string | null;
  aiMode: AIMode;
}

const getDotColor = (value: number, limit: number) => {
    if (limit === Infinity) return 'bg-green-500';
    const percentage = (value / limit) * 100;
    if (percentage >= 100) return 'bg-red-500 animate-pulse';
    if (percentage > 75) return 'bg-yellow-500';
    return 'bg-green-500';
}

const HeaderRateLimitTracker: React.FC<HeaderRateLimitTrackerProps> = ({ apiKey, aiMode }) => {
  const [usage, setUsage] = useState({ rpm: 0, rpd: 0 });
  const keyToTrack = aiMode === AIMode.PAID ? apiKey : null;
  const limits = QUOTA_LIMITS[aiMode];

  useEffect(() => {
    const interval = setInterval(() => {
      setUsage(quotaManager.getUsageStats(keyToTrack));
    }, 2000); // Poll every 2 seconds
    return () => clearInterval(interval);
  }, [keyToTrack]);

  return (
    <div className="flex items-center gap-3 text-xs font-mono p-2 bg-gray-900/50 rounded-lg border border-gray-700">
        <div className="flex items-center gap-2" title={`Requests Per Minute (Limit: ${limits.RPM})`}>
            <div className={`w-2 h-2 rounded-full ${getDotColor(usage.rpm, limits.RPM)}`}></div>
            <span className="text-gray-400">RPM:</span>
            <span className="text-white font-semibold">{usage.rpm}</span>
        </div>
        <div className="border-l h-4 border-gray-600"></div>
        <div className="flex items-center gap-2" title={`Requests Per Day (Limit: ${limits.RPD === Infinity ? '∞' : limits.RPD})`}>
             <div className={`w-2 h-2 rounded-full ${getDotColor(usage.rpd, limits.RPD)}`}></div>
            <span className="text-gray-400">RPD:</span>
            <span className="text-white font-semibold">{usage.rpd}</span>
        </div>
    </div>
  );
};

export default HeaderRateLimitTracker;