AI Agent Upgrade Project Plan
Phase 1: Core Functionality & Autonomy
Goal: Establish the agent's fundamental tools for interacting with the world and give the user basic control over its new autonomous behavior.

1. Implement Proxy-Based Web Access
Feature: Create the [ACTION] READ_URL_CONTENT "https://..." tool.

Implementation:

Create a local proxy server (e.g., proxy-server.js) using Node.js, Express, node-fetch, and cors.

This server will run on a separate port (e.g., 3001). It must accept a ?url= query parameter.

The server fetches the content from the target URL and returns the raw text.

In App.tsx, modify executeAction to handle READ_URL_CONTENT. This action will fetch the local proxy (http://localhost:3001/proxy?url=...).

Log the returned text to the [SYSTEM] log for the agent to read.

2. Implement Runtime Health Check
Feature: Create the [ACTION] CHECK_PREVIEW_HEALTH tool.

Implementation:

In preview.html, wrap the bootloader script's customRequire('/index.tsx') call in a try...catch block.

If an error is caught, post a message to the parent: window.parent.postMessage({ type: 'PREVIEW_ERROR', error: error.message }, '*').

In App.tsx, create a state const [previewError, setPreviewError] = useState(null);.

Add a useEffect to listen for PREVIEW_ERROR messages and update this state.

In executeAction, add the CHECK_PREVIEW_HEALTH case. It checks previewError and logs either a [SYSTEM] Preview health check: OK or [SYSTEM] Preview health check: FAILED. Error: ${previewError}.

3. Implement Autonomous Mode & Controls
Feature: Add core controls for autonomous operation.

Implementation:

Autonomous Mode: In SettingsTab.tsx, add an "Autonomous Mode" toggle that uses useLocalStorage. In App.tsx, if this is true, automatically set agentStatus to RUNNING on load.

Pause/Resume: In WatchAiTab.tsx, rename "Start" to "Resume" and "Stop" to "Pause." Update the UI logic to show "Pause" only when RUNNING and "Resume" when PAUSED or IDLE.

Hard Reset: In SettingsTab.tsx, add a "Reset Agent State" button. On confirm, it clears all ai-... keys from localStorage and reloads the page.

4. Implement Forceful Error Feedback
Feature: Ensure the agent acknowledges and fixes its own syntax errors.

Implementation:

In App.tsx, locate the catch (error: any) block for the Babel health check (in REWRITE_CODE and SAVE_FILE).

After logging the existing error, add a new, forceful log message: addLogMessage(LogMessageAuthor.SYSTEM, "Your last code action failed the syntax health check. You MUST fix this error. Do not try another action until the syntax is corrected. Error: " + error.message);.

Phase 2: Enhanced Observability & UI
Goal: Make the agent's internal state, plans, and actions "visually appealing" and easy to monitor from anywhere in the app.

1. Implement Live Task List UI
Feature: Visually display the AI's [TASK_LIST] in real-time.

Implementation:

In App.tsx, create const [currentTasks, setCurrentTasks] = useLocalStorage<string[]>('ai-task-list', []);.

In runMainAILoop, parse the [TASK_LIST] from the AI's response and save the list to this new state.

Create components/TaskListDisplay.tsx to render this array as a styled checklist.

In WatchAiTab.tsx, replace the currentTask string with this new <TaskListDisplay /> component.

2. Implement Persistent AI Status Bar
Feature: Show the agent's current task/status on all tabs.

Implementation:

In App.tsx, modify the header (with the nav tabs) to include a right-aligned element.

This element will display the currentTask state (which should now be the primary task from the TaskListDisplay): <strong>AI Status:</strong> <span className="italic text-indigo-300">{currentTask}</span>.

3. Implement Interactive VFS File Tree & Feedback
Feature: Upgrade the VFS list to a collapsible tree with rich visual feedback.

Implementation:

File Tree: Create components/FileTree.tsx. This component will parse the virtualFileSystem object keys into a tree structure and render it as a collapsible <ul>/<li> list. Replace the flat list in WebGraphTab.tsx with this.

"AI Focus" Highlight: In App.tsx, create const [currentFocusFile, setCurrentFocusFile] = useState(null);. When READ_FILE is executed, set this state to the file path. On any other action, set it to null. Pass this to FileTree.tsx and apply a "glowing" CSS class to the matching file.

"File System Heatmap": In App.tsx, create a useLocalStorage object to track edit counts (ai-file-edits). Increment the count for a file in executeAction on a successful REWRITE_CODE. Pass this data to FileTree.tsx and use it to apply a dynamic background color (e.g., blue -> yellow -> red) based on the edit count.

4. Implement Code Readability Upgrades
Feature: Add syntax highlighting and improve the graph's data density.

Implementation:

Syntax Highlighting: Install a library like react-syntax-highlighter. Apply it to the code in CodeDiffTab.tsx and the modals in WebGraphTab.tsx (for VFS viewing and node diffs).

Informative Graph Nodes: Pre-calculate the diffSummary (lines added/removed) for every node. In WebGraphTab.tsx, modify the D3 node text rendering to display v{version}, +${added} (green), and -${removed} (red).

5. Implement UI/UX Polish
Feature: Connect UI components and make invisible limits visible.

Implementation:

Logs-to-Graph Linking: In WatchAiTab.tsx, make the version number in "System updated to vX" log messages a link. On click, it should call setActiveTab('graph') and open the modal for that specific node.

Live Preview Notifications: In App.tsx, create const [previewNeedsRefresh, setPreviewNeedsRefresh] = useState(false);. Set this to true on a successful REWRITE_CODE. Pass this to the "Live Preview" TabButton, which should show a pulsing dot if true.

Visual Quota Manager: In SettingsTab.tsx, display progress bars for the AIMode.FREE limits (RPM, RPD, TPM) by tracking usage data from quotaManager.ts.

Phase 3: Advanced Multi-Agent System (MAS)
Goal: Refactor the core logic from a single agent into a "social reasoning" system of multiple, specialized agents to improve quality and speed.

1. Implement Multi-Agent Control Panel
Feature: Create a new UI to manage the MAS.

Implementation:

Create components/MultiAgentTab.tsx.

This tab will have:

Inputs for each agent's API key (defaulting to the main key).

Enable/disable toggles for each agent (e.g., "Enable Critic Team").

A "View Prompt" button to show the agent's core instructions.

2. Implement Core MAS Agents
Feature: Create the specialized agents for the new workflow.

Implementation:

Create new functions in geminiService.ts for each agent: runPlannerAgent, runResearcherAgent, runCriticAgent, runSynthesizerAgent, runNudgerAgent.

Planner: Writes to plan.md.

Proposer (Worker): Your existing runAIAgentTurn, but now it only executes the plan.

Critic_Team: Create 3 "personalities" for runCriticAgent (Security, Efficiency, Clarity) that run in parallel.

Synthesizer: Takes the Proposer's code and all Critic feedback and outputs a final [APPROVE_CODE] or [REJECT_CODE] [CONSOLIDATED_FEEDBACK].

Researcher: Only uses Google Search and READ_URL_CONTENT.

Nudger: A simple agent that runs periodically to suggest a "wildcard" task to the Planner.

3. Refactor to a Multi-Agent State Machine
Feature: Update App.tsx to manage the new agent workflow.

Implementation:

Expand agentStatus to: 'IDLE', 'PLANNING', 'WORKING', 'RESEARCHING', 'REVIEWING', 'SYNTHESIZING', 'EXECUTING'.

Rewrite runMainAILoop to be a state machine that calls the correct agent based on the current status (e.g., 'PLANNING' calls runPlannerAgent, 'REVIEWING' calls the Critic_Team, etc.).

4. Implement MAS Visual Feedback
Feature: Visually distinguish between agents.

Implementation:

Agent Status Panel (LEDs): Create a new persistent UI panel with "LED" lights for each agent. The "LED" for the currently active agent (based on agentStatus) should glow.

Multi-Agent Logs: In WatchAiTab.tsx, update LogEntry to show which agent "spoke" (e.g., [PLANNER] [THOUGHT], [CRITIC-SECURITY] [REJECT]). Assign each a unique color.

Phase 4: Goal-Oriented Features (Profit & Testing)
Goal: Build the final features that use the MAS to achieve the end goal of profitability and self-improvement.

1. Implement Self-Modifying Prompts
Feature: Allow the AI to edit its own core instructions.

Implementation:

Move the main prompt from geminiService.ts into a VFS file: /agent/core_prompt.md.

Create separate prompt files for each new agent (e.g., /agent/prompts/planner.md, /agent/prompts/critic_security.md).

Modify the service functions to read their prompts from the VFS.

The Planner agent can now be tasked with REWRITE_CODE "/agent/prompts/..." to improve the entire MAS.

2. Implement Test-Driven Development (TDD)
Feature: Create the [ACTION] RUN_TEST "..." tool.

Implementation:

Create const [testResults, setTestResults] = useLocalStorage('ai-test-results', []);.

In executeAction, add the RUN_TEST case. It will take the agent's JavaScript test code (as a string) and execute it inside the preview.html iframe using postMessage.

The iframe will run the test and postMessage back the "success" or "fail" result, which is stored in testResults.

The agent can now read its test results to verify its own code.

3. Implement Financial Tracking
Feature: Build the "Finance" tab and its associated tools.

Implementation:

Create components/FinanceTab.tsx.

Create const [transactions, setTransactions] = useLocalStorage('ai-ledger', []);.

The FinanceTab.tsx will display this list and a running total balance. Use D3 to add a simple chart.

Create the [ACTION] LOG_TRANSACTION "TYPE" AMOUNT "MEMO" tool.

In executeAction, add this case, which will parse the action and add a new transaction object to the transactions state.