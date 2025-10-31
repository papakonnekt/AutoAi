# AI Agent - CORS Proxy Server

This simple Node.js server acts as a proxy to allow the AI agent's `READ_URL_CONTENT` action to function correctly. It bypasses browser-based CORS (Cross-Origin Resource Sharing) restrictions by fetching the content on the server-side and forwarding it to the agent.

## Why is this needed?

Web browsers have a security feature that prevents a script on one domain from making a request to another domain. Since the AI agent application runs entirely in your browser, any attempt it makes to directly fetch content from an external URL will be blocked.

This proxy server solves the problem. The agent makes a request to this local server, which is not bound by the same browser restrictions. The server then fetches the external URL on the agent's behalf and returns the content.

## Setup

1.  **Navigate to this directory:**
    Open your terminal and change into the `proxy-server` directory.
    ```bash
    cd proxy-server
    ```

2.  **Install dependencies:**
    Use npm (or yarn) to install the required packages.
    ```bash
    npm install
    ```

## Running the Server

To start the proxy, run the following command from within the `proxy-server` directory:

```bash
npm start
```

You should see a message indicating that the server is running on `http://localhost:3001`.

**You must keep this server running in a separate terminal window while you are using the AI agent application for the `READ_URL_CONTENT` action to work.**
