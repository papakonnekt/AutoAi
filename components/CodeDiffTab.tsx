import React, { useState, useMemo, useEffect } from 'react';
import { UpgradeNode } from '../types';

interface DiffPart {
    type: 'unchanged' | 'added' | 'removed';
    content: string;
    oldLineNum: number | string;
    newLineNum: number | string;
}

// Uses Longest Common Subsequence algorithm to generate a line-by-line diff.
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


const CodeDiffTab: React.FC<{ upgradeNodes: UpgradeNode[] }> = ({ upgradeNodes }) => {
    const [baseVersionId, setBaseVersionId] = useState<string>('');
    const [compareVersionId, setCompareVersionId] = useState<string>('');

    useEffect(() => {
        // Automatically select the last two versions to compare when the component loads or nodes update.
        if (upgradeNodes.length >= 2) {
            setBaseVersionId(upgradeNodes[upgradeNodes.length - 2].id);
            setCompareVersionId(upgradeNodes[upgradeNodes.length - 1].id);
        } else if (upgradeNodes.length === 1) {
            // If only one version, set both selectors to it.
            setBaseVersionId(upgradeNodes[0].id);
            setCompareVersionId(upgradeNodes[0].id);
        }
    }, [upgradeNodes]);

    const { diffResult, error } = useMemo(() => {
        const baseNode = upgradeNodes.find(n => n.id === baseVersionId);
        const compareNode = upgradeNodes.find(n => n.id === compareVersionId);

        if (baseNode && compareNode) {
            if (baseNode.filePath !== compareNode.filePath) {
                return { 
                    diffResult: null, 
                    error: `Cannot compare versions that modify different files.\nBase (v${baseNode.version}) modified: ${baseNode.filePath}\nCompare (v${compareNode.version}) modified: ${compareNode.filePath}` 
                };
            }
            return { diffResult: generateDiff(baseNode.code, compareNode.code), error: null };
        }
        return { diffResult: null, error: 'Select two versions to compare.' };
    }, [baseVersionId, compareVersionId, upgradeNodes]);

    const handleBaseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setBaseVersionId(e.target.value);
    };

    const handleCompareChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setCompareVersionId(e.target.value);
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

    return (
        <div className="p-6 h-full flex flex-col">
            <h2 className="text-2xl font-bold text-white mb-4">Code Diffs</h2>
            
            {upgradeNodes.length < 1 ? (
                 <div className="flex-grow flex items-center justify-center">
                    <p className="text-gray-400">At least one code version is needed to show a diff.</p>
                </div>
            ) : (
                <>
                    <div className="mb-4 flex items-center gap-4 p-4 bg-gray-900 rounded-lg border border-gray-800">
                        <div className="flex items-center gap-2">
                            <label htmlFor="base-version" className="text-sm font-medium text-gray-400">Base:</label>
                            <select id="base-version" value={baseVersionId} onChange={handleBaseChange} className="bg-gray-800 border border-gray-700 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                {upgradeNodes.map(node => <option key={node.id} value={node.id}>v{node.version} ({node.filePath})</option>)}
                            </select>
                        </div>
                         <div className="flex items-center gap-2">
                            <label htmlFor="compare-version" className="text-sm font-medium text-gray-400">Compare:</label>
                             <select id="compare-version" value={compareVersionId} onChange={handleCompareChange} className="bg-gray-800 border border-gray-700 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                {upgradeNodes.map(node => <option key={node.id} value={node.id}>v{node.version} ({node.filePath})</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex-grow bg-gray-900 rounded-lg border border-gray-800 overflow-auto font-mono text-sm">
                        <pre className="p-4">
                            <code>
                                {diffResult ? diffResult.map((part, index) => (
                                    <div key={index} className={`flex ${getLineClass(part.type)}`}>
                                        <span className="w-10 text-right text-gray-600 select-none">{part.oldLineNum}</span>
                                        <span className="w-10 text-right text-gray-600 select-none">{part.newLineNum}</span>
                                        <span className={`w-4 text-center ${part.type === 'added' ? 'text-green-400' : part.type === 'removed' ? 'text-red-400' : 'text-gray-500'}`}>
                                            {getSymbol(part.type)}
                                        </span>
                                        <span className="flex-1 whitespace-pre-wrap">{part.content}</span>
                                    </div>
                                )) : <div className="text-yellow-400 whitespace-pre-wrap">{error}</div>}
                            </code>
                        </pre>
                    </div>
                </>
            )}
        </div>
    );
};

export default CodeDiffTab;