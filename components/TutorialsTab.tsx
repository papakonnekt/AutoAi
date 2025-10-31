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
  // As the AI develops more features, it will be instructed to add new tutorial items here.
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