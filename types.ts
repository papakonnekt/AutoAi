// Fix: Import d3 to provide type definitions and resolve d3 namespace errors.
import * as d3 from 'd3';

export enum LogMessageAuthor {
  THOUGHT = 'THOUGHT',
  ACTION = 'ACTION',
  SYSTEM = 'SYSTEM',
  USER = 'USER',
  // MAS Agents
  PLANNER = 'PLANNER',
  PROPOSER = 'PROPOSER',
  CRITIC_SECURITY = 'CRITIC_SECURITY',
  CRITIC_EFFICIENCY = 'CRITIC_EFFICIENCY',
  CRITIC_CLARITY = 'CRITIC_CLARITY',
  SYNTHESIZER = 'SYNTHESIZER',
}

export interface LogMessage {
  id: string;
  author: LogMessageAuthor;
  content: string;
  timestamp: string;
  metadata?: any;
}

export enum AIMode {
  FREE = 'FREE',
  PAID = 'PAID',
}

export type AgentStatus =
  | 'IDLE'
  | 'RUNNING' // Kept for general "on" state
  | 'PAUSED'
  | 'ERROR'
  // MAS States
  | 'PLANNING'
  | 'PROPOSING'
  | 'CRITICIZING'
  | 'SYNTHESIZING'
  | 'EXECUTING';


export interface UpgradeNode {
  id: string;
  version: number;
  timestamp: string;
  filePath: string;
  code: string;
  thought: string;
  action: string;
}

export type LearnedMemoryType = 'SUCCESS' | 'ERROR' | 'INSIGHT';

export interface LearnedMemory {
    id: string;
    timestamp: string;
    type: LearnedMemoryType;
    context: string;
    outcome: string;
    learning: string;
    agentVersion: number;
}


// Fix: Changed D3Node from an interface to a type alias. This resolves
// TypeScript errors where properties from d3.SimulationNodeDatum
// (like x, y, fx, fy) were not being correctly inherited by the D3Node interface.
export type D3Node = d3.SimulationNodeDatum & {
  id: string;
  version: number;
};

// Fix: Removed incorrect override of source and target properties.
// The base d3.SimulationLinkDatum<D3Node> correctly types `source` and `target`
// as `D3Node | string | number`. The previous definition incorrectly limited them
// to `string`, causing type issues after the d3 simulation replaces string IDs
// with D3Node objects.
export interface D3Link extends d3.SimulationLinkDatum<D3Node> {}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

// MAS Types
export interface ProposedChange {
    thought: string;
    action: string;
    filePath: string;
    newCode: string;
}

export type CriticRole = 'Security' | 'Efficiency' | 'Clarity';

export interface CriticFeedback {
    role: CriticRole;
    score: number; // e.g., 1-10
    feedback: string;
}
