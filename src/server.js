import express from 'express';
import logger from './utils/logger.js';

const app = express();
const PORT = process.env.PORT || 3000;

// JSON body parser
app.use(express.json());

// Health check endpoint (Render, Railway için)
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
        },
    });
});

// Bot status endpoint
app.get('/status', (req, res) => {
    const uptimeSeconds = process.uptime();
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);

    res.status(200).json({
        status: 'running',
        environment: process.env.NODE_ENV || 'development',
        uptime: `${days}d ${hours}h ${minutes}m`,
        version: '2.0.0',
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>FluX Ticket Bot</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, sans-serif;
                    background: linear-gradient(135deg, #5865F2, #7289da);
                    color: white;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                }
                .container {
                    text-align: center;
                    background: rgba(0,0,0,0.2);
                    padding: 40px;
                    border-radius: 15px;
                }
                h1 { margin: 0 0 10px 0; font-size: 2.5em; }
                p { margin: 5px 0; opacity: 0.9; }
                .status { 
                    display: inline-block;
                    background: #57F287;
                    padding: 5px 15px;
                    border-radius: 20px;
                    margin-top: 20px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🎫 FluX Ticket Bot</h1>
                <p>Discord Ticket Sistemi</p>
                <p>Version 2.0.0</p>
                <div class="status">✅ Çalışıyor</div>
            </div>
        </body>
        </html>
    `);
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
    logger.error('Express error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

export function startHealthServer() {
    app.listen(PORT, () => {
        logger.info(`✅ Health check server başlatıldı: http://localhost:${PORT}`);
    });
}

export default app;
