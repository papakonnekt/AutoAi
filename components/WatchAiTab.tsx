import React, { useRef, useEffect, useMemo } from 'react';
import { LogMessage, LogMessageAuthor, AgentStatus, LearnedMemory } from '../types';
import { PlayIcon, StopIcon } from './icons';

interface WatchAiTabProps {
  log: LogMessage[];
  onUserIntervention: (message: string) => void;
  agentStatus: AgentStatus;
  tasks: string[];
  resumeAgent: () => void;
  pauseAgent: () => void;
  onNodeLinkClick: (nodeId: string) => void;
  actionStats: { [key: string]: { success: number; error: number } };
}

const TaskListDisplay: React.FC<{ tasks: string[] }> = ({ tasks }) => {
    if (!tasks || tasks.length === 0) {
        return <span className="italic">No tasks assigned.</span>;
    }
    const primaryTask = tasks[0]?.replace(/\[(High|Medium|Low)\]\s*/, '').trim();
    return (
        <div className="flex items-center space-x-2 text-gray-400">
            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse [animation-delay:0.2s]"></div>
            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse [animation-delay:0.4s]"></div>
             <div>
                <span className="font-semibold text-gray-300 not-italic">Current Task: </span>
                <span className="italic">{primaryTask}</span>
            </div>
        </div>
    );
};


const getAuthorAppearance = (author: LogMessageAuthor) => {
    switch(author) {
        case LogMessageAuthor.THOUGHT:
            return { bg: 'bg-gray-800', text: 'text-yellow-400', label: 'THOUGHT' };
        case LogMessageAuthor.ACTION:
            return { bg: 'bg-indigo-900/50', text: 'text-cyan-400', label: 'ACTION' };
        case LogMessageAuthor.SYSTEM:
            return { bg: 'bg-gray-850', text: 'text-purple-400', label: 'SYSTEM' };
        case LogMessageAuthor.USER:
            return { bg: 'bg-green-900/50', text: 'text-green-400', label: 'USER' };
        // MAS Agents
        case LogMessageAuthor.PLANNER:
            return { bg: 'bg-sky-900/50', text: 'text-sky-300', label: 'PLANNER' };
        case LogMessageAuthor.PROPOSER:
            return { bg: 'bg-gray-800', text: 'text-yellow-400', label: 'PROPOSER' };
        case LogMessageAuthor.CRITIC_CLARITY:
            return { bg: 'bg-orange-900/50', text: 'text-orange-300', label: 'CRITIC (Clarity)' };
        case LogMessageAuthor.CRITIC_EFFICIENCY:
            return { bg: 'bg-rose-900/50', text: 'text-rose-300', label: 'CRITIC (Efficiency)' };
        case LogMessageAuthor.CRITIC_SECURITY:
            return { bg: 'bg-red-900/50', text: 'text-red-300', label: 'CRITIC (Security)' };
        case LogMessageAuthor.SYNTHESIZER:
            return { bg: 'bg-emerald-900/50', text: 'text-emerald-300', label: 'SYNTHESIZER' };
        default:
            return { bg: 'bg-gray-900', text: 'text-gray-400', label: 'UNKNOWN' };
    }
}

const LogEntry: React.FC<{ message: LogMessage, onNodeLinkClick: (nodeId: string) => void }> = ({ message, onNodeLinkClick }) => {
    const { bg, text, label } = getAuthorAppearance(message.author);

    const formatContent = (content: string) => {
        if (message.author === LogMessageAuthor.ACTION) {
            if (content.startsWith('REWRITE_CODE')) {
                const code = content.substring(content.indexOf('```'), content.lastIndexOf('```') + 3);
                return (
                    <>
                        <span className="font-semibold">REWRITE_CODE</span>
                        <pre className="mt-2 p-3 bg-gray-950 rounded-md overflow-x-auto text-sm text-gray-300"><code>{code.trim()}</code></pre>
                    </>
                );
            }
             if (content.startsWith('GOOGLE_SEARCH')) {
                const query = content.substring('GOOGLE_SEARCH'.length).trim();
                return <><span className="font-semibold">GOOGLE_SEARCH</span> <code className="bg-gray-950 p-1 rounded text-cyan-300">{query}</code></>;
            }
        }
        
        if (message.author === LogMessageAuthor.SYSTEM && content.includes('System automatically updated to v')) {
            const parts = content.split(/(v\d+)/);
            return parts.map((part, index) => {
                if (/^v\d+$/.test(part)) {
                    return <button key={index} onClick={() => onNodeLinkClick(part)} className="font-bold text-indigo-400 hover:underline">{part}</button>
                }
                return part;
            })
        }
        
        return content;
    };
    
    const renderGrounding = (metadata: any) => {
        if (!metadata?.groundingChunks?.length) return null;
        
        return (
            <div className="mt-2 pt-2 border-t border-gray-700/50">
                <h4 className="text-xs font-semibold text-gray-400 mb-1">Sources from Google Search:</h4>
                <ul className="flex flex-wrap gap-2">
                    {metadata.groundingChunks.map((chunk: any, index: number) => chunk.web && (
                        <li key={index}>
                            <a href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="text-xs bg-gray-700 hover:bg-gray-600 text-indigo-300 px-2 py-1 rounded-full transition-colors">
                                {chunk.web.title || new URL(chunk.web.uri).hostname}
                            </a>
                        </li>
                    ))}
                </ul>
            </div>
        )
    }

    return (
        <div className={`p-4 rounded-lg border border-transparent ${bg}`}>
            <div className="flex justify-between items-center text-xs mb-2">
                <span className={`font-bold ${text}`}>{label}</span>
                <span className="text-gray-500">{message.timestamp}</span>
            </div>
            <div className="text-gray-300 whitespace-pre-wrap text-sm">
                {formatContent(message.content)}
                {renderGrounding(message.metadata)}
            </div>
        </div>
    );
};


