import express from 'express';
import cors from 'cors';
import { guildDB, ticketDB, categoryDB, cannedDB, statsDB, staffDB, apiKeyDB, dailyStatsDB, templateDB, noteDB } from './utils/database.js';
import { getAuditLogs } from './utils/auditLog.js';
import { getLeaderboard } from './utils/gamification.js';
import * as kb from './utils/knowledgeBase.js';
import * as triggers from './utils/triggers.js';
import logger from './utils/logger.js';

const app = express();
app.use(cors());
app.use(express.json());

// Auth Middleware
async function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization header required' });
    }
    
    const apiKey = await apiKeyDB.validate(authHeader.slice(7));
    if (!apiKey) {
        return res.status(401).json({ error: 'Invalid API key' });
    }
    
    req.guildId = apiKey.guildId;
    req.apiKey = apiKey;
    next();
}

// ==================== GUILD ====================
app.get('/api/guild', authenticate, async (req, res) => {
    try {
        const guild = await guildDB.getOrCreate(req.guildId, 'Unknown');
        res.json(guild);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.patch('/api/guild', authenticate, async (req, res) => {
    try {
        if (req.apiKey.permissions !== 'admin') {
            return res.status(403).json({ error: 'Admin permission required' });
        }
        const guild = await guildDB.update(req.guildId, req.body);
        res.json(guild);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== STATS ====================
app.get('/api/stats', authenticate, async (req, res) => {
    try {
        const stats = await statsDB.getDetailed(req.guildId);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/stats/daily', authenticate, async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const stats = await dailyStatsDB.getLast30Days(req.guildId);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/stats/leaderboard', authenticate, async (req, res) => {
    try {
        const type = req.query.type || 'xp';
        const limit = parseInt(req.query.limit) || 10;
        const leaderboard = await getLeaderboard(req.guildId, type, limit);
        res.json(leaderboard);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== TICKETS ====================
app.get('/api/tickets', authenticate, async (req, res) => {
    try {
        const { status, limit = 100 } = req.query;
        let tickets;
        if (status) {
            tickets = await ticketDB.getTicketsByStatus(req.guildId, status);
        } else {
            tickets = await ticketDB.getAllTickets(req.guildId);
        }
        res.json(tickets.slice(0, parseInt(limit)));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/tickets/:channelId', authenticate, async (req, res) => {
    try {
        const ticket = await ticketDB.get(req.params.channelId);
        if (!ticket || ticket.guildId !== req.guildId) {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        res.json(ticket);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/tickets/:channelId/notes', authenticate, async (req, res) => {
    try {
        const ticket = await ticketDB.get(req.params.channelId);
        if (!ticket || ticket.guildId !== req.guildId) {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        const notes = await noteDB.getAll(ticket.id);
        res.json(notes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/tickets/search/:query', authenticate, async (req, res) => {
    try {
        const tickets = await ticketDB.search(req.guildId, req.params.query);
        res.json(tickets);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== CATEGORIES ====================
app.get('/api/categories', authenticate, async (req, res) => {
    try {
        const categories = await categoryDB.getAll(req.guildId);
        res.json(categories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/categories', authenticate, async (req, res) => {
    try {
        if (req.apiKey.permissions !== 'admin') {
            return res.status(403).json({ error: 'Admin permission required' });
        }
        const category = await categoryDB.create(req.guildId, req.body.name, req.body);
        res.json(category);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/categories/:id', authenticate, async (req, res) => {
    try {
        if (req.apiKey.permissions !== 'admin') {
            return res.status(403).json({ error: 'Admin permission required' });
        }
        await categoryDB.delete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== CANNED RESPONSES ====================
app.get('/api/canned', authenticate, async (req, res) => {
    try {
        const responses = await cannedDB.getAll(req.guildId);
        res.json(responses);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/canned', authenticate, async (req, res) => {
    try {
        const response = await cannedDB.create(req.guildId, req.body.name, req.body.content, 'API');
        res.json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/canned/:name', authenticate, async (req, res) => {
    try {
        await cannedDB.delete(req.guildId, req.params.name);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== STAFF ====================
app.get('/api/staff', authenticate, async (req, res) => {
    try {
        const staff = await staffDB.getAll(req.guildId);
        res.json(staff);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/staff/:userId', authenticate, async (req, res) => {
    try {
        const staff = await staffDB.get(req.guildId, req.params.userId);
        if (!staff) return res.status(404).json({ error: 'Staff not found' });
        res.json(staff);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== TEMPLATES ====================
app.get('/api/templates', authenticate, async (req, res) => {
    try {
        const templates = await templateDB.getAll(req.guildId);
        res.json(templates);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/templates', authenticate, async (req, res) => {
    try {
        if (req.apiKey.permissions !== 'admin') {
            return res.status(403).json({ error: 'Admin permission required' });
        }
        const template = await templateDB.create(req.guildId, req.body);
        res.json(template);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== KNOWLEDGE BASE ====================
app.get('/api/kb', authenticate, async (req, res) => {
    try {
        const articles = await kb.getAllArticles(req.guildId, req.query);
        res.json(articles);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/kb/:id', authenticate, async (req, res) => {
    try {
        const article = await kb.getArticle(req.params.id);
        if (!article) return res.status(404).json({ error: 'Article not found' });
        res.json(article);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/kb', authenticate, async (req, res) => {
    try {
        if (req.apiKey.permissions !== 'admin') {
            return res.status(403).json({ error: 'Admin permission required' });
        }
        const article = await kb.createArticle(req.guildId, req.body);
        res.json(article);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/kb/search/:query', authenticate, async (req, res) => {
    try {
        const articles = await kb.searchArticles(req.guildId, req.params.query);
        res.json(articles);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== TRIGGERS ====================
app.get('/api/triggers', authenticate, async (req, res) => {
    try {
        const list = await triggers.getTriggers(req.guildId);
        res.json(list);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/triggers', authenticate, async (req, res) => {
    try {
        if (req.apiKey.permissions !== 'admin') {
            return res.status(403).json({ error: 'Admin permission required' });
        }
        const trigger = await triggers.createTrigger(req.guildId, req.body);
        res.json(trigger);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/triggers/:id', authenticate, async (req, res) => {
    try {
        if (req.apiKey.permissions !== 'admin') {
            return res.status(403).json({ error: 'Admin permission required' });
        }
        await triggers.deleteTrigger(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== AUDIT LOG ====================
app.get('/api/audit', authenticate, async (req, res) => {
    try {
        const logs = await getAuditLogs(req.guildId, {
            action: req.query.action,
            targetType: req.query.targetType,
            userId: req.query.userId,
            limit: parseInt(req.query.limit) || 50,
        });
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== API KEYS ====================
app.get('/api/keys', authenticate, async (req, res) => {
    try {
        if (req.apiKey.permissions !== 'admin') {
            return res.status(403).json({ error: 'Admin permission required' });
        }
        const keys = await apiKeyDB.getAll(req.guildId);
        res.json(keys);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
export function startServer(port = 3000) {
    app.listen(port, () => {
        logger.info(`🌐 REST API server running on port ${port}`);
    });
}

export default app;
