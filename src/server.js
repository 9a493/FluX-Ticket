import express from 'express';
import logger from './utils/logger.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});

// Bot status endpoint
app.get('/status', (req, res) => {
    res.status(200).json({
        status: 'Bot is running',
        environment: process.env.NODE_ENV,
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.status(200).send('Discord Ticket Bot is running! 🎫');
});

export function startHealthServer() {
    app.listen(PORT, () => {
        logger.info(`✅ Health check server started on port ${PORT}`);
    });
}

export default app;