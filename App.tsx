import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import useLocalStorage from './hooks/useLocalStorage';
import { LogMessage, LogMessageAuthor, AIMode, UpgradeNode, AgentStatus, LearnedMemory, LearnedMemoryType, ProposedChange, CriticFeedback, CriticRole } from './types';
import { runProposerAgent, runPlannerAgent, runCriticAgent, runSynthesizerAgent, runResearcherAgent, runNudgerAgent } from './services/geminiService';
import { quotaManager } from './services/quotaManager';
import WatchAiTab from './components/WatchAiTab';
import WebGraphTab from './components/WebGraphTab';
import SettingsTab from './components/SettingsTab';
import ChatBot from './components/ChatBot';
import CodeDiffTab from './components/CodeDiffTab';
import LivePreviewTab from './components/LivePreviewTab';
import TutorialsTab from './components/TutorialsTab';
import MultiAgentTab from './components/MultiAgentTab';
import AgentStatusLed from './components/AgentStatusLed';
import HeaderRateLimitTracker from './components/HeaderRateLimitTracker';
import { EyeIcon, CodeIcon, CogIcon, DocumentDuplicateIcon, DesktopComputerIcon, BookOpenIcon, UsersIcon } from './components/icons';

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
    '/components/MultiAgentTab.tsx',
    '/components/AgentStatusLed.tsx',
    '/components/HeaderRateLimitTracker.tsx',
    '/components/RateLimitDisplay.tsx',
    '/constants.ts',
    '/hooks/useLocalStorage.ts',
    '/index.html',
    '/index.tsx',
    '/preview.html',
    '/services/geminiService.ts',
    '/services/quotaManager.ts',
    '/types.ts',
    '/prompts.ts',
    '/globalMemories.json',
    '/upgrades.md'
];

