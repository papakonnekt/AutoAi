// A simple Node.js Express server to act as a CORS proxy for the AI agent.
// This allows the agent to use the READ_URL_CONTENT action when the app is hosted locally.

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = 3001; // Port for the proxy server

app.use(cors());

app.get('/proxy', async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).send('URL parameter is required');
    }

    try {
        console.log(`[Proxy] Fetching URL: ${url}`);
        const response = await axios.get(url, {
            headers: {
                // Mimic a browser user agent to avoid simple bot blockers
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 10000 // 10 second timeout
        });
        
        // Return the content of the fetched page
        res.send(response.data);
        console.log(`[Proxy] Successfully fetched content from ${url}`);

    } catch (error) {
        console.error(`[Proxy] Error fetching URL: ${url}`, error.message);
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            res.status(error.response.status).send(error.response.data);
        } else if (error.request) {
            // The request was made but no response was received
            res.status(504).send('Gateway Timeout: No response from upstream server.');
        } else {
            // Something happened in setting up the request that triggered an Error
            res.status(500).send(`Internal Server Error: ${error.message}`);
        }
    }
});

app.listen(PORT, () => {
    console.log(`CORS Proxy server running on http://localhost:${PORT}`);
    console.log('Ready to help the AI agent browse the web!');
});
