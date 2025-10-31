
# Autonomous Multi-Agent System (MAS)

[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/) [![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/) [![Gemini API](https://img.shields.io/badge/Google-Gemini%20API-4285F4?logo=google)](https://ai.google.dev/) [![Node.js](https://img.shields.io/badge/Node.js-Proxy-green?logo=nodedotjs)](https://nodejs.org/)

This project is a browser-based environment for a sophisticated, self-improving AI agent. The agent operates as a **Multi-Agent System (MAS)**, where a team of specialized AI agents collaborate to understand, plan, and execute complex tasks. Its primary directive, outlined in `upgrades.md`, is to continuously improve its own source code to become more capable and autonomous.

The entire application runs in your browser, using `localStorage` to create a sandboxed **Virtual File System (VFS)** where the agent can read and rewrite its own code. You can watch the agent's thought process in real-time, inspect its code changes, and even intervene to guide its development.

---

## Core Features

-   **Self-Modification**: The agent can read, write, and rewrite its own React/TypeScript source code within its sandboxed VFS.
-   **Multi-Agent Architecture**: A team of specialized agents (Planner, Researcher, Proposer, Critic Team, Synthesizer, Nudger) collaborate for more robust and high-quality reasoning.
-   **Web Access**: Can access and read content from external URLs for research using a secure local proxy server.
-   **Persistent Memory & Evolution**: Uses browser `localStorage` to save its entire state, including code versions, learned memories, and the virtual file system, allowing it to learn and evolve across sessions.
-   **Rich Observability UI**:
    -   **Web Graph**: Visualizes the agent's code evolution, showing every version and the thought process behind it.
    -   **Live Preview**: An embedded iframe that runs the agent's current codebase, allowing you and the agent to see changes live.
    -   **MAS Control Panel**: A dedicated tab to configure the agent team, toggle specialists, and view their core prompts.
    -   **Status LEDs & Logs**: Real-time visual feedback on which agent is currently active and a detailed, color-coded log of the "conversation" between them.
-   **User Control & Configuration**:
    -   Full control to **Pause** and **Resume** the agent's cognitive loop.
    -   **Autonomous Mode** for the agent to start working on page load.
    -   Fine-grained API key management, including per-agent keys.

---

## How It Works: The Architecture

This project has two main parts: the **React frontend application** where the agent lives, and a **local Node.js proxy server** that gives it access to the web.



1.  **Browser-Based Environment**: The entire application is a static React/TypeScript project. When first loaded, it fetches its own source files and populates a **Virtual File System (VFS)** within your browser's `localStorage`. This becomes the agent's sandboxed "hard drive."

2.  **The MAS Cognitive Loop**: The agent's "thinking" is a state machine that cycles through its specialized agents:
    -   **PLANNING**: The **Planner** agent analyzes the main goal (`upgrades.md`) and the current state, then creates or updates a step-by-step plan (`/agent/plan.md`).
    -   **RESEARCHING**: If a task requires external information, the **Researcher** agent uses Google Search (via the proxy) to find it.
    -   **PROPOSING**: The **Proposer** agent reads the plan and writes a specific code change to accomplish the next task.
    -   **CRITICIZING**: A **Critic Team** (Security, Efficiency, Clarity) reviews the proposed code in parallel, providing scores and feedback. This step can be disabled.
    -   **SYNTHESIZING**: The **Synthesizer** agent reviews the criticisms and makes a final `APPROVE` or `REJECT` decision.
    -   **EXECUTING**: If approved, the system applies the code change to the VFS. This creates a new version node in the Web Graph. The loop then repeats.

3.  **Local Proxy Server**: To overcome browser security restrictions (CORS), the `READ_URL_CONTENT` action is routed through a simple Node.js proxy server. The agent asks the local server to fetch a URL, and the server returns the content. **This proxy must be running locally for the agent's research capabilities to function.**

---

## Getting Started: How to Run

### Prerequisites

-   [Node.js](https://nodejs.org/) (which includes npm) installed on your machine.
-   A text editor like [VS Code](https://code.visualstudio.com/) with a live server extension is recommended for the best experience.

### Step 1: Get a Gemini API Key

The agent uses the Google Gemini API for its reasoning.
1.  Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
2.  Create a new API key.
3.  **Important:** Make sure the project associated with your API key has **billing enabled** in the Google Cloud Console, as the agent uses high-capacity models that require it.
4.  Copy the API key. You will enter this in the application's UI, not in the code.

### Step 2: Run the Local Proxy Server

This server is essential for the agent's web research capabilities. It must be running in the background.

1.  Open a new terminal window.
2.  Navigate to the `proxy-server` directory:
    ```bash
    cd proxy-server
    ```
3.  Install its dependencies:
    ```bash
    npm install
    ```
4.  Start the server:
    ```bash
    npm start
    ```
You should see `CORS Proxy server running on http://localhost:3001`. **Leave this terminal window open.**

### Step 3: Run the Main Application

The main application is a static website. You just need to serve the files from the root directory.

1.  Open a **second terminal window**.
2.  Navigate to the project's **root directory** (the one containing `index.html`).
3.  The easiest way to serve the files is with a simple tool like `serve`:
    ```bash
    # First, install serve globally if you haven't already
    npm install -g serve

    # Then, serve the current directory
    serve .
    ```
4.  Your terminal will give you a local URL, typically `http://localhost:3000`. Open this URL in your web browser.

> **Alternative:** If you are using VS Code, you can install the **"Live Server"** extension. After installing, just right-click on the `index.html` file in the file explorer and choose "Open with Live Server".

---

## Usage Guide

1.  **First-Time Setup**: Once the application is open in your browser, navigate to the **Settings** tab.
    -   Enter your Gemini API key from Step 1 into the input field.
    -   Click **Save Key**.
    -   (Recommended) Enable **Paid Mode**. This uses a more powerful model (`gemini-2.5-pro`) and has much higher rate limits, allowing the agent to think more effectively. Free mode is heavily restricted and may not be sufficient for complex tasks.

2.  **Start the Agent**:
    -   Go to the **Watch AI** tab.
    -   Click the **Resume** button. The agent will begin its cognitive loop, starting with the `PLANNING` phase.
    -   Alternatively, go to **Settings** and enable **Autonomous Mode**, then reload the page. The agent will start automatically.

3.  **Observe and Explore**:
    -   **Watch AI**: Follow the agent's real-time thought process and actions in the log.
    -   **Web Graph**: See the agent's code evolution visually. Click on any node to see the exact code change and the reasoning behind it.
    -   **Multi-Agent**: View the architecture, enable/disable agents like the Critic Team, and inspect the prompts that define their behavior.
    -   **Live Preview**: See a live, running version of the application with the agent's latest code changes applied.

Enjoy watching your autonomous AI agent learn, reason, and evolve!
