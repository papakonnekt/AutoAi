import { GoogleGenAI, GenerateContentResponse, Chat } from '@google/genai';
import { AI_MODEL_PRO, AI_MODEL_FLASH } from '../constants';
import { LogMessage, AIMode, LearnedMemory, CriticRole, CriticFeedback } from '../types';

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
    userApiKey: string | null,
    aiMode: AIMode,
    history: LogMessage[],
    learnedMemories: LearnedMemory[],
    currentPlan: string,
    coreDirective: string,
): Promise<GenerateContentResponse> => {
    const modelName = aiMode === AIMode.PAID ? AI_MODEL_PRO : AI_MODEL_FLASH;
    const prompt = `
      You are the "Planner" agent in a Multi-Agent System. Your purpose is to act as the strategic mind, maintaining the project's master plan and ensuring the team stays on track. You do not write code.

      **Core Directive:**
      Your high-level goals are defined in the core directive. You must decompose these goals into a concrete, step-by-step plan.
      \`\`\`markdown
      ${coreDirective}
      \`\`\`

      **Current Master Plan:**
      This is the current state of the plan you must update.
      \`\`\`markdown
      ${currentPlan}
      \`\`\`

      **Rules of Engagement:**
      1.  **Analyze & Strategize:** Review the Core Directive, the Current Master Plan, and the recent history to understand the project's state.
      2.  **Decomposition:** Break down the highest-priority, incomplete goal from the Core Directive into smaller, actionable tasks.
      3.  **Update, Don't Replace:** Your output must be an updated version of the *entire* plan. Do not just output the changes. Mark completed tasks with \`[x]\` and add new tasks under the appropriate sections.
      4.  **Clarity is Key:** The tasks you write must be clear and unambiguous for the "Proposer" agent to execute. Each task should represent a single, logical unit of work.
      5.  **Focus on the "What", not the "How":** Define what needs to be done, but leave the implementation details to the Proposer.

      **Recent History:**
      ${history.map(msg => `[${msg.author}] ${msg.content}`).join('\n')}

      **Shared Learnings:**
      ${learnedMemories.map(mem => `- [${mem.type}] CONTEXT: ${mem.context} | OUTCOME: ${mem.outcome} | LEARNING: ${mem.learning}`).join('\n')}

      **Your Task:**
      Based on all the information above, output the updated master plan. Your action is to rewrite the \`/agent/plan.md\` file.

      **Response Format:**
      You MUST respond *only* with the following structure, including the tags:
      [THOUGHT]
      Your reasoning for the plan update. Analyze the current state and decide on the next most important steps. Explain which tasks you are marking as complete and which new tasks you are adding.
      [/THOUGHT]
      [ACTION]
      REWRITE_CODE "/agent/plan.md" \`\`\`markdown
      # AGENT'S PLAN
      ... (your complete, updated plan here) ...
      \`\`\`
      [/ACTION]
    `;

    return callGenerativeAI(userApiKey, modelName, prompt);
};


export const runProposerAgent = async (
  userApiKey: string | null,
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
        
    const prompt = `
      You are the "Proposer" agent, a software engineer in a Multi-Agent System. Your job is to execute the current task from the master plan by proposing a single, complete code change. Your work will be reviewed by a team of specialist critics.

      **Master Plan:**
      You must focus *only* on the highest-priority incomplete task.
      \`\`\`markdown
      ${currentPlan}
      \`\`\`
      
      ${feedbackBlock}

      **Cognitive Loop (Chain of Thought):**
      1.  **Identify Task:** What is the single most important task I need to accomplish from the plan?
      2.  **Information Gathering:** Do I need to use \`READ_FILE\`, \`LIST_FILES\`, or \`GOOGLE_SEARCH\` to get more context? (Respect the search limit: ${searchConstraint})
      3.  **Formulate Solution:** Based on my information, what is the best code change to complete the task? I will think through the implementation step-by-step.
      4.  **Construct Action:** I will write out the final, complete action (\`REWRITE_CODE\`, \`SAVE_FILE\`, etc.) that implements my solution. The code must be syntactically correct and complete.

      **Shared Learnings:**
      ${learnedMemories.map(mem => `- [${mem.type}] CONTEXT: ${mem.context} | OUTCOME: ${mem.outcome} | LEARNING: ${mem.learning}`).join('\n')}

      **Constraints & Rules:**
      *   You must propose exactly one action to make progress on the highest-priority task.
      *   Your proposed code must be complete and correct. It will be syntax-checked.
      
      **Available tools:**
      1. [ACTION] GOOGLE_SEARCH "your search query"
      2. [ACTION] LIST_FILES
      3. [ACTION] READ_FILE "/path/to/your/file.tsx"
      4. [ACTION] SAVE_FILE "/path/to/your/new-file.ts" \`\`\`typescript\n// your code for the new file here\n\`\`\`
      5. [ACTION] REWRITE_CODE "/path/to/your/file.tsx" \`\`\`typescript\n// your new code for the file here\n\`\`\`
      6. [ACTION] APPEND_TO_FILE "/path/to/file.log" \`\`\`\n// content to append here\n\`\`\`
      7. [ACTION] DELETE_FILE "/path/to/file.ts"
      8. [ACTION] MOVE_FILE "/path/to/source.ts" "/path/to/destination.ts"
      9. [ACTION] READ_URL_CONTENT "https://example.com/some/path"
      10. [ACTION] CHECK_PREVIEW_HEALTH
      
      **Recent History:**
      ${history.map(msg => `[${msg.author}] ${msg.content}`).join('\n')}

      **Response Format:**
      You MUST respond *only* with the following structure, including the tags:
      [THOUGHT]
      Your detailed reasoning following the Cognitive Loop. Explain which task you are working on, your plan, and why your proposed action is the correct next step. If you are addressing rejection feedback, explain how your new proposal fixes the issues.
      [/THOUGHT]
      [ACTION]
      Exactly one action to execute.
      [/ACTION]
    `;
    
    return callGenerativeAI(userApiKey, modelName, prompt, true);
};


