import React from 'react';
import { AgentStatus } from '../types';

const ALL_STATUSES: AgentStatus[] = [
    'PLANNING',
    'RESEARCHING',
    'PROPOSING',
    'CRITICIZING',
    'SYNTHESIZING',
    'EXECUTING',
];

const getStatusColor = (status: AgentStatus, isActive: boolean): string => {
    if (!isActive) return 'bg-gray-600';
    switch (status) {
        case 'PLANNING': return 'bg-sky-500';
        case 'RESEARCHING': return 'bg-blue-500';
        case 'PROPOSING': return 'bg-yellow-500';
        case 'CRITICIZING': return 'bg-red-500';
        case 'SYNTHESIZING': return 'bg-emerald-500';
        case 'EXECUTING': return 'bg-purple-500';
        default: return 'bg-gray-600';
    }
}

const AgentStatusLed: React.FC<{ currentStatus: AgentStatus }> = ({ currentStatus }) => {
    return (
        <div className="flex items-center gap-2 p-2 bg-gray-900/50 rounded-lg border border-gray-700">
            {ALL_STATUSES.map(status => {
                const isActive = currentStatus === status;
                return (
                    <div key={status} className="flex flex-col items-center group">
                         <div className={`w-3 h-3 rounded-full transition-all duration-300 ${getStatusColor(status, isActive)} ${isActive ? 'animate-pulse' : ''}`}></div>
                         <span className={`mt-1 text-xs font-mono transition-colors ${isActive ? 'text-white' : 'text-gray-500'}`}>{status.substring(0, 4)}</span>
                    </div>
                );
            })}
        </div>
    );
};

export default AgentStatusLed;