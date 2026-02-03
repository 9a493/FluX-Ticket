import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import logger from './utils/logger.js';
import { prisma, apiKeyDB, guildDB, ticketDB, categoryDB, cannedDB, statsDB, transcriptDB, auditDB } from './utils/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== MIDDLEWARE ====================

// Security
app.use(helmet({
    contentSecurityPolicy: false, // Dashboard için
    crossOriginEmbedderPolicy: false,
}));

// CORS
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Compression
app.use(compression());

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files (Dashboard)
app.use(express.static(join(__dirname, '../public')));

// Rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 dakika
    max: 100, // IP başına max istek
    message: { error: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 saat
    max: 10, // IP başına max auth denemesi
    message: { error: 'Too many authentication attempts.' },
});

// ==================== API KEY AUTHENTICATION ====================

async function authenticateApiKey(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'API key required' });
    }

    const apiKey = authHeader.substring(7);
    
    try {
        const keyData = await apiKeyDB.validate(apiKey);
        
        if (!keyData) {
            return res.status(401).json({ error: 'Invalid or expired API key' });
        }

        req.apiKey = keyData;
        req.guildId = keyData.guildId;
        next();
    } catch (error) {
        logger.error('API authentication error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
}

// Permission check middleware
function requirePermission(permission) {
    return (req, res, next) => {
        const permissions = req.apiKey.permissions.split(',');
        
        if (permissions.includes('admin') || permissions.includes(permission)) {
            return next();
        }
        
        res.status(403).json({ error: `Permission denied. Required: ${permission}` });
    };
}

// ==================== PUBLIC ROUTES ====================

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        version: '2.1.0',
    });
});

// Root
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, '../public/index.html'));
});

