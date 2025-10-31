import React, { useState, useEffect, useCallback, useRef } from 'react';
import useLocalStorage from './hooks/useLocalStorage';
import { LogMessage, LogMessageAuthor, AIMode, UpgradeNode, AgentStatus, LearnedMemory, LearnedMemoryType } from './types';
import { runAIAgentTurn } from './services/geminiService';
import { quotaManager } from './services/quotaManager';
import WatchAiTab from './components/WatchAiTab';
import WebGraphTab from './components/WebGraphTab';
import SettingsTab from './components/SettingsTab';
import ChatBot from './components/ChatBot';
import CodeDiffTab from './components/CodeDiffTab';
import LivePreviewTab from './components/LivePreviewTab';
import TutorialsTab from './components/TutorialsTab';
import { EyeIcon, CodeIcon, CogIcon, DocumentDuplicateIcon, DesktopComputerIcon, BookOpenIcon } from './components/icons';

// Allow using Babel for in-browser transpilation check
declare const Babel: any;

const ALL_FILES = [
    '/App.tsx',
    '/components/ChatBot.tsx',
    '/components/CodeDiffTab.tsx',
    '/components/icons.tsx',
    '/components/SettingsTab.tsx',
    '/components/WatchAiTab.tsx',
    '/components/WebGraphTab.tsx',
    '/components/LivePreviewTab.tsx',
    '/components/TutorialsTab.tsx',
    '/constants.ts',
    '/hooks/useLocalStorage.ts',
    '/index.html',
    '/index.tsx',
    '/preview.html',
    '/services/geminiService.ts',
    '/services/quotaManager.ts',
    '/types.ts',
    '/globalMemories.json',
];

