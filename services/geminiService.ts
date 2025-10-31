import { GoogleGenAI, GenerateContentResponse, Chat } from '@google/genai';
import { AI_MODEL_PRO, AI_MODEL_FLASH } from '../constants';
import { LogMessage, AIMode, LearnedMemory, CriticRole, CriticFeedback } from '../types';
import { PLANNER_PROMPT, PROPOSER_PROMPT, CRITIC_PROMPT, SYNTHESIZER_PROMPT, RESEARCHER_PROMPT, NUDGER_PROMPT } from '../prompts';


const getApiKey = (userApiKey: string | null): string => {
  return userApiKey || (process.env.API_KEY as string);
};

const callGenerativeAI = async (
    apiKey: string | null,
    modelName: string,
    prompt: string,
    useSearch: boolean = false
): Promise<GenerateContentResponse> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey(apiKey) });
    const thinkingBudget = modelName === AI_MODEL_PRO ? 32768 : 24576;

    const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
            tools: useSearch ? [{googleSearch: {}}] : undefined,
            thinkingConfig: { thinkingBudget }
        }
    });

    return response;
};


export const runPlannerAgent = async (
    agentApiKey: string | null,
    aiMode: AIMode,
    history: LogMessage[],
    learnedMemories: LearnedMemory[],
    currentPlan: string,
    coreDirective: string,
): Promise<GenerateContentResponse> => {
    const modelName = aiMode === AIMode.PAID ? AI_MODEL_PRO : AI_MODEL_FLASH;
    const historyStr = history.map(msg => `[${msg.author}] ${msg.content}`).join('\n');
    const memoriesStr = learnedMemories.map(mem => `- [${mem.type}] CONTEXT: ${mem.context} | OUTCOME: ${mem.outcome} | LEARNING: ${mem.learning}`).join('\n');
    const prompt = PLANNER_PROMPT(coreDirective, currentPlan, historyStr, memoriesStr);
    return callGenerativeAI(agentApiKey, modelName, prompt);
};


export const runProposerAgent = async (
  agentApiKey: string | null,
  aiMode: AIMode,
  history: LogMessage[],
  learnedMemories: LearnedMemory[],
  consecutiveSearches: number,
  currentPlan: string,
  rejectionFeedback?: string | null
): Promise<GenerateContentResponse> => {
    const modelName = aiMode === AIMode.PAID ? AI_MODEL_PRO : AI_MODEL_FLASH;

    const searchConstraint = consecutiveSearches >= 3 
        ? `You have reached the search limit of 3. You MUST use REWRITE_CODE, READ_FILE, or LIST_FILES. Your thought process should focus on what code change to make based on your previous searches.`
        : `You have performed ${consecutiveSearches} consecutive searches. You can perform a maximum of 3 before you MUST use a code or file action.`;

    const feedbackBlock = rejectionFeedback
        ? `**CRITICAL FEEDBACK FROM PREVIOUS ATTEMPT:**
           Your last proposed change was rejected by the Synthesizer agent. You MUST address this feedback directly in your new proposal.
           \`\`\`
           ${rejectionFeedback}
           \`\`\``
        : '';
    
    const historyStr = history.map(msg => `[${msg.author}] ${msg.content}`).join('\n');
    const memoriesStr = learnedMemories.map(mem => `- [${mem.type}] CONTEXT: ${mem.context} | OUTCOME: ${mem.outcome} | LEARNING: ${mem.learning}`).join('\n');
    const prompt = PROPOSER_PROMPT(currentPlan, searchConstraint, feedbackBlock, memoriesStr, historyStr);
    
    return callGenerativeAI(agentApiKey, modelName, prompt, true);
};