// Public transcript view
app.get('/transcript/:id', async (req, res) => {
    try {
        const transcript = await transcriptDB.get(req.params.id);
        
        if (!transcript) {
            return res.status(404).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Transcript Not Found</title>
                    <style>
                        body { font-family: Inter, sans-serif; background: #0f172a; color: #e2e8f0; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                        .container { text-align: center; }
                        h1 { color: #ef4444; }
                        a { color: #8b5cf6; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>404 - Transcript Bulunamadı</h1>
                        <p>Bu transcript mevcut değil veya silinmiş olabilir.</p>
                        <a href="/">Ana Sayfaya Dön</a>
                    </div>
                </body>
                </html>
            `);
        }

        // HTML içeriği direkt gönder
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(transcript.htmlContent);
        
    } catch (error) {
        logger.error('Transcript fetch error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Public stats (genel istatistikler)
app.get('/api/public/stats', async (req, res) => {
    try {
        const totalGuilds = await prisma.guild.count();
        const totalTickets = await prisma.ticket.count();
        const totalClosed = await prisma.ticket.count({ where: { status: 'closed' } });
        
        res.json({
            guilds: totalGuilds,
            totalTickets,
            closedTickets: totalClosed,
            uptime: process.uptime(),
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// ==================== API V1 ROUTES (Authenticated) ====================

const apiV1 = express.Router();
apiV1.use(apiLimiter);
apiV1.use(authenticateApiKey);

// Guild
apiV1.get('/guild', async (req, res) => {
    try {
        const guild = await guildDB.get(req.guildId);
        res.json(guild);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch guild' });
    }
});

apiV1.put('/guild', requirePermission('write'), async (req, res) => {
    try {
        const allowedFields = ['locale', 'maxTicketsPerUser', 'autoCloseHours', 'dmNotifications', 'webhookUrl', 'welcomeMessage'];
        const data = {};
        
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                data[field] = req.body[field];
            }
        }

        const guild = await guildDB.update(req.guildId, data);
        res.json(guild);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update guild' });
    }
});

// Tickets
apiV1.get('/tickets', async (req, res) => {
    try {
        const { status, limit = 50, offset = 0 } = req.query;
        
        const tickets = await ticketDB.getByGuild(req.guildId, {
            status,
            limit: parseInt(limit),
            offset: parseInt(offset),
        });

        const total = await ticketDB.countByGuild(req.guildId, status);

        res.json({
            tickets,
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch tickets' });
    }
});

apiV1.get('/tickets/:id', async (req, res) => {
    try {
        const ticket = await ticketDB.getById(req.params.id);
        
        if (!ticket || ticket.guildId !== req.guildId) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        res.json(ticket);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch ticket' });
    }
});

// Categories
apiV1.get('/categories', async (req, res) => {
    try {
        const categories = await categoryDB.getAll(req.guildId, true);
        res.json({ categories });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

apiV1.post('/categories', requirePermission('write'), async (req, res) => {
    try {
        const { name, emoji, description, color, staffRoles } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        const category = await categoryDB.create(req.guildId, name, {
            emoji,
            description,
            color,
            staffRoles,
        });

        res.status(201).json(category);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create category' });
    }
});

apiV1.put('/categories/:id', requirePermission('write'), async (req, res) => {
    try {
        const category = await categoryDB.get(req.params.id);
        
        if (!category || category.guildId !== req.guildId) {
            return res.status(404).json({ error: 'Category not found' });
        }

        const updated = await categoryDB.update(req.params.id, req.body);
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update category' });
    }
});

apiV1.delete('/categories/:id', requirePermission('admin'), async (req, res) => {
    try {
        const category = await categoryDB.get(req.params.id);
        
        if (!category || category.guildId !== req.guildId) {
            return res.status(404).json({ error: 'Category not found' });
        }

        await categoryDB.delete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

// Stats
apiV1.get('/stats', async (req, res) => {
    try {
        const stats = await statsDB.getDetailed(req.guildId);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// Canned Responses
apiV1.get('/canned', async (req, res) => {
    try {
        const responses = await cannedDB.getAll(req.guildId);
        res.json({ responses });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch canned responses' });
    }
});

apiV1.post('/canned', requirePermission('write'), async (req, res) => {
    try {
        const { name, content } = req.body;
        
        if (!name || !content) {
            return res.status(400).json({ error: 'Name and content are required' });
        }

        const response = await cannedDB.create(req.guildId, name, content, req.apiKey.createdBy);
        res.status(201).json(response);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create canned response' });
    }
});

apiV1.delete('/canned/:id', requirePermission('write'), async (req, res) => {
    try {
        await cannedDB.delete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete canned response' });
    }
});

// Transcripts
apiV1.get('/transcripts', async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        
        const transcripts = await transcriptDB.getByGuild(req.guildId, {
            limit: parseInt(limit),
            offset: parseInt(offset),
        });

        res.json({ transcripts });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch transcripts' });
    }
});

apiV1.get('/transcripts/:id', async (req, res) => {
    try {
        const transcript = await transcriptDB.get(req.params.id);
        
        if (!transcript || transcript.guildId !== req.guildId) {
            return res.status(404).json({ error: 'Transcript not found' });
        }

        res.json(transcript);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch transcript' });
    }
});

// Audit Logs
apiV1.get('/audit', async (req, res) => {
    try {
        const { action, limit = 100, offset = 0 } = req.query;
        
        const logs = await auditDB.getByGuild(req.guildId, {
            action,
            limit: parseInt(limit),
            offset: parseInt(offset),
        });

        res.json({ logs });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

// Mount API
app.use('/api/v1', apiV1);

// ==================== ERROR HANDLING ====================

// 404
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
    logger.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ==================== SERVER START ====================

export function startServer(client) {
    // Discord client'ı global yap (scheduler için)
    global.discordClient = client;

    app.listen(PORT, () => {
        logger.info(`✅ Web server started on port ${PORT}`);
        logger.info(`📊 Dashboard: http://localhost:${PORT}`);
        logger.info(`🔗 API: http://localhost:${PORT}/api/v1`);
    });

    return app;
}

export function startHealthServer() {
    app.listen(PORT, () => {
        logger.info(`✅ Health check server started on port ${PORT}`);
    });
}

export default app;