const App: React.FC = () => {
    const [activeTab, setActiveTab] = useLocalStorage('active-tab', 'watch');
    const [apiKey, setApiKey] = useLocalStorage<string | null>('gemini-api-key', null);
    const [aiMode, setAiMode] = useLocalStorage<AIMode>('ai-mode', AIMode.FREE);
    const [log, setLog] = useLocalStorage<LogMessage[]>('ai-log', []);
    const [upgradeNodes, setUpgradeNodes] = useLocalStorage<UpgradeNode[]>('ai-upgrade-nodes', []);
    const [learnedMemories, setLearnedMemories] = useLocalStorage<LearnedMemory[]>('ai-learned-memories', []);
    const [agentStatus, setAgentStatus] = useState<AgentStatus>('IDLE');
    const [currentTask, setCurrentTask] = useState('Agent is idle. Press Resume to begin.');
    const [currentTasks, setCurrentTasks] = useLocalStorage<string[]>('ai-task-list', []);
    const [consecutiveSearches, setConsecutiveSearches] = useLocalStorage<number>('ai-consecutive-searches', 0);
    const [virtualFileSystem, setVirtualFileSystem] = useLocalStorage<{ [key: string]: string }>('ai-vfs', {});
    const [updateNotification, setUpdateNotification] = useState<string | null>(null);
    const [isAutonomous, setIsAutonomous] = useLocalStorage<boolean>('ai-is-autonomous', false);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [currentFocusFile, setCurrentFocusFile] = useState<string | null>(null);
    const [fileEditCounts, setFileEditCounts] = useLocalStorage<{ [key: string]: number }>('ai-file-edits', {});
    const [deepLinkNodeId, setDeepLinkNodeId] = useState<string | null>(null);
    const [previewNeedsRefresh, setPreviewNeedsRefresh] = useState(false);
    
    // MAS State
    const [proposedChange, setProposedChange] = useLocalStorage<ProposedChange | null>('ai-mas-proposal', null);
    const [criticFeedbacks, setCriticFeedbacks] = useLocalStorage<CriticFeedback[]>('ai-mas-criticisms', []);
    const [synthesizerRejection, setSynthesizerRejection] = useLocalStorage<string | null>('ai-mas-rejection', null);
    const [isCriticEnabled, setIsCriticEnabled] = useLocalStorage('ai-mas-critic-enabled', true);
    const [isResearcherEnabled, setIsResearcherEnabled] = useLocalStorage('ai-mas-researcher-enabled', true);
    const [isNudgerEnabled, setIsNudgerEnabled] = useLocalStorage('ai-mas-nudger-enabled', true);
    const [mainLoopCycle, setMainLoopCycle] = useLocalStorage('ai-main-loop-cycle', 0);
    const [agentApiKeys, setAgentApiKeys] = useLocalStorage<{ [key: string]: string }>('ai-mas-apikeys', {});

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

    const executeAction = useCallback(async (action: string, thought: string): Promise<{shouldContinue: boolean, longPause: boolean}> => {
        const rewriteMatch = action.match(/^REWRITE_CODE\s+"([^"]+)"\s*```(?:typescript|javascript|markdown)?\n([\sS]*?)\n```/);
        const saveMatch = action.match(/^SAVE_FILE\s+"([^"]+)"\s*```(?:typescript|javascript|markdown)?\n([\sS]*?)\n```/);
        const appendMatch = action.match(/^APPEND_TO_FILE\s+"([^"]+)"\s*```\n([\sS]*?)\n```/);
        const readMatch = action.match(/^READ_FILE\s+"([^"]+)"/);
        const deleteMatch = action.match(/^DELETE_FILE\s+"([^"]+)"/);
        const moveMatch = action.match(/^MOVE_FILE\s+"([^"]+)"\s+"([^"]+)"/);
        const readUrlMatch = action.match(/^READ_URL_CONTENT\s+"([^"]+)"/);
        const healthCheckMatch = action.startsWith('CHECK_PREVIEW_HEALTH');
        const listMatch = action.startsWith('LIST_FILES');
        const searchMatch = action.startsWith('GOOGLE_SEARCH');
        const suggestTaskMatch = action.match(/^SUGGEST_TASK\s+"([^"]+)"/);

        // Any action other than READ_FILE should clear the focus
        if (!readMatch) {
            setCurrentFocusFile(null);
        }

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
                setFileEditCounts(prev => ({...prev, [filePath]: (prev[filePath] || 0) + 1 }));

                // Only create upgrade nodes for actual code changes
                if(isCodeFile) {
                    setPreviewNeedsRefresh(true);
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
                addLogMessage(LogMessageAuthor.SYSTEM, `CRITICAL: Your last code action failed the syntax health check. You MUST fix this error before any other action. Error: ${error.message}`);
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
                setFileEditCounts(prev => ({...prev, [filePath]: 1 }));
                addLogMessage(LogMessageAuthor.SYSTEM, `Successfully created file: ${filePath}`);
                if(isCodeFile) setPreviewNeedsRefresh(true);

                logLearnedMemory('SUCCESS', `SAVE_FILE on "${filePath}"`, 'New file successfully created.', 'The SAVE_FILE action is effective for creating new, syntactically valid files in the VFS.');

                setConsecutiveSearches(0);
                return { shouldContinue: true, longPause: false };

            } catch (error: any) {
                const errorMsg = `Save failed: Generated code for "${filePath}" is syntactically invalid and was rejected. Error: ${error.message}`;
                addLogMessage(LogMessageAuthor.SYSTEM, errorMsg);
                addLogMessage(LogMessageAuthor.SYSTEM, `CRITICAL: Your last code action failed the syntax health check for the new file. You MUST fix this error before any other action. Error: ${error.message}`);
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
                setFileEditCounts(prev => ({...prev, [filePath]: (prev[filePath] || 0) + 1 }));

                if (isCodeFile) {
                    setPreviewNeedsRefresh(true);
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
                addLogMessage(LogMessageAuthor.SYSTEM, `CRITICAL: Your last code action failed the syntax health check after appending. You MUST fix this error before any other action. Error: ${error.message}`);
                logLearnedMemory('ERROR', `APPEND_TO_FILE on "${filePath}"`, 'Health check failed.', `The appended code created a syntax error. Appended content must be syntactically valid in context. Error: ${error.message}`);
                return { shouldContinue: true, longPause: false };
            }

        } else if (readMatch) {
            const filePath = readMatch[1];
            setCurrentFocusFile(filePath);
            const fileContent = vfsRef.current[filePath];
            if (fileContent) {
                const contentHeader = filePath === '/agent/plan.md' ? 'Current plan' : `Contents of ${filePath}`;
                addLogMessage(LogMessageAuthor.SYSTEM, `${contentHeader}:\n\`\`\`markdown\n${fileContent}\n\`\`\``);
            } else {
                addLogMessage(LogMessageAuthor.SYSTEM, `Error: Could not read file "${filePath}". It does not exist.`);
            }
            setConsecutiveSearches(0);
            return { shouldContinue: true, longPause: false };
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
             return { shouldContinue: true, longPause: false };
        } else if (searchMatch) {
             setCurrentTask('Analyzing search results...');
             addLogMessage(LogMessageAuthor.SYSTEM, `Search action acknowledged. The thought process was informed by search results.`);
             setConsecutiveSearches(prev => prev + 1);
             return { shouldContinue: true, longPause: false };
        } else if (readUrlMatch) {
            const urlToFetch = readUrlMatch[1];
            setCurrentTask(`Reading content from ${urlToFetch}...`);
            try {
                const proxyUrl = `http://localhost:3001/proxy?url=${encodeURIComponent(urlToFetch)}`;
                const response = await fetch(proxyUrl);
                if (!response.ok) {
                    throw new Error(`Proxy server returned status ${response.status}`);
                }
                const content = await response.text();
                // Sanitize and truncate content to avoid huge log messages
                const summarizedContent = content.substring(0, 3000).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                addLogMessage(LogMessageAuthor.SYSTEM, `Successfully read content from URL ${urlToFetch}:\n\`\`\`\n${summarizedContent}...\n\`\`\``);
                logLearnedMemory('SUCCESS', `READ_URL_CONTENT on "${urlToFetch}"`, 'Successfully fetched and summarized URL content via local proxy.', 'The local proxy server enables web access for research.');
                return { shouldContinue: true, longPause: false };
            } catch (error: any) {
                const errorMsg = `Action [READ_URL_CONTENT] failed. Could not fetch URL via proxy. Is the proxy server running? Error: ${error.message}`;
                addLogMessage(LogMessageAuthor.SYSTEM, errorMsg);
                logLearnedMemory('ERROR', `READ_URL_CONTENT on "${urlToFetch}"`, 'Action failed.', 'The proxy server might be down or the URL may be invalid. Ensure the proxy is running via `npm start` in the `proxy-server` directory.');
                return { shouldContinue: true, longPause: false };
            }
        } else if (healthCheckMatch) {
            if (previewError) {
                addLogMessage(LogMessageAuthor.SYSTEM, `Preview health check: FAILED. Error: ${previewError}`);
                logLearnedMemory('ERROR', 'CHECK_PREVIEW_HEALTH', `Preview crashed with error: ${previewError}`, 'The last code change was invalid and broke the application. I must fix the file that caused this error.');
                setPreviewError(null); // Reset for next check
            } else {
                addLogMessage(LogMessageAuthor.SYSTEM, 'Preview health check: OK.');
                logLearnedMemory('SUCCESS', 'CHECK_PREVIEW_HEALTH', 'Preview is running correctly.', 'The current codebase is stable and does not crash the preview environment.');
            }
            return { shouldContinue: true, longPause: false };
        } else if (suggestTaskMatch) {
            const task = suggestTaskMatch[1];
            addLogMessage(LogMessageAuthor.SYSTEM, `Nudger suggested a new task: "${task}". Adding to plan.`);
            setVirtualFileSystem(prev => {
                const newVfs = { ...prev };
                const plan = newVfs['/agent/plan.md'] || '# AGENT\'S PLAN\n\n';
                newVfs['/agent/plan.md'] = plan + `\n- [ ] **[NUDGE]** ${task}`;
                return newVfs;
            });
            return { shouldContinue: true, longPause: false };
        } else {
            addLogMessage(LogMessageAuthor.SYSTEM, `Unknown or malformed action: ${action}`);
            return { shouldContinue: false, longPause: false };
        }
    }, [addLogMessage, setUpgradeNodes, setConsecutiveSearches, setVirtualFileSystem, logLearnedMemory, previewError, setFileEditCounts]);

    const runMainAILoop = useCallback(async () => {
        if (['IDLE', 'PAUSED', 'ERROR'].includes(agentStatusRef.current)) return;

        // No quota check here; it's handled inside callGenerativeAI

        try {
            switch (agentStatusRef.current) {
                case 'PLANNING': {
                    if (isNudgerEnabled && mainLoopCycle > 0 && mainLoopCycle % 5 === 0) {
                        setCurrentTask('Nudger: Thinking of a creative suggestion...');
                        const currentPlan = vfsRef.current['/agent/plan.md'] || "";
                        const nudgerApiKey = agentApiKeys['NUDGER'] || null;
                        const response = await runNudgerAgent(nudgerApiKey, apiKey, aiMode, currentPlan);
                        const text = response.text;
                        const thoughtMatch = text.match(/\[THOUGHT\]\s*([\s\S]*?)\s*\[\/THOUGHT\]/);
                        const actionMatch = text.match(/\[ACTION\]\s*([\s\S]*?)(?:\[\/ACTION\]|$)/);
                        addLogMessage(LogMessageAuthor.NUDGER, thoughtMatch ? thoughtMatch[1].trim() : "No thought found.");
                        if (actionMatch) {
                            await executeAction(actionMatch[1].trim(), thoughtMatch ? thoughtMatch[1].trim() : "");
                        }
                    }

                    setCurrentTask('Planner: Analyzing goals and creating a new plan...');
                    const coreDirective = vfsRef.current['/upgrades.md'];
                    const currentPlan = vfsRef.current['/agent/plan.md'] || "No plan file found.";
                    const plannerApiKey = agentApiKeys['PLANNER'] || null;
                    
                    const response = await runPlannerAgent(plannerApiKey, apiKey, aiMode, logRef.current.slice(0, 50), learnedMemoriesRef.current, currentPlan, coreDirective);
                    
                    const text = response.text;
                    const thoughtMatch = text.match(/\[THOUGHT\]\s*([\s\S]*?)\s*\[\/THOUGHT\]/);
                    const actionMatch = text.match(/\[ACTION\]\s*([\s\S]*?)(?:\[\/ACTION\]|$)/);

                    addLogMessage(LogMessageAuthor.PLANNER, thoughtMatch ? thoughtMatch[1].trim() : "No thought found.");
                    
                    if (actionMatch) {
                        const action = actionMatch[1].trim();
                        await executeAction(action, thoughtMatch ? thoughtMatch[1].trim() : "");
                        
                        const updatedPlan = vfsRef.current['/agent/plan.md'] || "";
                        const researchTask = updatedPlan.split('\n').find(line => line.includes('[NEEDS_RESEARCH]') && !line.includes('[x]'));
                        
                        if (isResearcherEnabled && researchTask) {
                            setAgentStatus('RESEARCHING');
                        } else {
                            setAgentStatus('PROPOSING');
                        }
                    } else {
                        addLogMessage(LogMessageAuthor.SYSTEM, "Planner did not provide a valid action. Pausing.");
                        setAgentStatus('PAUSED');
                    }
                    break;
                }
                
                case 'RESEARCHING': {
                    const currentPlan = vfsRef.current['/agent/plan.md'] || "";
                    const researchTask = currentPlan.split('\n').find(line => line.includes('[NEEDS_RESEARCH]') && !line.includes('[x]'));
                    if (!researchTask) {
                         addLogMessage(LogMessageAuthor.SYSTEM, "No research task found. Skipping to proposing.");
                         setAgentStatus('PROPOSING');
                         break;
                    }
                    
                    setCurrentTask(`Researcher: Researching "${researchTask.substring(0, 50)}..."`);
                    const researcherApiKey = agentApiKeys['RESEARCHER'] || null;
                    const response = await runResearcherAgent(researcherApiKey, apiKey, aiMode, researchTask, logRef.current.slice(0, 20));
                    const text = response.text;
                    const thoughtMatch = text.match(/\[THOUGHT\]\s*([\s\S]*?)\s*\[\/THOUGHT\]/);
                    const actionMatch = text.match(/\[ACTION\]\s*([\s\S]*?)(?:\[\/ACTION\]|$)/);
                    addLogMessage(LogMessageAuthor.RESEARCHER, thoughtMatch ? thoughtMatch[1].trim() : "No thought found.", response.candidates?.[0]?.groundingMetadata);

                    const action = actionMatch ? actionMatch[1].trim() : 'TASK_COMPLETED';
                    if (action === 'TASK_COMPLETED') {
                        addLogMessage(LogMessageAuthor.SYSTEM, "Research complete. Moving to proposal phase.");
                        setAgentStatus('PROPOSING');
                    } else {
                        addLogMessage(LogMessageAuthor.ACTION, action);
                        await executeAction(action, thoughtMatch ? thoughtMatch[1].trim() : "");
                        setAgentStatus('RESEARCHING'); // Loop until research is done
                    }
                    break;
                }

                case 'PROPOSING': {
                    setCurrentTask('Proposer: Developing a code change for the current task...');
                    const currentPlan = vfsRef.current['/agent/plan.md'] || "";
                    const proposerApiKey = agentApiKeys['PROPOSER'] || null;
                    
                    const response = await runProposerAgent(proposerApiKey, apiKey, aiMode, logRef.current.slice(0, 100), learnedMemoriesRef.current, consecutiveSearches, currentPlan, synthesizerRejection);
                    
                    setSynthesizerRejection(null); // Clear rejection feedback after using it
                    const text = response.text;
                    const thoughtMatch = text.match(/\[THOUGHT\]\s*([\s\S]*?)\s*\[\/THOUGHT\]/);
                    const actionMatch = text.match(/\[ACTION\]\s*([\s\S]*?)(?:\[\/ACTION\]|$)/);

                    addLogMessage(LogMessageAuthor.PROPOSER, thoughtMatch ? thoughtMatch[1].trim() : "No thought found.", response.candidates?.[0]?.groundingMetadata);

                    if (actionMatch) {
                        const action = actionMatch[1].trim();
                         // Check for non-code actions that can be executed immediately
                        if (!action.startsWith('REWRITE_CODE') && !action.startsWith('SAVE_FILE') && !action.startsWith('APPEND_TO_FILE')) {
                             addLogMessage(LogMessageAuthor.ACTION, action);
                             const { shouldContinue } = await executeAction(action, thoughtMatch ? thoughtMatch[1].trim() : "");
                             if (shouldContinue) setAgentStatus('PROPOSING'); // Loop back to propose next step
                             else setAgentStatus('PAUSED');
                        } else {
                            // It's a code change, so save it for review
                            const rewriteMatch = action.match(/^(REWRITE_CODE|SAVE_FILE|APPEND_TO_FILE)\s+"([^"]+)"\s*```(?:typescript|javascript|markdown)?\n([\s\S]*?)\n```/);
                            if(rewriteMatch){
                                setProposedChange({
                                    thought: thoughtMatch ? thoughtMatch[1].trim() : "",
                                    action: action,
                                    filePath: rewriteMatch[2],
                                    newCode: rewriteMatch[3].trim()
                                });
                                setAgentStatus(isCriticEnabled ? 'CRITICIZING' : 'EXECUTING');
                            } else {
                                addLogMessage(LogMessageAuthor.SYSTEM, "Proposer submitted a malformed code action. Pausing.");
                                setAgentStatus('PAUSED');
                            }
                        }
                    } else {
                        addLogMessage(LogMessageAuthor.SYSTEM, "Proposer did not provide a valid action. Pausing.");
                        setAgentStatus('PAUSED');
                    }
                    break;
                }

                case 'CRITICIZING': {
                    if (!proposedChange) {
                        addLogMessage(LogMessageAuthor.SYSTEM, "Criticizing phase entered without a proposal. Pausing.");
                        setAgentStatus('PAUSED');
                        return;
                    }
                    setCurrentTask('Critic Team: Reviewing proposed code change...');
                    const criticApiKey = agentApiKeys['CRITIC'] || null;
                    const roles: CriticRole[] = ['Security', 'Efficiency', 'Clarity'];
                    const criticismPromises = roles.map(role => runCriticAgent(criticApiKey, apiKey, aiMode, role, proposedChange.action));

                    const results = await Promise.all(criticismPromises);
                    
                    const feedbacks: CriticFeedback[] = results.map((res, index) => {
                        const text = res.text;
                        const scoreMatch = text.match(/\[SCORE\]\s*(\d+)\s*\[\/SCORE\]/);
                        const feedbackMatch = text.match(/\[FEEDBACK\]\s*([\s\S]*?)\s*\[\/FEEDBACK\]/);
                        const feedback: CriticFeedback = {
                            role: roles[index],
                            score: scoreMatch ? parseInt(scoreMatch[1], 10) : 0,
                            feedback: feedbackMatch ? feedbackMatch[1].trim() : "No feedback provided."
                        };
                        const author = `CRITIC_${roles[index].toUpperCase()}` as keyof typeof LogMessageAuthor;
                        addLogMessage(LogMessageAuthor[author], `Score: ${feedback.score}/10\n${feedback.feedback}`);
                        return feedback;
                    });
                    
                    setCriticFeedbacks(feedbacks);
                    setAgentStatus('SYNTHESIZING');
                    break;
                }

                case 'SYNTHESIZING': {
                    if (!proposedChange || criticFeedbacks.length === 0) {
                        addLogMessage(LogMessageAuthor.SYSTEM, "Synthesizing phase entered without proposal or feedback. Pausing.");
                        setAgentStatus('PAUSED');
                        return;
                    }
                    setCurrentTask('Synthesizer: Analyzing feedback and making a final decision...');
                    const synthesizerApiKey = agentApiKeys['SYNTHESIZER'] || null;
                    
                    const response = await runSynthesizerAgent(synthesizerApiKey, apiKey, aiMode, proposedChange.action, criticFeedbacks);
                    const text = response.text;
                    
                    const decisionMatch = text.match(/\[DECISION\]\s*(APPROVE|REJECT)\s*\[\/DECISION\]/);
                    const reasonMatch = text.match(/\[REASON\]\s*([\s\S]*?)\s*\[\/REASON\]/);

                    const decision = decisionMatch ? decisionMatch[1] : 'REJECT';
                    const reason = reasonMatch ? reasonMatch[1].trim() : "No reason provided.";
                    
                    addLogMessage(LogMessageAuthor.SYNTHESIZER, `Decision: ${decision}\nReason: ${reason}`);

                    if (decision === 'APPROVE') {
                        setAgentStatus('EXECUTING');
                    } else {
                        setSynthesizerRejection(reason);
                        setProposedChange(null);
                        setCriticFeedbacks([]);
                        setAgentStatus('PROPOSING'); // Loop back for another attempt
                    }
                    break;
                }
                
                case 'EXECUTING': {
                    if(!proposedChange) {
                        addLogMessage(LogMessageAuthor.SYSTEM, "Executing phase entered without a change to execute. Pausing.");
                        setAgentStatus('PAUSED');
                        return;
                    }
                    setCurrentTask('System: Executing approved code change...');
                    addLogMessage(LogMessageAuthor.ACTION, proposedChange.action);
                    await executeAction(proposedChange.action, proposedChange.thought);
                    
                    // Cleanup MAS state for next cycle
                    setProposedChange(null);
                    setCriticFeedbacks([]);
                    
                    setMainLoopCycle(prev => prev + 1);
                    setAgentStatus('PLANNING'); // Start the next cycle
                    break;
                }
            }
        } catch (error: any) {
            console.error("AI loop error:", error);
            const errorMsg = `Error from API: ${error.message}.`;
            addLogMessage(LogMessageAuthor.SYSTEM, errorMsg);
            
            if (error.message.includes('Quota')) {
                const retryDelay = 10000;
                 addLogMessage(LogMessageAuthor.SYSTEM, `Retrying in ${retryDelay / 1000} seconds...`);
                 agentLoopTimeout.current = window.setTimeout(runMainAILoop, retryDelay);
            } else {
                 logLearnedMemory('ERROR', 'General API call', errorMsg, 'API errors can be caused by invalid keys, billing issues, or network problems. Verify settings.');
                 setAgentStatus('ERROR');
                 setCurrentTask(`Agent paused due to an API error.`);
            }
        }
    }, [aiMode, apiKey, addLogMessage, consecutiveSearches, executeAction, logLearnedMemory, proposedChange, criticFeedbacks, synthesizerRejection, setSynthesizerRejection, isCriticEnabled, isNudgerEnabled, isResearcherEnabled, mainLoopCycle, setMainLoopCycle, agentApiKeys]);
    
    useEffect(() => {
        if (!['IDLE', 'PAUSED', 'ERROR'].includes(agentStatus)) {
            const delay = agentStatus === 'EXECUTING' ? 15000 : 5000;
            agentLoopTimeout.current = window.setTimeout(runMainAILoop, delay);
        }
         return () => {
            if (agentLoopTimeout.current) {
                clearTimeout(agentLoopTimeout.current);
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [agentStatus]);


    const resumeAgent = useCallback(() => {
        if (agentStatusRef.current !== 'IDLE' && agentStatusRef.current !== 'PAUSED' && agentStatusRef.current !== 'ERROR') return;
        addLogMessage(LogMessageAuthor.SYSTEM, "Agent loop started/resumed by user.");
        setCurrentTask("Agent is starting...");
        setAgentStatus('PLANNING'); // Start the MAS cycle with planning
    }, [addLogMessage]);

    const pauseAgent = useCallback(() => {
        if (['IDLE', 'PAUSED', 'ERROR'].includes(agentStatusRef.current)) return;
        addLogMessage(LogMessageAuthor.SYSTEM, "Agent loop paused by user.");
        setAgentStatus('PAUSED');
        setCurrentTask("Agent paused by user.");
        if (agentLoopTimeout.current) {
            clearTimeout(agentLoopTimeout.current);
            agentLoopTimeout.current = null;
        }
    }, [addLogMessage]);


    const handleUserIntervention = useCallback((message: string) => {
        pauseAgent();
        addLogMessage(LogMessageAuthor.USER, message);
        setConsecutiveSearches(0);
        resumeAgent();
    }, [addLogMessage, resumeAgent, pauseAgent, setConsecutiveSearches]);
    
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
        
        const handleMessage = (event: MessageEvent) => {
            if (event.data.type === 'PREVIEW_ERROR') {
                setPreviewError(event.data.error);
                addLogMessage(LogMessageAuthor.SYSTEM, `Live Preview crashed. Error: ${event.data.error}`);
            }
        };

        window.addEventListener('message', handleMessage);
        
        initialize();
        
        return () => {
            if (agentLoopTimeout.current) {
                clearTimeout(agentLoopTimeout.current);
            }
            window.removeEventListener('message', handleMessage);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

     useEffect(() => {
        if (!apiKey) {
            setAiMode(AIMode.FREE);
        }
    }, [apiKey, setAiMode]);

    useEffect(() => {
        if (isAutonomous && agentStatusRef.current === 'IDLE') {
            resumeAgent();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAutonomous]);

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
    
    const actionSuccessStats = useMemo(() => {
        const stats: { [key: string]: { success: number; error: number } } = {};
        learnedMemories.forEach(mem => {
            const actionMatch = mem.context.match(/^([A-Z_]+)/);
            if (actionMatch) {
                const action = actionMatch[1];
                if (!stats[action]) {
                    stats[action] = { success: 0, error: 0 };
                }
                if (mem.type === 'SUCCESS') stats[action].success++;
                if (mem.type === 'ERROR') stats[action].error++;
            }
        });
        return stats;
    }, [learnedMemories]);

    const renderTab = () => {
        switch (activeTab) {
            case 'watch':
                return <WatchAiTab log={log} onUserIntervention={handleUserIntervention} agentStatus={agentStatus} tasks={currentTasks} resumeAgent={resumeAgent} pauseAgent={pauseAgent} onNodeLinkClick={(nodeId) => { setActiveTab('graph'); setDeepLinkNodeId(nodeId); }} actionStats={actionSuccessStats} />;
            case 'graph':
                return <WebGraphTab 
                            upgradeNodes={upgradeNodes} 
                            virtualFileSystem={virtualFileSystem}
                            learnedMemories={learnedMemories}
                            setUpgradeNodes={setUpgradeNodes}
                            setVirtualFileSystem={setVirtualFileSystem}
                            setLearnedMemories={setLearnedMemories}
                            logSystemMessage={(msg) => addLogMessage(LogMessageAuthor.SYSTEM, msg)}
                            deepLinkNodeId={deepLinkNodeId}
                            clearDeepLink={() => setDeepLinkNodeId(null)}
                            focusFile={currentFocusFile}
                            editCounts={fileEditCounts}
                        />;
            case 'diffs':
                 return <CodeDiffTab upgradeNodes={upgradeNodes} />;
            case 'preview':
                 return <LivePreviewTab virtualFileSystem={virtualFileSystem} />;
            case 'mas':
                 return <MultiAgentTab 
                            isCriticEnabled={isCriticEnabled}
                            setIsCriticEnabled={setIsCriticEnabled}
                            isResearcherEnabled={isResearcherEnabled}
                            setIsResearcherEnabled={setIsResearcherEnabled}
                            isNudgerEnabled={isNudgerEnabled}
                            setIsNudgerEnabled={setIsNudgerEnabled}
                            agentApiKeys={agentApiKeys}
                            setAgentApiKeys={setAgentApiKeys}
                            mainApiKey={apiKey}
                        />;
            case 'tutorials':
                 return <TutorialsTab />;
            case 'settings':
                return <SettingsTab apiKey={apiKey} setApiKey={setApiKey} aiMode={aiMode} setAiMode={setAiMode} isAutonomous={isAutonomous} setIsAutonomous={setIsAutonomous} />;
            default:
                return null;
        }
    };

    const TabButton = ({ id, label, icon, needsRefresh }: { id: string, label: string, icon: React.ReactNode, needsRefresh?: boolean }) => (
        <button
            onClick={() => {
                setActiveTab(id);
                if (id === 'preview') setPreviewNeedsRefresh(false);
            }}
            className={`relative flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                activeTab === id
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-gray-400 hover:text-white hover:border-gray-600'
            }`}
        >
            {icon}
            {label}
            {needsRefresh && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
        </button>
    );
    
    const primaryTask = currentTasks[0]?.replace(/\[(High|Medium|Low)\]\s*/, '').trim() || currentTask;


    return (
        <div className="h-screen w-screen flex flex-col bg-gray-950 relative">
            {updateNotification && (
               <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in-out pointer-events-none">
                   {updateNotification}
               </div>
           )}
            <header className="bg-gray-850/50 backdrop-blur-sm border-b border-gray-800 px-6">
                 <div className="flex justify-between items-center">
                    <nav className="flex">
                        <TabButton id="watch" label="Watch AI" icon={<EyeIcon className="w-5 h-5" />} />
                        <TabButton id="graph" label="Web Graph" icon={<CodeIcon className="w-5 h-5" />} />
                        <TabButton id="diffs" label="Code Diffs" icon={<DocumentDuplicateIcon className="w-5 h-5" />} />
                         <TabButton id="mas" label="Multi-Agent" icon={<UsersIcon className="w-5 h-5" />} />
                        <TabButton id="preview" label="Live Preview" icon={<DesktopComputerIcon className="w-5 h-5" />} needsRefresh={previewNeedsRefresh} />
                        <TabButton id="tutorials" label="Tutorials" icon={<BookOpenIcon className="w-5 h-5" />} />
                        <TabButton id="settings" label="Settings" icon={<CogIcon className="w-5 h-5" />} />
                    </nav>
                     <div className="text-sm text-gray-400 hidden md:flex items-center gap-4">
                        <HeaderRateLimitTracker apiKey={apiKey} aiMode={aiMode} />
                        <AgentStatusLed currentStatus={agentStatus} />
                    </div>
                </div>
            </header>
            <main className="flex-grow overflow-hidden">
                {renderTab()}
            </main>
            <ChatBot apiKey={apiKey} />
        </div>
    );
};

export default App;