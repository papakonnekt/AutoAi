// Fix: Import d3 to resolve all d3-related type and namespace errors.
import * as d3 from 'd3';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { UpgradeNode, D3Node, D3Link, LearnedMemory, LearnedMemoryType } from '../types';
import { XIcon, DownloadIcon, UploadIcon, CloudDownloadIcon, CloudUploadIcon, FolderIcon, ChatBubbleIcon } from './icons';

// --- Diff Generation Logic (from CodeDiffTab.tsx) ---
interface DiffPart {
    type: 'unchanged' | 'added' | 'removed';
    content: string;
    oldLineNum: number | string;
    newLineNum: number | string;
}

function generateDiff(oldCode: string, newCode: string): DiffPart[] {
    const oldLines = oldCode.split('\n');
    const newLines = newCode.split('\n');
    const oldL = oldLines.length;
    const newL = newLines.length;
    const matrix = Array(oldL + 1).fill(null).map(() => Array(newL + 1).fill(0));

    for (let i = 1; i <= oldL; i++) {
        for (let j = 1; j <= newL; j++) {
            if (oldLines[i - 1] === newLines[j - 1]) {
                matrix[i][j] = matrix[i - 1][j - 1] + 1;
            } else {
                matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
            }
        }
    }

    const diff: { type: 'unchanged' | 'added' | 'removed'; content: string }[] = [];
    let i = oldL, j = newL;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
            diff.unshift({ type: 'unchanged', content: oldLines[i - 1] });
            i--; j--;
        } else if (j > 0 && (i === 0 || matrix[i][j - 1] >= matrix[i - 1][j])) {
            diff.unshift({ type: 'added', content: newLines[j - 1] });
            j--;
        } else if (i > 0 && (j === 0 || matrix[i][j - 1] < matrix[i - 1][j])) {
            diff.unshift({ type: 'removed', content: oldLines[i - 1] });
            i--;
        }
    }
    
    let oldLineNum = 1;
    let newLineNum = 1;
    return diff.map(part => {
        const result: DiffPart = { ...part, oldLineNum: '', newLineNum: '' };
        if (part.type === 'unchanged') {
            result.oldLineNum = oldLineNum++;
            result.newLineNum = newLineNum++;
        } else if (part.type === 'added') {
            result.newLineNum = newLineNum++;
        } else if (part.type === 'removed') {
            result.oldLineNum = oldLineNum++;
        }
        return result;
    });
}

const generateDiffSummary = (diff: DiffPart[] | null): { added: number, removed: number } | null => {
    if (!diff) return null;
    return diff.reduce((acc, part) => {
        if (part.type === 'added') acc.added++;
        if (part.type === 'removed') acc.removed++;
        return acc;
    }, { added: 0, removed: 0 });
};


const getLineClass = (type: DiffPart['type']) => {
    switch(type) {
        case 'added': return 'bg-green-900/40';
        case 'removed': return 'bg-red-900/40';
        default: return 'bg-transparent';
    }
};

const getSymbol = (type: DiffPart['type']) => {
    switch(type) {
        case 'added': return '+';
        case 'removed': return '-';
        default: return ' ';
    }
};
// --- End of Diff Logic ---


const getMemoryTypeAppearance = (type: LearnedMemoryType) => {
    switch(type) {
        case 'SUCCESS': return { bg: 'bg-green-900/30', border: 'border-green-700', text: 'text-green-400' };
        case 'ERROR': return { bg: 'bg-red-900/30', border: 'border-red-700', text: 'text-red-400' };
        case 'INSIGHT': return { bg: 'bg-blue-900/30', border: 'border-blue-700', text: 'text-blue-400' };
        default: return { bg: 'bg-gray-800/30', border: 'border-gray-700', text: 'text-gray-400' };
    }
}

const MEMORY_TYPES: (LearnedMemoryType | 'ALL')[] = ['ALL', 'SUCCESS', 'ERROR', 'INSIGHT'];

