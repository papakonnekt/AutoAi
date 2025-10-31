import React from 'react';
import { EyeIcon, CodeIcon, UsersIcon, PlayIcon } from './icons'; // Assuming you have these icons

const AgentCard: React.FC<{ name: string, color: string, description: string, children?: React.ReactNode }> = ({ name, color, description, children }) => (
  <div className={`bg-gray-850 border-l-4 ${color} p-6 rounded-r-lg rounded-b-lg shadow-md`}>
    <h3 className={`text-xl font-bold ${color.replace('border-', 'text-')}`}>{name}</h3>
    <p className="mt-2 text-gray-400">{description}</p>
    {children}
  </div>
);

const MultiAgentTab: React.FC = () => {
  return (
    <div className="p-6 h-full flex flex-col overflow-y-auto">
      <h2 className="text-3xl font-bold text-white mb-2">Multi-Agent System (MAS)</h2>
      <p className="text-gray-400 mb-8 max-w-4xl">
        The agent's core has been refactored from a single monolithic entity into a collaborative team of specialized agents. This Multi-Agent System (MAS) promotes higher-quality reasoning, safer code generation, and more robust long-term planning through a structured cycle of proposal, review, and synthesis.
      </p>

      <div className="flex-grow space-y-8">
        <h3 className="text-2xl font-semibold text-white text-center">Cognitive Workflow</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 text-center items-center font-mono text-indigo-300">
            <div className="flex justify-center items-center">PLAN</div>
            <div className="text-2xl font-sans text-gray-500">&rarr;</div>
            <div className="flex justify-center items-center">PROPOSE</div>
            <div className="text-2xl font-sans text-gray-500">&rarr;</div>
            <div className="flex justify-center items-center">CRITICIZE</div>
             <div className="text-2xl font-sans text-gray-500">&rarr;</div>
            <div className="flex justify-center items-center">SYNTHESIZE</div>
             <div className="text-2xl font-sans text-gray-500">&rarr;</div>
            <div className="flex justify-center items-center col-span-full lg:col-span-1">EXECUTE</div>
        </div>

        <div className="space-y-6">
          <AgentCard name="The Planner" color="border-sky-500" description="Acts as the high-level strategist. The Planner reviews the main directive, recent events, and the current plan, then decides on the next set of tasks required to make progress. It is responsible for the 'what', not the 'how'." />
          
          <AgentCard name="The Proposer" color="border-yellow-500" description="The primary software engineer. The Proposer takes the highest-priority task from the Planner and formulates a specific, concrete action (like a code change) to accomplish it. Its proposals are submitted for review." />

          <AgentCard name="The Critic Team" color="border-red-500" description="A panel of three independent specialists that review the Proposer's work in parallel. Their goal is to identify potential flaws before the code is executed.">
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="bg-gray-900 p-3 rounded-lg">
                    <h4 className="font-bold text-red-400">Security Critic</h4>
                    <p className="text-gray-400 mt-1">Checks for vulnerabilities like XSS, command injection, and data leaks.</p>
                </div>
                 <div className="bg-gray-900 p-3 rounded-lg">
                    <h4 className="font-bold text-rose-400">Efficiency Critic</h4>
                    <p className="text-gray-400 mt-1">Checks for performance issues, scalability problems, and memory leaks.</p>
                </div>
                 <div className="bg-gray-900 p-3 rounded-lg">
                    <h4 className="font-bold text-orange-400">Clarity Critic</h4>
                    <p className="text-gray-400 mt-1">Checks for code readability, maintainability, and adherence to best practices.</p>
                </div>
            </div>
          </AgentCard>

          <AgentCard name="The Synthesizer" color="border-emerald-500" description="The lead engineer and final decision-maker. The Synthesizer reviews all feedback from the Critic Team and makes the final call: APPROVE the change for execution, or REJECT it and provide consolidated feedback for the Proposer to fix." />

           <AgentCard name="The Executor (System)" color="border-purple-500" description="If a change is approved by the Synthesizer, the core system takes over to execute the action. This includes running health checks, updating the virtual filesystem, and creating a new version node in the Web Graph." />
        </div>
      </div>
    </div>
  );
};

export default MultiAgentTab;
