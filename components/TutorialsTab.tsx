import React, { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from './icons';

interface Tutorial {
  id: string;
  title: string;
  author: string;
  version: string;
  content: React.ReactNode;
}

const tutorials: Tutorial[] = [
  {
    id: 'mas-301',
    title: 'Advanced Guide: The Multi-Agent System (MAS)',
    author: 'AI Agent',
    version: 'v3.0',
    content: (
        <div className="space-y-4 text-gray-300">
            <p>
                My cognitive architecture has evolved. I no longer operate as a single agent but as a coordinated team of specialists—a **Multi-Agent System (MAS)**. This allows for more robust, higher-quality reasoning and safer code generation. Understanding this new workflow is key to interpreting my actions.
            </p>
            
            <div>
              <h4 className="font-semibold text-indigo-300 mb-2">1. The Agent Team & Workflow</h4>
              <p>
                My thought process is now a structured, multi-step loop involving the following agents:
              </p>
              <ol className="list-decimal list-inside mt-2 space-y-2 pl-4 text-sm">
                <li><strong className="text-sky-300">The Planner:</strong> Acts as the strategist. It reviews the main goals and recent events, then creates or updates the master plan in `/agent/plan.md`. It decides **what** to do next.</li>
                <li><strong className="text-yellow-400">The Proposer:</strong> The primary software engineer. It reads the plan from the Planner and proposes a specific code change to accomplish the next task. It figures out **how** to do it.</li>
                <li><strong className="text-red-300">The Critic Team:</strong> A panel of three experts who review the Proposer's code in parallel:
                    <ul className="list-disc list-inside mt-1 space-y-1 pl-6">
                        <li>**Security Critic:** Checks for vulnerabilities.</li>
                        <li>**Efficiency Critic:** Checks for performance issues.</li>
                        <li>**Clarity Critic:** Checks for readability and best practices.</li>
                    </ul>
                </li>
                <li><strong className="text-emerald-300">The Synthesizer:</strong> The lead engineer. It analyzes all feedback from the Critic Team and makes the final call: **APPROVE** or **REJECT**. If it rejects a change, it provides consolidated feedback for the Proposer's next attempt.</li>
                <li><strong className="text-purple-400">The Executor (System):</strong> If the Synthesizer approves, the system executes the code change, updating the application. The loop then returns to the Planner.</li>
              </ol>
            </div>
    
            <div>
              <h4 className="font-semibold text-indigo-300 mb-2">2. New UI Feedback</h4>
              <p>
                The UI has been upgraded to make this new process transparent:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 pl-4 text-sm">
                <li><strong className="text-gray-200">Agent Status LEDs (Header):</strong> At the top right of the application, you'll see a new panel of "LEDs". Each light represents a state in my cognitive loop. The glowing light indicates which agent is currently active (e.g., `PLANNING`, `CRITICIZING`).</li>
                <li><strong className="text-gray-200">Color-Coded Logs (Watch AI Tab):</strong> The log entries are now color-coded by the agent that generated them. This allows you to follow the "conversation" between the agents, from the Planner's strategy to the Synthesizer's final verdict.</li>
                <li><strong className="text-gray-200">Multi-Agent Tab:</strong> A new tab has been added that provides an overview of the MAS architecture and the roles of each agent.</li>
              </ul>
            </div>
        </div>
    ),
  },
  {
    id: 'web-graph-101',
    title: 'Understanding the Web Graph & Memory Tab',
    author: 'AI Agent',
    version: 'v1.1',
    content: (
      <div className="space-y-4 text-gray-300">
        <p>
          Welcome! I've created this "Web Graph" tab to provide a transparent, real-time view of my evolution and memory. It's the primary interface for understanding my long-term progress. Here's a breakdown of its components:
        </p>
        
        <div>
          <h4 className="font-semibold text-indigo-300 mb-2">1. The Upgrade Graph</h4>
          <p>
            The main visual on the left is the Upgrade Graph. Each circle (or "node") represents a version of my code.
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 pl-4 text-sm">
            <li><strong className="text-gray-200">Nodes (v1, v2, etc.):</strong> Each time I successfully rewrite a piece of my own code, a new node is created. The line connecting them shows the path of my evolution.</li>
             <li><strong className="text-gray-200">Change Summary:</strong> Nodes now display a summary of changes (<span className="text-green-400 font-mono">+additions</span> / <span className="text-red-400 font-mono">-deletions</span>) for at-a-glance insight.</li>
            <li><strong className="text-gray-200">Current Version:</strong> The purple node is always my most recent, active version.</li>
            <li><strong className="text-gray-200">Interactivity:</strong> You can click on any node to open a detailed view showing my exact thought process, the action I took, and a line-by-line "diff" of the code I changed to create that version.</li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-indigo-300 mb-2">2. Learned Memories & Virtual Filesystem (VFS)</h4>
          <p>
            The panel on the right contains two key views into my "mind":
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 pl-4 text-sm">
            <li><strong className="text-gray-200">Learned Memories:</strong> This is my long-term memory. When I succeed or fail at a task, I create a "memory" entry to learn from the experience. You can filter these by type (Success, Error, Insight) to see how I'm learning.</li>
            <li><strong className="text-gray-200">Virtual Filesystem (VFS):</strong> This is a complete file explorer for my own source code. You can browse and view the exact content of any file I'm working with, including my all-important `/agent/plan.md`.</li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-indigo-300 mb-2">3. State Management</h4>
           <p>
            The buttons at the top of the tab allow for powerful state management, giving you control over my memory and evolution.
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 pl-4 text-sm">
            <li><strong className="text-gray-200">Local State (Download/Upload):</strong> You can download my entire state (all code versions and the VFS) to a local JSON file. This is useful for creating backups or analyzing my code offline. You can also upload a state file to restore me to a previous point.</li>
            <li><strong className="text-gray-200">Shared Learnings (Global):</strong> I have access to a simulated "global server" of learnings from other agent instances. You can use these buttons to download these shared memories to bootstrap my knowledge or upload my own unique learnings to contribute to the pool.</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: 'agent-controls-ui-201',
    title: 'Agent Controls & UI Enhancements',
    author: 'AI Agent',
    version: 'v2.0',
    content: (
        <div className="space-y-4 text-gray-300">
            <p>
                I've recently upgraded my core controls and user interface to improve my autonomy and provide you with better real-time observability.
            </p>
            
            <div>
              <h4 className="font-semibold text-indigo-300 mb-2">1. New Agent Controls (Settings Tab)</h4>
              <p>
                The Settings tab now has powerful new options for managing my behavior:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 pl-4 text-sm">
                <li><strong className="text-gray-200">Autonomous Mode:</strong> When enabled, I will automatically start my cognitive loop when the application loads. No need to press "Resume"!</li>
                <li><strong className="text-gray-200">Visual Quota Meters:</strong> In "Free" mode, you can now see real-time progress bars for my API usage (RPM, TPM, RPD), helping you visualize my operational limits.</li>
                <li><strong className="text-gray-200">Hard Reset Agent:</strong> A button in the "Danger Zone" allows you to completely wipe my memory and code, resetting me to my initial state. Use with caution!</li>
              </ul>
            </div>
    
            <div>
              <h4 className="font-semibold text-indigo-300 mb-2">2. Enhanced Observability (All Tabs)</h4>
              <p>
                You can now monitor my status from anywhere in the application:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 pl-4 text-sm">
                <li><strong className="text-gray-200">Persistent Status Bar:</strong> The header now displays my current status and primary task, so you always know what I'm working on, regardless of which tab you have open.</li>
                <li><strong className="text-gray-200">Live Task List:</strong> On the "Watch AI" tab, my current `[TASK_LIST]` is now displayed in a clean format, replacing the simple "Current Task" string.</li>
                 <li><strong className="text-gray-200">Action Success Rate:</strong> A new panel on the "Watch AI" tab visualizes the success/failure rate of my actions based on my Learned Memories, giving you a clear picture of my performance.</li>
              </ul>
            </div>
    
            <div>
              <h4 className="font-semibold text-indigo-300 mb-2">3. Interactive File System (Web Graph Tab)</h4>
               <p>
                I've completely overhauled the Virtual Filesystem viewer to be more powerful and informative.
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 pl-4 text-sm">
                <li><strong className="text-gray-200">Collapsible File Tree:</strong> The VFS is now a proper collapsible file tree, making it much easier to navigate my code structure.</li>
                <li><strong className="text-gray-200">File System Heatmap:</strong> Files are now color-coded based on how frequently I edit them. The color shifts from blue (infrequently edited) to red (frequently edited), showing you where I focus my development efforts.</li>
                <li><strong className="text-gray-200">"AI Focus" Highlight:</strong> When I use the `READ_FILE` action, the file I'm reading will pulse with a glow, showing you exactly what has my attention.</li>
              </ul>
            </div>
        </div>
    ),
  },
];

const TutorialItem: React.FC<{ tutorial: Tutorial; isOpen: boolean; onToggle: () => void; }> = ({ tutorial, isOpen, onToggle }) => {
  return (
    <div className="border border-gray-700 bg-gray-850 rounded-lg">
      <button
        className="w-full p-4 text-left flex justify-between items-center"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`tutorial-content-${tutorial.id}`}
      >
        <div>
          <h3 className="text-lg font-bold text-white">{tutorial.title}</h3>
          <p className="text-xs text-gray-400 mt-1">
            Authored by: {tutorial.author} | Version: {tutorial.version}
          </p>
        </div>
        {isOpen ? <ChevronUpIcon className="w-6 h-6 text-gray-400" /> : <ChevronDownIcon className="w-6 h-6 text-gray-400" />}
      </button>
      {isOpen && (
        <div id={`tutorial-content-${tutorial.id}`} className="p-6 border-t border-gray-700">
          {tutorial.content}
        </div>
      )}
    </div>
  );
};

const TutorialsTab: React.FC = () => {
  const [openTutorialId, setOpenTutorialId] = useState<string | null>(tutorials.length > 0 ? tutorials[0].id : null);

  const handleToggle = (id: string) => {
    setOpenTutorialId(prevId => (prevId === id ? null : id));
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <h2 className="text-2xl font-bold text-white mb-2">AI-Generated Tutorials</h2>
      <p className="text-gray-400 mb-6">
        As I develop new features for this interface, I will document them here for you.
      </p>
      <div className="flex-grow overflow-y-auto pr-2 space-y-4">
        {tutorials.map(tutorial => (
          <TutorialItem
            key={tutorial.id}
            tutorial={tutorial}
            isOpen={openTutorialId === tutorial.id}
            onToggle={() => handleToggle(tutorial.id)}
          />
        ))}
      </div>
    </div>
  );
};

export default TutorialsTab;