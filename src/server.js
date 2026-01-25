import express from 'express';
import { guildDB, ticketDB, statsDB, categoryDB, cannedDB, apiKeyDB } from './utils/database.js';
import logger from './utils/logger.js';

const app = express();
const PORT = process.env.PORT || 3000;
const API_PREFIX = '/api/v1';

// Middleware
app.use(express.json());

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// API Key Authentication Middleware
async function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized', message: 'API key required' });
    }

    const apiKey = authHeader.substring(7);
    const keyData = await apiKeyDB.validate(apiKey);

    if (!keyData) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired API key' });
    }

    req.apiKey = keyData;
    req.guildId = keyData.guildId;
    next();
}

// Check permission middleware
function requirePermission(permission) {
    return (req, res, next) => {
        const permissions = req.apiKey.permissions.split(',');
        if (permissions.includes('admin') || permissions.includes(permission)) {
            return next();
        }
        return res.status(403).json({ error: 'Forbidden', message: `Permission '${permission}' required` });
    };
}

// ==================== HEALTH ====================
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        version: '2.0.0'
    });
});

app.get('/', (req, res) => {
    res.json({
        name: 'FluX Ticket Bot API',
        version: '2.0.0',
        docs: '/api/v1/docs'
    });
});

// ==================== API DOCS ====================
app.get(`${API_PREFIX}/docs`, (req, res) => {
    res.json({
        version: '2.0.0',
        baseUrl: API_PREFIX,
        authentication: 'Bearer token in Authorization header',
        endpoints: {
            guild: {
                'GET /guild': 'Get guild settings',
                'PUT /guild': 'Update guild settings'
            },
            tickets: {
                'GET /tickets': 'List tickets (query: status, userId, limit)',
                'GET /tickets/:id': 'Get ticket by ID',
                'GET /tickets/channel/:channelId': 'Get ticket by channel ID'
            },
            stats: {
                'GET /stats': 'Get guild statistics',
                'GET /stats/staff/:userId': 'Get staff statistics'
            },
            categories: {
                'GET /categories': 'List categories',
                'POST /categories': 'Create category',
                'PUT /categories/:id': 'Update category',
                'DELETE /categories/:id': 'Delete category'
            },
            canned: {
                'GET /canned': 'List canned responses',
                'POST /canned': 'Create canned response',
                'DELETE /canned/:name': 'Delete canned response'
            }
        }
    });
});

// ==================== GUILD ====================
app.get(`${API_PREFIX}/guild`, authenticate, async (req, res) => {
    try {
        const guild = await guildDB.getOrCreate(req.guildId, 'Unknown');
        res.json({
            id: guild.id,
            name: guild.name,
            locale: guild.locale,
            ticketCount: guild.ticketCount,
            maxTicketsPerUser: guild.maxTicketsPerUser,
            autoCloseHours: guild.autoCloseHours,
            dmNotifications: guild.dmNotifications,
            createdAt: guild.createdAt
        });
    } catch (error) {
        logger.error('API guild error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.put(`${API_PREFIX}/guild`, authenticate, requirePermission('write'), async (req, res) => {
    try {
        const allowedFields = ['maxTicketsPerUser', 'autoCloseHours', 'dmNotifications', 'locale', 'welcomeMessage'];
        const updateData = {};

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        }

        const guild = await guildDB.update(req.guildId, updateData);
        res.json({ success: true, guild });
    } catch (error) {
        logger.error('API guild update error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ==================== TICKETS ====================
app.get(`${API_PREFIX}/tickets`, authenticate, async (req, res) => {
    try {
        const { status, userId, limit = 50 } = req.query;
        
        let tickets;
        if (status && status !== 'all') {
            tickets = await ticketDB.getTicketsByStatus(req.guildId, status);
        } else {
            tickets = await ticketDB.getAllTickets(req.guildId);
        }

        if (userId) {
            tickets = tickets.filter(t => t.userId === userId);
        }

        tickets = tickets.slice(0, parseInt(limit));

        res.json({
            count: tickets.length,
            tickets: tickets.map(t => ({
                id: t.id,
                ticketNumber: t.ticketNumber,
                channelId: t.channelId,
                userId: t.userId,
                status: t.status,
                priority: t.priority,
                claimedBy: t.claimedBy,
                messageCount: t.messageCount,
                createdAt: t.createdAt,
                closedAt: t.closedAt
            }))
        });
    } catch (error) {
        logger.error('API tickets error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get(`${API_PREFIX}/tickets/channel/:channelId`, authenticate, async (req, res) => {
    try {
        const ticket = await ticketDB.get(req.params.channelId);
        
        if (!ticket || ticket.guildId !== req.guildId) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        res.json(ticket);
    } catch (error) {
        logger.error('API ticket channel error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ==================== STATS ====================
app.get(`${API_PREFIX}/stats`, authenticate, async (req, res) => {
    try {
        const stats = await statsDB.getDetailed(req.guildId);
        res.json(stats);
    } catch (error) {
        logger.error('API stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get(`${API_PREFIX}/stats/staff/:userId`, authenticate, async (req, res) => {
    try {
        const stats = await ticketDB.getStaffStats(req.guildId, req.params.userId);
        res.json(stats);
    } catch (error) {
        logger.error('API staff stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ==================== CATEGORIES ====================
app.get(`${API_PREFIX}/categories`, authenticate, async (req, res) => {
    try {
        const categories = await categoryDB.getAll(req.guildId);
        res.json({ count: categories.length, categories });
    } catch (error) {
        logger.error('API categories error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post(`${API_PREFIX}/categories`, authenticate, requirePermission('write'), async (req, res) => {
    try {
        const { name, emoji, description, color } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        const category = await categoryDB.create(req.guildId, name, { emoji, description, color });
        res.status(201).json(category);
    } catch (error) {
        logger.error('API category create error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.put(`${API_PREFIX}/categories/:id`, authenticate, requirePermission('write'), async (req, res) => {
    try {
        const category = await categoryDB.update(req.params.id, req.body);
        res.json(category);
    } catch (error) {
        logger.error('API category update error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete(`${API_PREFIX}/categories/:id`, authenticate, requirePermission('write'), async (req, res) => {
    try {
        await categoryDB.delete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        logger.error('API category delete error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ==================== CANNED RESPONSES ====================
app.get(`${API_PREFIX}/canned`, authenticate, async (req, res) => {
    try {
        const responses = await cannedDB.getAll(req.guildId);
        res.json({ count: responses.length, responses });
    } catch (error) {
        logger.error('API canned error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post(`${API_PREFIX}/canned`, authenticate, requirePermission('write'), async (req, res) => {
    try {
        const { name, content } = req.body;
        
        if (!name || !content) {
            return res.status(400).json({ error: 'Name and content are required' });
        }

        const response = await cannedDB.create(req.guildId, name, content, 'API');
        res.status(201).json(response);
    } catch (error) {
        logger.error('API canned create error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete(`${API_PREFIX}/canned/:name`, authenticate, requirePermission('write'), async (req, res) => {
    try {
        await cannedDB.delete(req.guildId, req.params.name);
        res.json({ success: true });
    } catch (error) {
        logger.error('API canned delete error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ==================== ERROR HANDLER ====================
app.use((err, req, res, next) => {
    logger.error('API Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ==================== START SERVER ====================
export function startHealthServer() {
    app.listen(PORT, () => {
        logger.info(`✅ API Server started on port ${PORT}`);
    });
}

export default app;
