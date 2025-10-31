import React from 'react';

const RateLimitBar: React.FC<{
    label: string;
    value: number;
    limit: number;
    compact?: boolean;
}> = ({ label, value, limit, compact = false }) => {
    const percentage = limit === Infinity ? 0 : Math.min((value / limit) * 100, 100);
    const isApproaching = percentage > 75;
    const isExceeded = percentage >= 100;
    let barColor = 'bg-indigo-500';
    if (isExceeded) barColor = 'bg-red-500';
    else if (isApproaching) barColor = 'bg-yellow-500';

    const height = compact ? "h-2" : "h-2.5";

    return (
        <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>{label}</span>
                <span>{value} / {limit === Infinity ? '∞' : limit}</span>
            </div>
            <div className={`w-full bg-gray-700 rounded-full ${height}`}>
                <div className={`${barColor} ${height} rounded-full`} style={{ width: `${percentage}%` }}></div>
            </div>
        </div>
    );
};


interface RateLimitDisplayProps {
    title: string;
    stats: { rpm: number, rpd: number };
    // Fix: Corrected the type for RPD. 'Infinity' is a value of type 'number', not a type itself.
    limits: { RPM: number, RPD: number };
    compact?: boolean;
}

const RateLimitDisplay: React.FC<RateLimitDisplayProps> = ({ title, stats, limits, compact=false }) => {
    return (
        <div className={compact ? "space-y-2" : "space-y-3"}>
            <h4 className={`font-semibold text-white ${compact ? 'text-xs' : 'text-sm'}`}>{title}</h4>
            <RateLimitBar label="Requests (RPM)" value={stats.rpm} limit={limits.RPM} compact={compact} />
            <RateLimitBar label="Daily Requests (RPD)" value={stats.rpd} limit={limits.RPD} compact={compact} />
        </div>
    );
};

export default RateLimitDisplay;