// Fix: Added missing WebGraphTabProps interface definition.
interface WebGraphTabProps {
  upgradeNodes: UpgradeNode[];
  virtualFileSystem: { [key: string]: string };
  learnedMemories: LearnedMemory[];
  setUpgradeNodes: React.Dispatch<React.SetStateAction<UpgradeNode[]>>;
  setVirtualFileSystem: React.Dispatch<React.SetStateAction<{ [key: string]: string }>>;
  setLearnedMemories: React.Dispatch<React.SetStateAction<LearnedMemory[]>>;
  logSystemMessage: (message: string) => void;
}

const WebGraphTab: React.FC<WebGraphTabProps> = ({ upgradeNodes, virtualFileSystem, learnedMemories, setUpgradeNodes, setVirtualFileSystem, setLearnedMemories, logSystemMessage }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedNode, setSelectedNode] = useState<UpgradeNode | null>(null);
  const [viewingFile, setViewingFile] = useState<{ path: string; content: string } | null>(null);
  const [activeRightTab, setActiveRightTab] = useState<'memories' | 'vfs'>('memories');
  
  // State for memory filtering and sorting
  const [memoryFilter, setMemoryFilter] = useState<'ALL' | LearnedMemoryType>('ALL');
  const [memorySort, setMemorySort] = useState<'NEWEST' | 'OLDEST'>('NEWEST');

  // State for VFS searching
  const [vfsSearchQuery, setVfsSearchQuery] = useState('');


  useEffect(() => {
    if (!upgradeNodes.length || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = svg.node()?.getBoundingClientRect().width || 800;
    const height = svg.node()?.getBoundingClientRect().height || 600;

    svg.selectAll("*").remove(); // Clear previous render

    const nodes: D3Node[] = upgradeNodes.map(node => ({
      id: node.id,
      version: node.version,
    }));

    const links: D3Link[] = [];
    for (let i = 1; i < nodes.length; i++) {
      links.push({ source: nodes[i - 1].id, target: nodes[i].id });
    }

    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2));

    const link = svg.append("g")
      .attr("stroke", "#4f46e5")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", 2);

    const node = svg.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .style("cursor", "pointer")
      .on("click", (event, d) => {
        const fullNodeData = upgradeNodes.find(n => n.id === d.id);
        if (fullNodeData) {
          setSelectedNode(fullNodeData);
        }
      })
      .call(drag(simulation) as any);

    node.append("circle")
      .attr("r", 20)
      .attr("fill", (d, i) => i === nodes.length - 1 ? "#a78bfa" : "#6366f1")
      .attr("stroke", "#1e1b4b")
      .attr("stroke-width", 2);

    node.append("text")
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("fill", "white")
      .text(d => `v${d.version}`);

    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as D3Node).x!)
        .attr("y1", d => (d.source as D3Node).y!)
        .attr("x2", d => (d.target as D3Node).x!)
        .attr("y2", d => (d.target as D3Node).y!);

      node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    function drag(simulation: d3.Simulation<D3Node, undefined>) {
        function dragstarted(event: d3.D3DragEvent<SVGGElement, D3Node, D3Node>, d: D3Node) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(event: d3.D3DragEvent<SVGGElement, D3Node, D3Node>, d: D3Node) {
            d.fx = event.x;
            d.fy = event.y;
        }

        function dragended(event: d3.D3DragEvent<SVGGElement, D3Node, D3Node>, d: D3Node) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }

        return d3.drag<SVGGElement, D3Node>()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);
    }


  }, [upgradeNodes]);
  
  const { diffResult, diffSummary } = useMemo(() => {
    if (!selectedNode || selectedNode.version === 1) return { diffResult: null, diffSummary: null };
    const previousNode = upgradeNodes
        .slice(0, selectedNode.version - 1)
        .reverse()
        .find(n => n.filePath === selectedNode.filePath);

    if (!previousNode) return { diffResult: null, diffSummary: null };
    
    const diff = generateDiff(previousNode.code, selectedNode.code);
    const summary = generateDiffSummary(diff);
    return { diffResult: diff, diffSummary: summary };
  }, [selectedNode, upgradeNodes]);

  const filteredAndSortedMemories = useMemo(() => {
    return learnedMemories
        .filter(mem => memoryFilter === 'ALL' || mem.type === memoryFilter)
        .sort((a, b) => {
            if (memorySort === 'NEWEST') {
                return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
            } else {
                return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
            }
        });
  }, [learnedMemories, memoryFilter, memorySort]);

  const filteredVfsFiles = useMemo(() => {
    if (!vfsSearchQuery) return Object.keys(virtualFileSystem).sort();
    return Object.keys(virtualFileSystem)
        .filter(path => path.toLowerCase().includes(vfsSearchQuery.toLowerCase()))
        .sort();
  }, [virtualFileSystem, vfsSearchQuery]);

  const handleDownloadState = () => {
    const memoryData = {
        upgradeNodes,
        virtualFileSystem
    };
    const blob = new Blob([JSON.stringify(memoryData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent_state_${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    logSystemMessage("Full agent state has been downloaded.");
  };

  const handleUploadStateClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!window.confirm("Are you sure you want to load this state file? This will overwrite the current agent's memory and code.")) {
        event.target.value = ''; // Reset file input
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const text = e.target?.result;
            if (typeof text !== 'string') throw new Error("File is not a valid text file.");
            
            const data = JSON.parse(text);

            if (data.upgradeNodes && data.virtualFileSystem) {
                setUpgradeNodes(data.upgradeNodes);
                setVirtualFileSystem(data.virtualFileSystem);
                logSystemMessage(`Successfully loaded agent state from ${file.name}.`);
            } else {
                throw new Error("Invalid state file format. Missing 'upgradeNodes' or 'virtualFileSystem' keys.");
            }
        } catch (error: any) {
            console.error("Failed to load state file:", error);
            logSystemMessage(`Error loading state file: ${error.message}`);
        } finally {
             event.target.value = ''; // Reset file input
        }
    };
    reader.readAsText(file);
  };

  const handleDownloadFromServer = async () => {
    try {
        logSystemMessage("Downloading shared learnings from global server...");
        const response = await fetch('/globalMemories.json');
        if (!response.ok) throw new Error(`Server responded with status ${response.status}`);
        const globalMemories: LearnedMemory[] = await response.json();
        
        setLearnedMemories(prev => {
            const existingIds = new Set(prev.map(mem => mem.id));
            const newMemories = globalMemories.filter(mem => !existingIds.has(mem.id));
            logSystemMessage(`Downloaded ${globalMemories.length} memories, added ${newMemories.length} new learnings.`);
            return [...prev, ...newMemories];
        });
    } catch(error: any) {
        console.error("Failed to download global memories:", error);
        logSystemMessage(`Error downloading learnings: ${error.message}`);
    }
  };

  const handleUploadToServer = () => {
      logSystemMessage(`Uploading ${learnedMemories.length} learned memories to the global server... (Simulation)`);
      console.log("--- SIMULATED SERVER UPLOAD ---");
      console.log(JSON.stringify(learnedMemories, null, 2));
      console.log("-------------------------------");
      logSystemMessage("Successfully contributed learnings to the global pool.");
  };
  
  const TabButton = ({ id, label, icon }: { id: string, label: string, icon: React.ReactNode }) => (
    <button
      onClick={() => setActiveRightTab(id as 'memories' | 'vfs')}
      className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
        activeRightTab === id
          ? 'bg-indigo-600 border-indigo-500 text-white'
          : 'bg-gray-700/50 border-gray-700 text-gray-300 hover:bg-gray-700'
      }`}
    >
      {icon}
      {label}
    </button>
  );


  return (
    <div className="p-6 h-full flex flex-col relative">
       <header className="flex-shrink-0 mb-4">
        <h2 className="text-2xl font-bold text-white mb-4">AI Upgrade Graph & Memory</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-850 p-3 rounded-lg border border-gray-700">
                <h3 className="text-sm font-semibold text-gray-300 mb-2">Agent State Management (Local)</h3>
                <div className="flex items-center gap-2">
                     <button onClick={handleDownloadState} className="flex-grow flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition-colors text-sm">
                        <DownloadIcon className="w-5 h-5" />
                        Download Full State
                    </button>
                    <button onClick={handleUploadStateClick} className="flex-grow flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition-colors text-sm">
                        <UploadIcon className="w-5 h-5" />
                        Upload Full State
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".json" className="hidden" />
                </div>
            </div>
            <div className="bg-gray-850 p-3 rounded-lg border border-gray-700">
                <h3 className="text-sm font-semibold text-gray-300 mb-2">Shared Learnings (Global)</h3>
                <div className="flex items-center gap-2">
                     <button onClick={handleDownloadFromServer} className="flex-grow flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition-colors text-sm">
                        <CloudDownloadIcon className="w-5 h-5" />
                        Download from Server
                    </button>
                    <button onClick={handleUploadToServer} className="flex-grow flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition-colors text-sm">
                        <CloudUploadIcon className="w-5 h-5" />
                        Upload to Server
                    </button>
                </div>
            </div>
        </div>
      </header>
       
      <div className="flex-grow flex flex-col md:flex-row gap-4 overflow-hidden">
        <div className="flex-grow md:w-1/2 h-96 md:h-auto bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
             {upgradeNodes.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center">
                    <p className="text-gray-400">No code upgrades yet. The graph will appear here.</p>
                </div>
            ) : (
                <svg ref={svgRef} className="w-full h-full"></svg>
            )}
        </div>
        <div className="md:w-1/2 flex flex-col gap-2 overflow-hidden">
            <div className="flex-shrink-0 flex items-center justify-between">
                <div className="flex items-center gap-2">
                     <TabButton id="memories" label="Learned Memories" icon={<ChatBubbleIcon className="w-4 h-4" />} />
                     <TabButton id="vfs" label="Virtual Filesystem" icon={<FolderIcon className="w-4 h-4" />} />
                </div>
             </div>
             
             {activeRightTab === 'memories' && (
                <div className="flex-grow flex flex-col gap-3 overflow-hidden">
                     <div className="flex-shrink-0 p-2 bg-gray-900/50 rounded-md border border-gray-800 flex items-center justify-between gap-2">
                         <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-400 mr-2">Filter by:</span>
                            {MEMORY_TYPES.map(type => (
                                <button key={type} onClick={() => setMemoryFilter(type)} className={`px-2 py-1 text-xs rounded-md ${memoryFilter === type ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}>
                                    {type}
                                </button>
                            ))}
                         </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-400 mr-2">Sort by:</span>
                             <button onClick={() => setMemorySort('NEWEST')} className={`px-2 py-1 text-xs rounded-md ${memorySort === 'NEWEST' ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}>
                                Newest
                            </button>
                             <button onClick={() => setMemorySort('OLDEST')} className={`px-2 py-1 text-xs rounded-md ${memorySort === 'OLDEST' ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}>
                                Oldest
                            </button>
                         </div>
                     </div>
                     <div className="flex-grow bg-gray-900 rounded-lg border border-gray-800 overflow-y-auto p-3 space-y-3">
                        {filteredAndSortedMemories.length === 0 ? (
                             <div className="h-full flex items-center justify-center">
                                <p className="text-gray-400">{learnedMemories.length > 0 ? "No memories match your filter." : "No learnings yet."}</p>
                            </div>
                        ) : (
                            filteredAndSortedMemories.map(mem => {
                                const { bg, border, text } = getMemoryTypeAppearance(mem.type);
                                return (
                                    <div key={mem.id} className={`p-3 rounded-md border ${bg} ${border} text-xs`}>
                                        <div className="flex justify-between items-center mb-1">
                                            <strong className={`font-bold ${text}`}>{mem.type}</strong>
                                            <span className="text-gray-500">v{mem.agentVersion}</span>
                                        </div>
                                        <p className="text-gray-400 mb-2"><strong className="text-gray-300">Context:</strong> {mem.context}</p>
                                        <p className="text-gray-400"><strong className="text-gray-300">Learning:</strong> {mem.learning}</p>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            )}

            {activeRightTab === 'vfs' && (
                <div className="flex-grow flex flex-col gap-3 overflow-hidden">
                    <div className="flex-shrink-0">
                        <input
                            type="text"
                            value={vfsSearchQuery}
                            onChange={(e) => setVfsSearchQuery(e.target.value)}
                            placeholder="Search files..."
                            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        />
                    </div>
                    <div className="flex-grow bg-gray-900 rounded-lg border border-gray-800 overflow-y-auto p-2">
                        {filteredVfsFiles.length > 0 ? (
                           <div className="space-y-1">
                                {filteredVfsFiles.map(path => (
                                    <button
                                        key={path}
                                        onClick={() => setViewingFile({ path, content: virtualFileSystem[path] })}
                                        className="w-full text-left p-2 rounded-md hover:bg-gray-800/50 font-mono text-sm text-gray-300 transition-colors"
                                    >
                                        {path}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center">
                                <p className="text-gray-400">No files found.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
      </div>


      {selectedNode && (
        <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center z-10 p-4" onClick={() => setSelectedNode(null)}>
          <div className="bg-gray-850 border border-gray-700 rounded-lg w-full max-w-5xl h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <header className="p-4 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
              <div>
                 <h3 className="text-xl font-bold text-white">Version {selectedNode.version} Details</h3>
                 <p className="text-sm text-indigo-300 font-mono">{selectedNode.filePath}</p>
              </div>
              <button onClick={() => setSelectedNode(null)} className="text-gray-400 hover:text-white">
                <XIcon className="w-6 h-6" />
              </button>
            </header>
            <div className="flex-grow overflow-y-auto p-6 space-y-6">
              <div>
                <h4 className="font-semibold text-lg text-yellow-400 mb-2">[THOUGHT]</h4>
                <div className="bg-gray-900 p-4 rounded-md text-gray-300 whitespace-pre-wrap text-sm max-h-48 overflow-y-auto">
                  {selectedNode.thought}
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-lg text-cyan-400 mb-2">[ACTION]</h4>
                <div className="bg-gray-900 p-4 rounded-md text-gray-300 whitespace-pre-wrap text-sm max-h-48 overflow-y-auto">
                   <pre className="whitespace-pre-wrap"><code>{selectedNode.action}</code></pre>
                </div>
              </div>
               
              {diffSummary && (
                <div>
                  <h4 className="font-semibold text-lg text-purple-400 mb-2">[CHANGE SUMMARY]</h4>
                  <div className="bg-gray-900 p-4 rounded-md text-gray-300 text-sm">
                      <span className="text-green-400">Lines Added: {diffSummary.added}</span><br/>
                      <span className="text-red-400">Lines Removed: {diffSummary.removed}</span>
                  </div>
                </div>
              )}
              
              <div>
                <h4 className="font-semibold text-lg text-white mb-2">Code Diff vs. Previous Version</h4>
                <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-auto font-mono text-sm max-h-[50vh]">
                  {diffResult ? (
                    <pre className="p-4"><code>
                      {diffResult.map((part, index) => (
                          <div key={index} className={`flex ${getLineClass(part.type)}`}>
                              <span className="w-10 text-right text-gray-600 select-none">{part.oldLineNum}</span>
                              <span className="w-10 text-right text-gray-600 select-none">{part.newLineNum}</span>
                              <span className={`w-4 text-center ${part.type === 'added' ? 'text-green-400' : part.type === 'removed' ? 'text-red-400' : 'text-gray-500'}`}>
                                  {getSymbol(part.type)}
                              </span>
                              <span className="flex-1 whitespace-pre-wrap">{part.content}</span>
                          </div>
                      ))}
                    </code></pre>
                  ) : (
                    <p className="p-4 text-gray-500">{selectedNode.version === 1 ? "This is the initial version. No diff available." : "No previous version of this file found to compare."}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewingFile && (
          <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center z-20 p-4" onClick={() => setViewingFile(null)}>
              <div className="bg-gray-850 border border-gray-700 rounded-lg w-full max-w-4xl h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                  <header className="p-4 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
                     <h3 className="text-lg font-bold text-white font-mono">{viewingFile.path}</h3>
                      <button onClick={() => setViewingFile(null)} className="text-gray-400 hover:text-white">
                        <XIcon className="w-6 h-6" />
                      </button>
                  </header>
                  <div className="flex-grow overflow-auto font-mono text-sm bg-gray-900">
                      <pre className="p-4"><code>{viewingFile.content}</code></pre>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default WebGraphTab;