const WatchAiTab: React.FC<WatchAiTabProps> = ({ log, onUserIntervention, agentStatus, tasks, resumeAgent, pauseAgent, onNodeLinkClick, actionStats }) => {
    const formRef = useRef<HTMLFormElement>(null);
    const logContainerRef = useRef<HTMLDivElement>(null);
    const isRunning = agentStatus === 'RUNNING' || agentStatus === 'PLANNING' || agentStatus === 'PROPOSING' || agentStatus === 'CRITICIZING' || agentStatus === 'SYNTHESIZING' || agentStatus === 'EXECUTING';


    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = 0;
        }
    }, [log]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const input = formRef.current?.querySelector('input');
        if (input?.value) {
            onUserIntervention(input.value);
            input.value = '';
        }
    };
    
    const getStatusIndicator = () => {
        const baseClasses = "px-3 py-1 text-sm font-semibold rounded-full";
        switch (agentStatus) {
            case 'RUNNING':
            case 'PLANNING':
            case 'PROPOSING':
            case 'CRITICIZING':
            case 'SYNTHESIZING':
            case 'EXECUTING':
                return <div className={`${baseClasses} bg-blue-500 text-white`}>Running</div>;
            case 'PAUSED':
                return <div className={`${baseClasses} bg-yellow-500 text-gray-900`}>Paused</div>;
            case 'ERROR':
                return <div className={`${baseClasses} bg-red-500 text-white`}>Error</div>;
            case 'IDLE':
                return <div className={`${baseClasses} bg-gray-600 text-gray-200`}>Idle</div>;
            default:
                return null;
        }
    };

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">Watch AI</h2>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                <div className="lg:col-span-2 p-3 bg-gray-900 rounded-lg border border-gray-800 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        {getStatusIndicator()}
                        <div className="text-gray-400 text-sm">
                           {isRunning ? (
                             <TaskListDisplay tasks={tasks} />
                           ) : (
                             <div>
                                <span className="font-semibold text-gray-300 not-italic">Status: </span>
                                <span className="italic">{agentStatus === 'PAUSED' ? 'Agent is paused. Press Resume to continue.' : agentStatus === 'IDLE' ? 'Agent is idle. Press Resume to start.' : 'Agent has stopped due to an error.'}</span>
                            </div>
                           )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                         <button onClick={resumeAgent} disabled={isRunning} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            <PlayIcon className="w-5 h-5" />
                            Resume
                        </button>
                        <button onClick={pauseAgent} disabled={!isRunning} className="flex items-center gap-2 bg-red-600 hover:red-700 text-white font-bold py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            <StopIcon className="w-5 h-5" />
                            Pause
                        </button>
                    </div>
                </div>
                 <div className="p-3 bg-gray-900 rounded-lg border border-gray-800">
                    <h3 className="text-sm font-semibold text-white mb-2">Action Success Rate</h3>
                    <div className="text-xs space-y-1 overflow-y-auto max-h-24">
                        {Object.keys(actionStats).length > 0 ? Object.entries(actionStats).map(([action, stats]) => {
                            const total = stats.success + stats.error;
                            const successRate = total > 0 ? (stats.success / total) * 100 : 0;
                            return (
                                <div key={action} className="grid grid-cols-3 gap-1 items-center">
                                    <span className="text-gray-400 truncate">{action.replace(/_/g, ' ')}</span>
                                    <div className="col-span-2 bg-gray-700 rounded-full h-4">
                                         <div className="bg-green-500 h-4 rounded-full text-center text-black font-bold" style={{ width: `${successRate}%` }}>
                                            {stats.success}/{total}
                                         </div>
                                    </div>
                                </div>
                            )
                        }) : <p className="text-gray-500">No action data yet.</p>}
                    </div>
                </div>
            </div>

            <div ref={logContainerRef} className="flex-grow bg-gray-900 rounded-lg p-4 border border-gray-800 overflow-y-auto flex flex-col-reverse gap-4">
                {log.map(message => <LogEntry key={message.id} message={message} onNodeLinkClick={onNodeLinkClick} />)}
            </div>
            <div className="mt-4">
                <form ref={formRef} onSubmit={handleSubmit} className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Intervene with a message to the AI..."
                        className="flex-grow bg-gray-800 border border-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-200"
                        disabled={isRunning}
                    />
                    <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition-colors disabled:opacity-50" disabled={isRunning}>
                        Send
                    </button>
                </form>
            </div>
        </div>
    );
};

export default WatchAiTab;