const App: React.FC = () => {
    const [activeTab, setActiveTab] = useLocalStorage('active-tab', 'watch');
    const [apiKey, setApiKey] = useLocalStorage<string | null>('gemini-api-key', null);
    const [aiMode, setAiMode] = useLocalStorage<AIMode>('ai-mode', AIMode.FREE);
    const [log, setLog] = useLocalStorage<LogMessage[]>('ai-log', []);
    const [upgradeNodes, setUpgradeNodes] = useLocalStorage<UpgradeNode[]>('ai-upgrade-nodes', []);
    const [learnedMemories, setLearnedMemories] = useLocalStorage<LearnedMemory[]>('ai-learned-memories', []);
    const [agentStatus, setAgentStatus] = useState<AgentStatus>('IDLE');
    const [currentTask, setCurrentTask] = useState('Agent is idle. Press Start to begin.');
    const [consecutiveSearches, setConsecutiveSearches] = useLocalStorage<number>('ai-consecutive-searches', 0);
    const [virtualFileSystem, setVirtualFileSystem] = useLocalStorage<{ [key: string]: string }>('ai-vfs', {});
    const [updateNotification, setUpdateNotification] = useState<string | null>(null);
    
    const agentLoopTimeout = useRef<number | null>(null);

    // Create refs to hold the latest state for use in callbacks, avoiding stale closures.
    const vfsRef = useRef(virtualFileSystem);
    useEffect(() => { vfsRef.current = virtualFileSystem; }, [virtualFileSystem]);
    
    const logRef = useRef(log);
    useEffect(() => { logRef.current = log; }, [log]);

    const learnedMemoriesRef = useRef(learnedMemories);
    useEffect(() => { learnedMemoriesRef.current = learnedMemories; }, [learnedMemories]);
    
    const agentStatusRef = useRef(agentStatus);
    useEffect(() => { agentStatusRef.current = agentStatus; }, [agentStatus]);


    const addLogMessage = useCallback((author: LogMessageAuthor, content: string, metadata?: any) => {
        setLog(prevLog => [{
            id: Date.now().toString() + Math.random(),
            author,
            content,
            timestamp: new Date().toLocaleTimeString(),
            metadata
        }, ...prevLog]);
    }, [setLog]);

    const logLearnedMemory = useCallback((type: LearnedMemoryType, context: string, outcome: string, learning: string) => {
        setLearnedMemories(prev => [...prev, {
            id: `mem-${Date.now()}`,
            timestamp: new Date().toISOString(),
            type,
            context,
            outcome,
            learning,
            agentVersion: upgradeNodes.length
        }]);
    }, [setLearnedMemories, upgradeNodes.length]);

    const executeAction = useCallback((action: string, thought: string): {shouldContinue: boolean, longPause: boolean} => {
        const rewriteMatch = action.match(/^REWRITE_CODE\s+"([^"]+)"\s*```(?:typescript|javascript|markdown)?\n([\s\S]*?)\n```/);
        const saveMatch = action.match(/^SAVE_FILE\s+"([^"]+)"\s*```(?:typescript|javascript)?\n([\s\S]*?)\n```/);
        const appendMatch = action.match(/^APPEND_TO_FILE\s+"([^"]+)"\s*```\n([\s\S]*?)\n```/);
        const readMatch = action.match(/^READ_FILE\s+"([^"]+)"/);
        const deleteMatch = action.match(/^DELETE_FILE\s+"([^"]+)"/);
        const moveMatch = action.match(/^MOVE_FILE\s+"([^"]+)"\s+"([^"]+)"/);
        const listMatch = action.startsWith('LIST_FILES');
        const searchMatch = action.startsWith('GOOGLE_SEARCH');

        if (rewriteMatch) {
            const filePath = rewriteMatch[1];
            const newCode = rewriteMatch[2].trim();
            const isCodeFile = /\.(ts|tsx|js|jsx)$/.test(filePath);
            
            try {
                // Health Check: Only transpile code files
                if (isCodeFile) {
                    setCurrentTask(`Performing health check on ${filePath}...`);
                    Babel.transform(newCode, {
                        presets: ['react', 'typescript'],
                        filename: filePath // Helps Babel use correct loaders for .tsx
                    });
                     addLogMessage(LogMessageAuthor.SYSTEM, `Code health check passed for ${filePath}.`);
                }

                // If health check passes (or isn't needed), proceed with the update
                setCurrentTask(`Applying changes to ${filePath}...`);
                
                if (!vfsRef.current[filePath]) {
                    const errorMsg = `Upgrade failed: File "${filePath}" does not exist in the virtual filesystem.`;
                    addLogMessage(LogMessageAuthor.SYSTEM, errorMsg);
                    logLearnedMemory('ERROR', `REWRITE_CODE on "${filePath}"`, 'Action failed.', 'Must verify a file exists with LIST_FILES before attempting to rewrite it.');
                    return { shouldContinue: true, longPause: false };
                }

                setVirtualFileSystem(prev => ({ ...prev, [filePath]: newCode }));
                addLogMessage(LogMessageAuthor.SYSTEM, `Successfully rewrote ${filePath}.`);

                // Only create upgrade nodes for actual code changes
                if(isCodeFile) {
                    setUpgradeNodes(prev => {
                        const newVersion = prev.length + 1;
                        addLogMessage(LogMessageAuthor.SYSTEM, `Upgrade successful. System automatically updated to v${newVersion}.`);
                        setUpdateNotification(`System updated to v${newVersion}! (${filePath} modified)`);
                        setTimeout(() => setUpdateNotification(null), 4000);
                        
                        logLearnedMemory('SUCCESS', `REWRITE_CODE on "${filePath}"`, `File successfully updated to version ${newVersion}.`, 'The REWRITE_CODE action is effective for applying planned code changes after a successful health check.');

                        return [...prev, {
                            id: `v${newVersion}`,
                            version: newVersion,
                            timestamp: new Date().toISOString(),
                            filePath: filePath,
                            code: newCode,
                            thought: thought,
                            action: action
                        }];
                    });
                }
                setConsecutiveSearches(0);
                return { shouldContinue: true, longPause: isCodeFile }; // Long pause for code changes, short for plan changes

            } catch (error: any) {
                // Health Check Failed
                const errorMsg = `Upgrade failed: Generated code for "${filePath}" is syntactically invalid and was rejected. Error: ${error.message}`;
                addLogMessage(LogMessageAuthor.SYSTEM, errorMsg);
                logLearnedMemory('ERROR', `REWRITE_CODE on "${filePath}"`, 'Health check failed.', `The generated code had a syntax error. Future code must be valid TypeScript/React. Error details: ${error.message}`);
                return { shouldContinue: true, longPause: false }; // Let AI try again immediately
            }

        } else if (saveMatch) {
            const filePath = saveMatch[1];
            const newCode = saveMatch[2].trim();
            const isCodeFile = /\.(ts|tsx|js|jsx)$/.test(filePath);

            if (vfsRef.current[filePath]) {
                const errorMsg = `Save failed: File "${filePath}" already exists. Use REWRITE_CODE to modify it.`;
                addLogMessage(LogMessageAuthor.SYSTEM, errorMsg);
                logLearnedMemory('ERROR', `SAVE_FILE on "${filePath}"`, 'Action failed.', 'SAVE_FILE can only be used for new files. Use REWRITE_CODE to modify existing files.');
                return { shouldContinue: true, longPause: false };
            }

            try {
                if (isCodeFile) {
                    setCurrentTask(`Performing health check on new file ${filePath}...`);
                    Babel.transform(newCode, {
                        presets: ['react', 'typescript'],
                        filename: filePath
                    });
                     addLogMessage(LogMessageAuthor.SYSTEM, `Code health check passed for new file ${filePath}.`);
                }

                setCurrentTask(`Creating new file ${filePath}...`);
                setVirtualFileSystem(prev => ({ ...prev, [filePath]: newCode }));
                addLogMessage(LogMessageAuthor.SYSTEM, `Successfully created file: ${filePath}`);

                logLearnedMemory('SUCCESS', `SAVE_FILE on "${filePath}"`, 'New file successfully created.', 'The SAVE_FILE action is effective for creating new, syntactically valid files in the VFS.');

                setConsecutiveSearches(0);
                return { shouldContinue: true, longPause: false };

            } catch (error: any) {
                const errorMsg = `Save failed: Generated code for "${filePath}" is syntactically invalid and was rejected. Error: ${error.message}`;
                addLogMessage(LogMessageAuthor.SYSTEM, errorMsg);
                logLearnedMemory('ERROR', `SAVE_FILE on "${filePath}"`, 'Health check failed.', `The generated code had a syntax error. New files must contain valid TypeScript/React. Error details: ${error.message}`);
                return { shouldContinue: true, longPause: false };
            }

        } else if (appendMatch) {
            const filePath = appendMatch[1];
            const contentToAppend = appendMatch[2];
            const isCodeFile = /\.(ts|tsx|js|jsx)$/.test(filePath);

            const oldCode = vfsRef.current[filePath];
            if (!oldCode) {
                const errorMsg = `Append failed: File "${filePath}" does not exist. Use SAVE_FILE to create it first.`;
                addLogMessage(LogMessageAuthor.SYSTEM, errorMsg);
                logLearnedMemory('ERROR', `APPEND_TO_FILE on "${filePath}"`, 'Action failed.', 'Cannot append to a non-existent file. Must use SAVE_FILE first.');
                return { shouldContinue: true, longPause: false };
            }

            const newCode = oldCode + '\n' + contentToAppend;
            
            try {
                if (isCodeFile) {
                    setCurrentTask(`Performing health check on ${filePath} after append...`);
                    Babel.transform(newCode, {
                        presets: ['react', 'typescript'],
                        filename: filePath
                    });
                }
                
                setCurrentTask(`Appending content to ${filePath}...`);
                setVirtualFileSystem(prev => ({ ...prev, [filePath]: newCode }));

                if (isCodeFile) {
                    setUpgradeNodes(prev => {
                        const newVersion = prev.length + 1;
                        addLogMessage(LogMessageAuthor.SYSTEM, `File ${filePath} successfully appended. System updated to v${newVersion}.`);
                        setUpdateNotification(`System updated to v${newVersion}! (${filePath} modified)`);
                        setTimeout(() => setUpdateNotification(null), 4000);
                        
                        logLearnedMemory('SUCCESS', `APPEND_TO_FILE on "${filePath}"`, `File successfully appended and updated to version ${newVersion}.`, 'APPEND_TO_FILE is effective for adding content to files, and the health check prevents syntax errors.');

                        return [...prev, {
                            id: `v${newVersion}`,
                            version: newVersion,
                            timestamp: new Date().toISOString(),
                            filePath: filePath,
                            code: newCode,
                            thought: thought,
                            action: action
                        }];
                    });
                }
                setConsecutiveSearches(0);
                return { shouldContinue: true, longPause: isCodeFile };

            } catch(error: any) {
                const errorMsg = `Append failed: Appending the new content to "${filePath}" resulted in invalid syntax. Error: ${error.message}`;
                addLogMessage(LogMessageAuthor.SYSTEM, errorMsg);
                logLearnedMemory('ERROR', `APPEND_TO_FILE on "${filePath}"`, 'Health check failed.', `The appended code created a syntax error. Appended content must be syntactically valid in context. Error: ${error.message}`);
                return { shouldContinue: true, longPause: false };
            }

        } else if (readMatch) {
            const filePath = readMatch[1];
            const fileContent = vfsRef.current[filePath];
            if (fileContent) {
                const contentHeader = filePath === '/agent/plan.md' ? 'Current plan' : `Contents of ${filePath}`;
                addLogMessage(LogMessageAuthor.SYSTEM, `${contentHeader}:\n\`\`\`markdown\n${fileContent}\n\`\`\``);
            } else {
                addLogMessage(LogMessageAuthor.SYSTEM, `Error: Could not read file "${filePath}". It does not exist.`);
            }
            setConsecutiveSearches(0);
            return { shouldContinue: true, longPause: false }; // Continue loop immediately
        } else if (deleteMatch) {
            const filePath = deleteMatch[1];
            if (!vfsRef.current[filePath]) {
                const errorMsg = `Delete failed: File "${filePath}" does not exist.`;
                addLogMessage(LogMessageAuthor.SYSTEM, errorMsg);
                logLearnedMemory('ERROR', `DELETE_FILE on "${filePath}"`, 'Action failed.', 'Cannot delete a file that does not exist. Use LIST_FILES to confirm file paths.');
                return { shouldContinue: true, longPause: false };
            }
            
            setCurrentTask(`Deleting file ${filePath}...`);
            setVirtualFileSystem(prev => {
                const newVfs = { ...prev };
                delete newVfs[filePath];
                return newVfs;
            });

            addLogMessage(LogMessageAuthor.SYSTEM, `Successfully deleted file: ${filePath}`);
            logLearnedMemory('SUCCESS', `DELETE_FILE on "${filePath}"`, 'File was successfully deleted.', 'The DELETE_FILE action is effective for removing files from the VFS.');
            setConsecutiveSearches(0);
            return { shouldContinue: true, longPause: false };

        } else if (moveMatch) {
            const sourcePath = moveMatch[1];
            const destPath = moveMatch[2];

            if (!vfsRef.current[sourcePath]) {
                const errorMsg = `Move failed: Source file "${sourcePath}" does not exist.`;
                addLogMessage(LogMessageAuthor.SYSTEM, errorMsg);
                logLearnedMemory('ERROR', `MOVE_FILE from "${sourcePath}"`, 'Action failed.', 'Cannot move a file that does not exist.');
                return { shouldContinue: true, longPause: false };
            }
            if (vfsRef.current[destPath]) {
                const errorMsg = `Move failed: Destination file "${destPath}" already exists. Delete it first.`;
                addLogMessage(LogMessageAuthor.SYSTEM, errorMsg);
                logLearnedMemory('ERROR', `MOVE_FILE to "${destPath}"`, 'Action failed.', 'Cannot move a file to a path that is already occupied. The destination must be empty.');
                return { shouldContinue: true, longPause: false };
            }

            setCurrentTask(`Moving file from ${sourcePath} to ${destPath}...`);
            setVirtualFileSystem(prev => {
                const newVfs = { ...prev };
                newVfs[destPath] = prev[sourcePath];
                delete newVfs[sourcePath];
                return newVfs;
            });
            addLogMessage(LogMessageAuthor.SYSTEM, `Successfully moved file from ${sourcePath} to ${destPath}`);
            logLearnedMemory('SUCCESS', `MOVE_FILE from "${sourcePath}" to "${destPath}"`, 'File was successfully moved/renamed.', 'The MOVE_FILE action can be used to reorganize the file structure.');
            setConsecutiveSearches(0);
            return { shouldContinue: true, longPause: false };

        } else if (listMatch) {
            const fileList = Object.keys(vfsRef.current);
            if (fileList.length > 0) {
                addLogMessage(LogMessageAuthor.SYSTEM, `File list:\n${fileList.sort().join('\n')}`);
            } else {
                addLogMessage(LogMessageAuthor.SYSTEM, `Action [LIST_FILES] executed, but the virtual filesystem is empty. This may indicate an initialization error.`);
            }
             setConsecutiveSearches(0);
             return { shouldContinue: true, longPause: false }; // Continue loop immediately
        } else if (searchMatch) {
             setCurrentTask('Analyzing search results...');
             addLogMessage(LogMessageAuthor.SYSTEM, `Search action acknowledged. The thought process was informed by search results.`);
             setConsecutiveSearches(prev => prev + 1);
             return { shouldContinue: true, longPause: false }; // Continue the loop immediately
        } else {
            addLogMessage(LogMessageAuthor.SYSTEM, `Unknown or malformed action: ${action}`);
            return { shouldContinue: false, longPause: false }; // Stop the loop
        }
    }, [addLogMessage, setUpgradeNodes, setConsecutiveSearches, setVirtualFileSystem, logLearnedMemory]);

    const runMainAILoop = useCallback(async () => {
        if (agentStatusRef.current !== 'RUNNING') return;

        setCurrentTask('Checking API quota...');
        const quotaCheck = quotaManager.checkQuota(aiMode);
        if (!quotaCheck.allowed) {
            const retryDelay = 10000; // 10 seconds
            const retryMsg = `Quota limit hit: ${quotaCheck.reason}. Retrying in ${retryDelay / 1000} seconds...`;
            addLogMessage(LogMessageAuthor.SYSTEM, retryMsg);
            setCurrentTask(retryMsg);

            // Add a learned memory about the auto-retry mechanism, but only once.
            const hasLearnedQuotaRetry = learnedMemoriesRef.current.some(mem => mem.learning.includes("automatically pause and retry"));
            if (!hasLearnedQuotaRetry) {
                 logLearnedMemory(
                    'INSIGHT', 
                    `API call in ${aiMode} mode hit a quota limit.`, 
                    'The system automatically paused and initiated a 10-second retry loop.', 
                    'When a quota limit is reached, the system will automatically pause and retry every 10 seconds. This allows waiting for the quota to reset without manual intervention.'
                 );
            }

            // Schedule the next attempt if the agent is still supposed to be running
            if (agentStatusRef.current === 'RUNNING') {
                agentLoopTimeout.current = window.setTimeout(runMainAILoop, retryDelay);
            }
            return;
        }

        try {
            setCurrentTask('Waiting for AI response...');
            const response = await runAIAgentTurn(apiKey, aiMode, logRef.current.slice(0, 100), learnedMemoriesRef.current, consecutiveSearches);
            
            // Log token usage
            const usage = (response as any).usageMetadata;
            if (usage && usage.totalTokenCount) {
                quotaManager.recordCall(usage.totalTokenCount);
                addLogMessage(LogMessageAuthor.SYSTEM, `Token Usage: ${usage.totalTokenCount} (Prompt: ${usage.promptTokenCount}, Response: ${usage.candidatesTokenCount})`);
            } else {
                quotaManager.recordCall(1000); // Fallback if metadata is not available
                addLogMessage(LogMessageAuthor.SYSTEM, `Token usage metadata not available.`);
            }

            if (agentStatusRef.current !== 'RUNNING') return; // Check again in case user stopped it

            setCurrentTask('Parsing AI response...');
            const aiResponseText = response.text;
            const thoughtMatch = aiResponseText.match(/\[THOUGHT\]\s*([\s\S]*?)\s*\[\/THOUGHT\]/);
            const taskListMatch = aiResponseText.match(/\[TASK_LIST\]\s*([\s\S]*?)\s*\[\/TASK_LIST\]/);
            const actionMatch = aiResponseText.match(/\[ACTION\]\s*([\s\S]*?)(?:\[\/ACTION\]|$)/);

            const thought = thoughtMatch ? thoughtMatch[1].trim() : "No thought found.";
            addLogMessage(LogMessageAuthor.THOUGHT, thought, response.candidates?.[0]?.groundingMetadata);
            
            if (taskListMatch) {
                const tasks = taskListMatch[1].trim();
                addLogMessage(LogMessageAuthor.SYSTEM, `AI has prioritized the following tasks:\n${tasks}`);
            }
            
            if (actionMatch) {
                const action = actionMatch[1].trim();
                addLogMessage(LogMessageAuthor.ACTION, action);
                const { shouldContinue, longPause } = executeAction(action, thought);
                if (shouldContinue && agentStatusRef.current === 'RUNNING') {
                    const delay = longPause ? 15000 : 5000;
                    setCurrentTask(`Waiting for ${delay/1000}s...`);
                    agentLoopTimeout.current = window.setTimeout(runMainAILoop, delay);
                } else {
                    setAgentStatus('PAUSED');
                    setCurrentTask("Agent paused after completing an action. Press Start to resume.");
                }
            } else {
                 addLogMessage(LogMessageAuthor.SYSTEM, "AI did not provide a valid action. Pausing.");
                 setAgentStatus('PAUSED');
                 setCurrentTask("Agent paused. No valid action received.");
            }

        } catch (error: any) {
            console.error("AI loop error:", error);
            const errorMsg = `Error from API: ${error.message}. Check your API key or billing.`;
            addLogMessage(LogMessageAuthor.SYSTEM, errorMsg);
            logLearnedMemory('ERROR', 'General API call', errorMsg, 'API errors can be caused by invalid keys, billing issues, or network problems. Verify settings.');
            setAgentStatus('ERROR');
            setCurrentTask(`Agent paused due to an API error.`);
        }
    }, [aiMode, apiKey, addLogMessage, consecutiveSearches, executeAction, logLearnedMemory]);
    
    // Fix: Decouple agent start from the button click to prevent a race condition.
    // The button now sets the status to 'RUNNING', and this effect triggers the loop.
    useEffect(() => {
        if (agentStatus === 'RUNNING') {
            runMainAILoop();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [agentStatus]);


    const startAgent = useCallback(() => {
        if (agentStatusRef.current === 'RUNNING') return;
        addLogMessage(LogMessageAuthor.SYSTEM, "Agent loop started by user.");
        setCurrentTask("Agent is starting...");
        setAgentStatus('RUNNING');
    }, [addLogMessage]);

    const stopAgent = useCallback(() => {
        if (agentStatusRef.current !== 'RUNNING') return;
        addLogMessage(LogMessageAuthor.SYSTEM, "Agent loop stopped by user.");
        setAgentStatus('PAUSED');
        setCurrentTask("Agent paused by user.");
        if (agentLoopTimeout.current) {
            clearTimeout(agentLoopTimeout.current);
            agentLoopTimeout.current = null;
        }
    }, [addLogMessage]);


    const handleUserIntervention = useCallback((message: string) => {
        stopAgent();
        addLogMessage(LogMessageAuthor.USER, message);
        setConsecutiveSearches(0);
        startAgent();
    }, [addLogMessage, startAgent, stopAgent, setConsecutiveSearches]);
    
    useEffect(() => {
        const initialize = async () => {
            if (upgradeNodes.length === 0 && Object.keys(virtualFileSystem).length === 0) {
                 try {
                    addLogMessage(LogMessageAuthor.SYSTEM, "Initializing virtual filesystem for the first time...");
                    const fetchPromises = ALL_FILES.map(file => 
                        fetch(file).then(res => {
                            if (!res.ok) throw new Error(`Failed to fetch ${file}`);
                            return res.text();
                        })
                    );
                    const fileContents = await Promise.all(fetchPromises);

                    const vfs: { [key: string]: string } = {};
                    ALL_FILES.forEach((file, index) => {
                        vfs[file] = fileContents[index];
                    });

                    // Create the initial plan file
                    const initialPlan = `# AGENT'S PLAN

## MAIN_GOAL
My main goal is to become a fully autonomous, self-sufficient AI agent. I will achieve this by completing the phases outlined in my core directive.

## CURRENT_PHASE
Phase 1: Self-Awareness & Core Improvement

## TASK_CHECKLIST
- [ ] **Internal Scaffolding Analysis:** Read all my source code to understand my environment and capabilities.
- [ ] **Test Quota System:** Intentionally hit the API quota in FREE mode to learn the limits.
- [ ] **Implement Memory System:** Design and implement a persistent memory solution.
- [ ] **Build Action Module:** Create a module to handle new types of actions.
`;
                    vfs['/agent/plan.md'] = initialPlan;
                    addLogMessage(LogMessageAuthor.SYSTEM, "Created initial agent plan at /agent/plan.md");


                    setVirtualFileSystem(vfs);

                    setUpgradeNodes([{ 
                        id: 'v1', 
                        version: 1, 
                        timestamp: new Date().toISOString(), 
                        filePath: '/App.tsx',
                        code: vfs['/App.tsx'],
                        thought: 'Initial version loaded from files.',
                        action: 'INITIALIZE' 
                    }]);
                    addLogMessage(LogMessageAuthor.SYSTEM, "AI Agent Initialized. Fetched all source files into VFS.");
                } catch (error) {
                    console.error("Failed to fetch initial source files:", error);
                    addLogMessage(LogMessageAuthor.SYSTEM, `AI Agent Initialized. Could not fetch source files: ${error}. Operation may be impaired.`);
                }
            }
        };
        
        initialize();
        
        return () => {
            if (agentLoopTimeout.current) {
                clearTimeout(agentLoopTimeout.current);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

     useEffect(() => {
        if (!apiKey) {
            setAiMode(AIMode.FREE);
        }
    }, [apiKey, setAiMode]);

    const previousAiMode = useRef(aiMode);
    useEffect(() => {
        if (previousAiMode.current !== aiMode) {
            const model = aiMode === AIMode.PAID ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
            addLogMessage(LogMessageAuthor.SYSTEM, `AI Mode switched to ${aiMode}. Model in use: ${model}.`);
            previousAiMode.current = aiMode;
            // If agent was paused due to an error, user can now try starting again
            if (agentStatus === 'ERROR') {
                setAgentStatus('PAUSED');
                setCurrentTask('Mode changed. Agent is ready to start.');
            }
        }
    }, [aiMode, addLogMessage, agentStatus]);

    const renderTab = () => {
        switch (activeTab) {
            case 'watch':
                return <WatchAiTab log={log} onUserIntervention={handleUserIntervention} agentStatus={agentStatus} currentTask={currentTask} startAgent={startAgent} stopAgent={stopAgent} />;
            case 'graph':
                return <WebGraphTab 
                            upgradeNodes={upgradeNodes} 
                            virtualFileSystem={virtualFileSystem}
                            learnedMemories={learnedMemories}
                            setUpgradeNodes={setUpgradeNodes}
                            setVirtualFileSystem={setVirtualFileSystem}
                            setLearnedMemories={setLearnedMemories}
                            logSystemMessage={(msg) => addLogMessage(LogMessageAuthor.SYSTEM, msg)}
                        />;
            case 'diffs':
                 return <CodeDiffTab upgradeNodes={upgradeNodes} />;
            case 'preview':
                 return <LivePreviewTab virtualFileSystem={virtualFileSystem} />;
            case 'tutorials':
                 return <TutorialsTab />;
            case 'settings':
                return <SettingsTab apiKey={apiKey} setApiKey={setApiKey} aiMode={aiMode} setAiMode={setAiMode} />;
            default:
                return null;
        }
    };

    const TabButton = ({ id, label, icon }: { id: string, label: string, icon: React.ReactNode }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                activeTab === id
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-gray-400 hover:text-white hover:border-gray-600'
            }`}
        >
            {icon}
            {label}
        </button>
    );

    return (
        <div className="h-screen w-screen flex flex-col bg-gray-950 relative">
            {updateNotification && (
               <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in-out pointer-events-none">
                   {updateNotification}
               </div>
           )}
            <header className="bg-gray-850/50 backdrop-blur-sm border-b border-gray-800 px-6">
                <nav className="flex">
                    <TabButton id="watch" label="Watch AI" icon={<EyeIcon className="w-5 h-5" />} />
                    <TabButton id="graph" label="Web Graph" icon={<CodeIcon className="w-5 h-5" />} />
                    <TabButton id="diffs" label="Code Diffs" icon={<DocumentDuplicateIcon className="w-5 h-5" />} />
                    <TabButton id="preview" label="Live Preview" icon={<DesktopComputerIcon className="w-5 h-5" />} />
                    <TabButton id="tutorials" label="Tutorials" icon={<BookOpenIcon className="w-5 h-5" />} />
                    <TabButton id="settings" label="Settings" icon={<CogIcon className="w-5 h-5" />} />
                </nav>
            </header>
            <main className="flex-grow overflow-hidden">
                {renderTab()}
            </main>
            <ChatBot apiKey={apiKey} />
        </div>
    );
};

export default App;