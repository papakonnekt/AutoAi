import React, { useState } from 'react';
import { XIcon, LightBulbIcon } from './icons';
import * as Prompts from '../prompts';

const AgentCard: React.FC<{
    name: string,
    color: string,
    description: string,
    children?: React.ReactNode,
    onPromptClick: () => void,
    isEnabled?: boolean,
    onToggle?: () => void,
    apiKey: string,
    onApiKeyChange: (key: string) => void
}> = ({ name, color, description, children, onPromptClick, isEnabled, onToggle, apiKey, onApiKeyChange }) => (
  <div className={`bg-gray-850 border-l-4 ${color} p-6 rounded-r-lg rounded-b-lg shadow-md`}>
    <div className="flex justify-between items-start">
        <div>
            <h3 className={`text-xl font-bold ${color.replace('border-', 'text-')}`}>{name}</h3>
            <p className="mt-2 text-gray-400">{description}</p>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0 ml-4">
             <button onClick={onPromptClick} className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 font-semibold py-1 px-3 rounded-md transition-colors">
                View Prompt
            </button>
            {onToggle && (
                <button
                    onClick={onToggle}
                    className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${
                    isEnabled ? 'bg-indigo-600' : 'bg-gray-600'
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500`}
                >
                    <span
                    className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
                        isEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                    />
                </button>
            )}
        </div>
    </div>
     <div className="mt-4">
        <label className="text-xs text-gray-400 font-semibold">Agent-Specific API Key (Optional)</label>
        <input
            type="password"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder="Defaults to main API key in Settings"
            className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
        />
    </div>
    {children}
  </div>
);

const PromptModal: React.FC<{ title: string, prompt: string, onClose: () => void }> = ({ title, prompt, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-gray-850 border border-gray-700 rounded-lg w-full max-w-4xl h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <header className="p-4 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
                <h3 className="text-lg font-bold text-white">Core Prompt: {title}</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-white">
                    <XIcon className="w-6 h-6" />
                </button>
            </header>
            <div className="flex-grow overflow-auto font-mono text-sm bg-gray-900">
                <pre className="p-4 whitespace-pre-wrap"><code>{prompt}</code></pre>
            </div>
        </div>
    </div>
);


interface MultiAgentTabProps {
    isCriticEnabled: boolean;
    setIsCriticEnabled: (enabled: boolean) => void;
    isResearcherEnabled: boolean;
    setIsResearcherEnabled: (enabled: boolean) => void;
    isNudgerEnabled: boolean;
    setIsNudgerEnabled: (enabled: boolean) => void;
    agentApiKeys: { [key: string]: string };
    setAgentApiKeys: React.Dispatch<React.SetStateAction<{ [key: string]: string }>>;
}

const MultiAgentTab: React.FC<MultiAgentTabProps> = ({ isCriticEnabled, setIsCriticEnabled, isResearcherEnabled, setIsResearcherEnabled, isNudgerEnabled, setIsNudgerEnabled, agentApiKeys, setAgentApiKeys }) => {
    const [viewingPrompt, setViewingPrompt] = useState<{ title: string, prompt: string } | null>(null);

    const handleApiKeyChange = (agentName: string, key: string) => {
        setAgentApiKeys(prev => ({...prev, [agentName]: key}));
    };

    const agentPrompts = {
        'Planner': Prompts.PLANNER_PROMPT("{Core Directive}", "{Current Plan}", "{History}", "{Learnings}"),
        'Proposer': Prompts.PROPOSER_PROMPT("{Plan}", "{Search Constraint}", "{Feedback}", "{Learnings}", "{History}"),
        'Critic Team': Prompts.CRITIC_PROMPT("{Role}", { Security: "...", Efficiency: "...", Clarity: "..." }, "{Code Change}"),
        'Synthesizer': Prompts.SYNTHESIZER_PROMPT("{Code Change}", "{Criticisms}"),
        'Researcher': Prompts.RESEARCHER_PROMPT("{Task}", "{History}"),
        'Nudger': Prompts.NUDGER_PROMPT("{Plan}"),
    };

  return (
    <>
    {viewingPrompt && <PromptModal title={viewingPrompt.title} prompt={viewingPrompt.prompt} onClose={() => setViewingPrompt(null)} />}
    <div className="p-6 h-full flex flex-col overflow-y-auto">
      <h2 className="text-3xl font-bold text-white mb-2">Multi-Agent System (MAS)</h2>
      <p className="text-gray-400 mb-8 max-w-4xl">
        The agent's core is a collaborative team of specialized agents. This control panel allows you to configure the MAS workflow and inspect the core instructions (prompts) that guide each agent's behavior.
      </p>

      <div className="flex-grow space-y-6">
        
        <div className="space-y-6">
          <AgentCard name="The Planner" color="border-sky-500" description="The strategist. Decides what to do next by creating and updating the master plan." onPromptClick={() => setViewingPrompt({ title: 'Planner', prompt: agentPrompts['Planner'] })} apiKey={agentApiKeys['PLANNER'] || ''} onApiKeyChange={(k) => handleApiKeyChange('PLANNER', k)} />
          
          <AgentCard name="The Researcher" color="border-blue-500" description="The information gatherer. Uses web search to find information needed for tasks identified by the Planner." onPromptClick={() => setViewingPrompt({ title: 'Researcher', prompt: agentPrompts['Researcher']})} isEnabled={isResearcherEnabled} onToggle={() => setIsResearcherEnabled(!isResearcherEnabled)} apiKey={agentApiKeys['RESEARCHER'] || ''} onApiKeyChange={(k) => handleApiKeyChange('RESEARCHER', k)} />

          <AgentCard name="The Proposer" color="border-yellow-500" description="The software engineer. Takes tasks from the plan and writes the code to implement them." onPromptClick={() => setViewingPrompt({ title: 'Proposer', prompt: agentPrompts['Proposer'] })} apiKey={agentApiKeys['PROPOSER'] || ''} onApiKeyChange={(k) => handleApiKeyChange('PROPOSER', k)} />

          <AgentCard
            name="The Critic Team"
            color="border-red-500"
            description="A panel of three specialists that review the Proposer's work in parallel. If disabled, proposals are automatically approved."
            onPromptClick={() => setViewingPrompt({ title: 'Critic Team', prompt: agentPrompts['Critic Team'] })}
            isEnabled={isCriticEnabled}
            onToggle={() => setIsCriticEnabled(!isCriticEnabled)}
            apiKey={agentApiKeys['CRITIC'] || ''}
            onApiKeyChange={(k) => handleApiKeyChange('CRITIC', k)}
          >
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="bg-gray-900 p-3 rounded-lg">
                    <h4 className="font-bold text-red-400">Security Critic</h4>
                    <p className="text-gray-400 mt-1">Checks for vulnerabilities.</p>
                </div>
                <div className="bg-gray-900 p-3 rounded-lg">
                    <h4 className="font-bold text-rose-400">Efficiency Critic</h4>
                    <p className="text-gray-400 mt-1">Checks for performance issues.</p>
                </div>
                <div className="bg-gray-900 p-3 rounded-lg">
                    <h4 className="font-bold text-orange-400">Clarity Critic</h4>
                    <p className="text-gray-400 mt-1">Checks for code readability.</p>
                </div>
            </div>
          </AgentCard>

          <AgentCard name="The Synthesizer" color="border-emerald-500" description="The lead engineer. Makes the final decision to APPROVE or REJECT a change after reviewing critic feedback." onPromptClick={() => setViewingPrompt({ title: 'Synthesizer', prompt: agentPrompts['Synthesizer'] })} apiKey={agentApiKeys['SYNTHESIZER'] || ''} onApiKeyChange={(k) => handleApiKeyChange('SYNTHESIZER', k)} />

          <AgentCard name="The Nudger" color="border-pink-500" description="The creative catalyst. Periodically suggests a novel 'wildcard' task to the Planner to avoid groupthink." onPromptClick={() => setViewingPrompt({ title: 'Nudger', prompt: agentPrompts['Nudger'] })} isEnabled={isNudgerEnabled} onToggle={() => setIsNudgerEnabled(!isNudgerEnabled)} apiKey={agentApiKeys['NUDGER'] || ''} onApiKeyChange={(k) => handleApiKeyChange('NUDGER', k)}>
              <div className="mt-4 flex items-center gap-2 text-pink-300 text-xs p-3 bg-gray-900/50 rounded-lg">
                <LightBulbIcon className="w-5 h-5 flex-shrink-0" />
                <p>When enabled, the Nudger will activate every 5 cycles to suggest a new idea to the Planner.</p>
              </div>
          </AgentCard>
        </div>
      </div>
    </div>
    </>
  );
};

export default MultiAgentTab;