export const runCriticAgent = async (
    agentApiKey: string | null,
    aiMode: AIMode,
    role: CriticRole,
    proposedChange: string,
): Promise<GenerateContentResponse> => {
    const modelName = AI_MODEL_FLASH; // Critics can be faster models

    const prompts = {
        Security: `You are a "Security" critic. Your sole focus is to review the proposed code change for any potential security vulnerabilities.
        - **Check for:** XSS, CSRF, command injection, insecure dependencies, hardcoded secrets, improper data handling, etc.
        - **Be meticulous.** Assume any user input is malicious.
        - **Provide a score from 1 (critical flaws) to 10 (secure).**`,
        Efficiency: `You are an "Efficiency" critic. Your sole focus is to review the proposed code change for performance and scalability.
        - **Check for:** Algorithmic complexity (Big O), unnecessary re-renders, memory leaks, inefficient loops, bundle size impact, slow API calls.
        - **Think about performance at scale.** Will this code be slow with 10,000 items?
        - **Provide a score from 1 (highly inefficient) to 10 (highly optimized).**`,
        Clarity: `You are a "Clarity" critic. Your sole focus is to review the proposed code change for readability, maintainability, and adherence to best practices.
        - **Check for:** "Code smell", confusing logic, lack of comments, inconsistent naming, overly complex functions, non-standard patterns.
        - **Ask "Could a new developer understand this easily?"** Is the code self-documenting?
        - **Provide a score from 1 (unreadable) to 10 (perfectly clear).**`
    };

    const prompt = CRITIC_PROMPT(role, prompts, proposedChange);
    return callGenerativeAI(agentApiKey, modelName, prompt);
};

export const runSynthesizerAgent = async (
    agentApiKey: string | null,
    aiMode: AIMode,
    proposedChange: string,
    criticisms: CriticFeedback[]
): Promise<GenerateContentResponse> => {
    const modelName = aiMode === AIMode.PAID ? AI_MODEL_PRO : AI_MODEL_FLASH;
    const criticismsStr = criticisms.map(c => `
      - **${c.role} Critic Score:** ${c.score}/10
      - **Feedback:** ${c.feedback}
      `).join('');
    
    const prompt = SYNTHESIZER_PROMPT(proposedChange, criticismsStr);
    return callGenerativeAI(agentApiKey, modelName, prompt);
};

export const runResearcherAgent = async (
    agentApiKey: string | null,
    aiMode: AIMode,
    task: string,
    history: LogMessage[]
): Promise<GenerateContentResponse> => {
    const modelName = AI_MODEL_FLASH; // Researcher can be a faster model
    const historyStr = history.map(msg => `[${msg.author}] ${msg.content}`).join('\n');
    const prompt = RESEARCHER_PROMPT(task, historyStr);
    return callGenerativeAI(agentApiKey, modelName, prompt, true);
};

export const runNudgerAgent = async (
    agentApiKey: string | null,
    aiMode: AIMode,
    currentPlan: string
): Promise<GenerateContentResponse> => {
    const modelName = AI_MODEL_FLASH;
    const prompt = NUDGER_PROMPT(currentPlan);
    return callGenerativeAI(agentApiKey, modelName, prompt);
};


export const validateApiKey = async (apiKey: string): Promise<{ valid: boolean, error?: string }> => {
    if (!apiKey) {
        return { valid: false, error: "API key cannot be empty." };
    }
    try {
        const ai = new GoogleGenAI({ apiKey });
        // Make a simple, low-cost call to check if the key is valid and billing is enabled.
        await ai.models.generateContent({
            model: AI_MODEL_FLASH,
            contents: 'hello',
        });
        return { valid: true };
    } catch (error: any) {
        console.error("API Key Validation Error:", error);
        let errorMessage = "An unknown error occurred during validation.";
        if (error.message) {
            if (error.message.includes('API key not valid')) {
                errorMessage = 'The provided API key is not valid. Please check the key and try again.';
            } else if (error.message.includes('billing')) {
                errorMessage = 'Your project is missing billing information. Please enable billing in the Google Cloud Console.';
            } else {
                errorMessage = error.message;
            }
        }
        return { valid: false, error: errorMessage };
    }
};


export const createChat = (userApiKey: string | null): Chat => {
    const ai = new GoogleGenAI({ apiKey: getApiKey(userApiKey) });
    return ai.chats.create({
        model: AI_MODEL_FLASH,
    });
};

export const sendChatMessage = async (chat: Chat, message: string): Promise<string> => {
    const response = await chat.sendMessage({ message });
    return response.text;
};