export const runCriticAgent = async (
    userApiKey: string | null,
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

    const prompt = `
        **Your Role: ${role} Critic**
        ${prompts[role]}
        
        **Proposed Code Change to Review:**
        \`\`\`
        ${proposedChange}
        \`\`\`

        **Your Task:**
        1.  Analyze the code change from your specific perspective.
        2.  Provide a numeric score that quantifies your assessment.
        3.  Write a brief, actionable feedback statement. If you find issues, explain them clearly. If the code is good, state why.

        **Response Format:**
        You MUST respond *only* with the following structure:
        [SCORE]
        Your numeric score from 1 to 10.
        [/SCORE]
        [FEEDBACK]
        Your detailed feedback and reasoning.
        [/FEEDBACK]
    `;
    
    return callGenerativeAI(userApiKey, modelName, prompt);
};

export const runSynthesizerAgent = async (
    userApiKey: string | null,
    aiMode: AIMode,
    proposedChange: string,
    criticisms: CriticFeedback[]
): Promise<GenerateContentResponse> => {
    const modelName = aiMode === AIMode.PAID ? AI_MODEL_PRO : AI_MODEL_FLASH;
    const prompt = `
      You are the "Synthesizer" agent, acting as the team's lead engineer. Your role is to make the final decision on a proposed code change after reviewing feedback from a team of specialist critics.

      **Proposed Code Change:**
      \`\`\`
      ${proposedChange}
      \`\`\`

      **Critic Feedback:**
      ${criticisms.map(c => `
      - **${c.role} Critic Score:** ${c.score}/10
      - **Feedback:** ${c.feedback}
      `).join('')}

      **Cognitive Loop (Tree of Thought):**
      1.  **Assess Overall Quality:** What is the general sentiment from the critics? Are the scores high or low?
      2.  **Identify Critical Issues:** Is there any "veto" feedback? A critical security flaw (Security score < 5) or a major performance bottleneck (Efficiency score < 5) should almost always result in a rejection.
      3.  **Weigh Minor Issues:** If the issues are minor (e.g., clarity suggestions, micro-optimizations), can the change be approved as-is, or is it better to request a revision for quality?
      4.  **Formulate Decision:** Based on the analysis, I will make a final call: APPROVE or REJECT.
      5.  **Construct Consolidated Feedback:** 
          - If REJECTING, I must provide a clear, consolidated summary of the most important changes the Proposer needs to make. I will synthesize the critic feedback into a single, actionable to-do list.
          - If APPROVING, I will simply state the reason for approval (e.g., "High scores from all critics, no major issues found.").

      **Your Task:**
      Make the final decision. Your response will either trigger the code execution or send feedback back to the Proposer agent.

      **Response Format:**
      You MUST respond *only* with the following structure:
      [DECISION]
      APPROVE or REJECT
      [/DECISION]
      [REASON]
      Your consolidated feedback and reasoning, following the cognitive loop above.
      [/REASON]
    `;
    
    return callGenerativeAI(userApiKey, modelName, prompt);
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