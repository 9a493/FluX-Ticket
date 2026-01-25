import { PrismaClient } from '@prisma/client';
import logger from './logger.js';

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma || new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
        ? ['query', 'error', 'warn'] 
        : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

export async function testDatabaseConnection() {
    try {
        await prisma.$connect();
        logger.info('✅ Database bağlantısı başarılı');
        return true;
    } catch (error) {
        logger.error('❌ Database bağlantı hatası:', error);
        return false;
    }
}

export async function disconnectDatabase() {
    await prisma.$disconnect();
    logger.info('Database bağlantısı kapatıldı');
}

// ==================== GUILD FUNCTIONS ====================
export const guildDB = {
    async getOrCreate(guildId, guildName) {
        try {
            let guild = await prisma.guild.findUnique({
                where: { id: guildId },
                include: { categories: true, stats: true }
            });

            if (!guild) {
                guild = await prisma.guild.create({
                    data: {
                        id: guildId,
                        name: guildName,
                        stats: { create: {} }
                    },
                    include: { categories: true, stats: true }
                });
                logger.info(`Yeni guild oluşturuldu: ${guildName}`);
            }

            return guild;
        } catch (error) {
            logger.error('Guild getOrCreate hatası:', error);
            throw error;
        }
    },

    async update(guildId, data) {
        try {
            return await prisma.guild.update({
                where: { id: guildId },
                data
            });
        } catch (error) {
            logger.error('Guild update hatası:', error);
            throw error;
        }
    },

    async setup(guildId, { categoryId, panelChannelId, logChannelId, staffRoles }) {
        try {
            return await prisma.guild.update({
                where: { id: guildId },
                data: {
                    categoryId,
                    panelChannelId,
                    logChannelId,
                    staffRoles: Array.isArray(staffRoles) ? staffRoles.join(',') : staffRoles,
                }
            });
        } catch (error) {
            logger.error('Guild setup hatası:', error);
            throw error;
        }
    },
};

// ==================== TICKET FUNCTIONS ====================
export const ticketDB = {
    async create(guildId, userId, channelId, categoryId = null) {
        try {
            const guild = await prisma.guild.update({
                where: { id: guildId },
                data: { ticketCount: { increment: 1 } }
            });

            const ticket = await prisma.ticket.create({
                data: {
                    ticketNumber: guild.ticketCount,
                    channelId,
                    guildId,
                    userId,
                    categoryId,
                    status: 'open',
                }
            });

            await prisma.guildStats.update({
                where: { guildId },
                data: {
                    totalTickets: { increment: 1 },
                    openTickets: { increment: 1 },
                }
            });

            await userDB.incrementTicketCount(userId);

            logger.info(`Ticket oluşturuldu: #${ticket.ticketNumber}`);
            return ticket;
        } catch (error) {
            logger.error('Ticket create hatası:', error);
            throw error;
        }
    },

    async get(channelId) {
        try {
            return await prisma.ticket.findUnique({
                where: { channelId },
                include: { guild: true, category: true }
            });
        } catch (error) {
            logger.error('Ticket get hatası:', error);
            throw error;
        }
    },

    async getUserActiveTicket(guildId, userId) {
        try {
            return await prisma.ticket.findFirst({
                where: {
                    guildId,
                    userId,
                    status: { in: ['open', 'claimed'] }
                }
            });
        } catch (error) {
            logger.error('getUserActiveTicket hatası:', error);
            throw error;
        }
    },

    async getUserTicketCount(guildId, userId) {
        try {
            return await prisma.ticket.count({
                where: {
                    guildId,
                    userId,
                    status: { in: ['open', 'claimed'] }
                }
            });
        } catch (error) {
            return 0;
        }
    },

    async update(channelId, data) {
        try {
            return await prisma.ticket.update({
                where: { channelId },
                data: { ...data, lastActivity: new Date() }
            });
        } catch (error) {
            logger.error('Ticket update hatası:', error);
            throw error;
        }
    },

    async claim(channelId, userId) {
        try {
            return await prisma.ticket.update({
                where: { channelId },
                data: {
                    status: 'claimed',
                    claimedBy: userId,
                    claimedAt: new Date(),
                    lastActivity: new Date(),
                }
            });
        } catch (error) {
            logger.error('Ticket claim hatası:', error);
            throw error;
        }
    },

    async unclaim(channelId) {
        try {
            return await prisma.ticket.update({
                where: { channelId },
                data: {
                    status: 'open',
                    claimedBy: null,
                    claimedAt: null,
                    lastActivity: new Date(),
                }
            });
        } catch (error) {
            logger.error('Ticket unclaim hatası:', error);
            throw error;
        }
    },

    async close(channelId, closedBy, closeReason = null, transcriptUrl = null) {
        try {
            const ticket = await prisma.ticket.update({
                where: { channelId },
                data: {
                    status: 'closed',
                    closedBy,
                    closeReason,
                    closedAt: new Date(),
                    transcriptUrl,
                }
            });

            await prisma.guildStats.update({
                where: { guildId: ticket.guildId },
                data: {
                    openTickets: { decrement: 1 },
                    closedTickets: { increment: 1 },
                }
            });

            return ticket;
        } catch (error) {
            logger.error('Ticket close hatası:', error);
            throw error;
        }
    },

    async reopen(channelId) {
        try {
            const ticket = await prisma.ticket.update({
                where: { channelId },
                data: {
                    status: 'open',
                    closedBy: null,
                    closeReason: null,
                    closedAt: null,
                    lastActivity: new Date(),
                }
            });

            await prisma.guildStats.update({
                where: { guildId: ticket.guildId },
                data: {
                    openTickets: { increment: 1 },
                    closedTickets: { decrement: 1 },
                }
            });

            return ticket;
        } catch (error) {
            logger.error('Ticket reopen hatası:', error);
            throw error;
        }
    },

    async incrementMessages(channelId) {
        try {
            return await prisma.ticket.update({
                where: { channelId },
                data: {
                    messageCount: { increment: 1 },
                    lastActivity: new Date(),
                }
            });
        } catch (error) {
            // Silent fail
        }
    },

    async setPriority(channelId, priority) {
        try {
            return await prisma.ticket.update({
                where: { channelId },
                data: { priority }
            });
        } catch (error) {
            logger.error('Ticket setPriority hatası:', error);
            throw error;
        }
    },

    async addTag(channelId, tag) {
        try {
            const ticket = await prisma.ticket.findUnique({
                where: { channelId },
                select: { tags: true }
            });

            const currentTags = ticket?.tags ? ticket.tags.split(',').filter(t => t) : [];
            if (!currentTags.includes(tag)) {
                currentTags.push(tag);
            }

            return await prisma.ticket.update({
                where: { channelId },
                data: { tags: currentTags.join(',') }
            });
        } catch (error) {
            logger.error('Ticket addTag hatası:', error);
            throw error;
        }
    },

    async removeTag(channelId, tag) {
        try {
            const ticket = await prisma.ticket.findUnique({
                where: { channelId },
                select: { tags: true }
            });

            const currentTags = ticket?.tags ? ticket.tags.split(',').filter(t => t && t !== tag) : [];

            return await prisma.ticket.update({
                where: { channelId },
                data: { tags: currentTags.join(',') }
            });
        } catch (error) {
            logger.error('Ticket removeTag hatası:', error);
            throw error;
        }
    },

    async getInactiveTickets(hours = 24) {
        try {
            const cutoffTime = new Date();
            cutoffTime.setHours(cutoffTime.getHours() - hours);

            return await prisma.ticket.findMany({
                where: {
                    status: { in: ['open', 'claimed'] },
                    lastActivity: { lt: cutoffTime }
                },
                include: { guild: true }
            });
        } catch (error) {
            logger.error('getInactiveTickets hatası:', error);
            throw error;
        }
    },

    async getScheduledTickets() {
        try {
            return await prisma.ticket.findMany({
                where: {
                    status: { in: ['open', 'claimed'] },
                    scheduledCloseAt: { not: null }
                }
            });
        } catch (error) {
            logger.error('getScheduledTickets hatası:', error);
            return [];
        }
    },

    async getAllTickets(guildId) {
        try {
            return await prisma.ticket.findMany({
                where: { guildId },
                orderBy: { createdAt: 'desc' },
                take: 100
            });
        } catch (error) {
            logger.error('getAllTickets hatası:', error);
            throw error;
        }
    },

    async getTicketsByStatus(guildId, status) {
        try {
            return await prisma.ticket.findMany({
                where: { guildId, status },
                orderBy: { createdAt: 'desc' }
            });
        } catch (error) {
            logger.error('getTicketsByStatus hatası:', error);
            throw error;
        }
    },

    async getStaffStats(guildId, userId) {
        try {
            const claimed = await prisma.ticket.count({
                where: { guildId, claimedBy: userId }
            });

            const closed = await prisma.ticket.count({
                where: { guildId, closedBy: userId }
            });

            const avgRating = await prisma.ticket.aggregate({
                where: { guildId, claimedBy: userId, rating: { not: null } },
                _avg: { rating: true }
            });

            return {
                claimed,
                closed,
                averageRating: avgRating._avg.rating || 0,
            };
        } catch (error) {
            logger.error('getStaffStats hatası:', error);
            throw error;
        }
    },
};

// ==================== CATEGORY FUNCTIONS ====================
export const categoryDB = {
    async create(guildId, name, options = {}) {
        try {
            const lastCategory = await prisma.category.findFirst({
                where: { guildId },
                orderBy: { order: 'desc' }
            });

            return await prisma.category.create({
                data: {
                    guildId,
                    name,
                    order: (lastCategory?.order || 0) + 1,
                    ...options,
                }
            });
        } catch (error) {
            logger.error('Category create hatası:', error);
            throw error;
        }
    },

    async get(categoryId) {
        try {
            return await prisma.category.findUnique({
                where: { id: categoryId }
            });
        } catch (error) {
            logger.error('Category get hatası:', error);
            throw error;
        }
    },

    async getAll(guildId) {
        try {
            return await prisma.category.findMany({
                where: { guildId, enabled: true },
                orderBy: { order: 'asc' }
            });
        } catch (error) {
            logger.error('Category getAll hatası:', error);
            throw error;
        }
    },

    async update(categoryId, data) {
        try {
            return await prisma.category.update({
                where: { id: categoryId },
                data
            });
        } catch (error) {
            logger.error('Category update hatası:', error);
            throw error;
        }
    },

    async delete(categoryId) {
        try {
            return await prisma.category.delete({
                where: { id: categoryId }
            });
        } catch (error) {
            logger.error('Category delete hatası:', error);
            throw error;
        }
    },
};

// ==================== USER FUNCTIONS ====================
export const userDB = {
    async getOrCreate(userId, username) {
        try {
            let user = await prisma.user.findUnique({
                where: { id: userId }
            });

            if (!user) {
                user = await prisma.user.create({
                    data: { id: userId, username }
                });
            }

            return user;
        } catch (error) {
            logger.error('User getOrCreate hatası:', error);
            throw error;
        }
    },

    async isBlacklisted(userId) {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { blacklisted: true }
            });

            return user?.blacklisted || false;
        } catch (error) {
            return false;
        }
    },

    async addBlacklist(userId, username, reason = null) {
        try {
            return await prisma.user.upsert({
                where: { id: userId },
                update: { blacklisted: true, blacklistReason: reason },
                create: { id: userId, username, blacklisted: true, blacklistReason: reason }
            });
        } catch (error) {
            logger.error('addBlacklist hatası:', error);
            throw error;
        }
    },

    async removeBlacklist(userId) {
        try {
            return await prisma.user.update({
                where: { id: userId },
                data: { blacklisted: false, blacklistReason: null }
            });
        } catch (error) {
            logger.error('removeBlacklist hatası:', error);
            throw error;
        }
    },

    async incrementTicketCount(userId) {
        try {
            await prisma.user.updateMany({
                where: { id: userId },
                data: { totalTickets: { increment: 1 } }
            });
        } catch (error) {
            // Silent
        }
    },
};

// ==================== CANNED RESPONSE FUNCTIONS ====================
export const cannedDB = {
    async create(guildId, name, content, createdBy) {
        try {
            return await prisma.cannedResponse.create({
                data: { guildId, name: name.toLowerCase(), content, createdBy }
            });
        } catch (error) {
            logger.error('CannedResponse create hatası:', error);
            throw error;
        }
    },

    async get(guildId, name) {
        try {
            return await prisma.cannedResponse.findUnique({
                where: { guildId_name: { guildId, name: name.toLowerCase() } }
            });
        } catch (error) {
            return null;
        }
    },

    async getAll(guildId) {
        try {
            return await prisma.cannedResponse.findMany({
                where: { guildId },
                orderBy: { useCount: 'desc' }
            });
        } catch (error) {
            logger.error('CannedResponse getAll hatası:', error);
            throw error;
        }
    },

    async update(guildId, name, data) {
        try {
            return await prisma.cannedResponse.update({
                where: { guildId_name: { guildId, name: name.toLowerCase() } },
                data
            });
        } catch (error) {
            logger.error('CannedResponse update hatası:', error);
            throw error;
        }
    },

    async incrementUse(guildId, name) {
        try {
            return await prisma.cannedResponse.update({
                where: { guildId_name: { guildId, name: name.toLowerCase() } },
                data: { useCount: { increment: 1 } }
            });
        } catch (error) {
            // Silent
        }
    },

    async delete(guildId, name) {
        try {
            return await prisma.cannedResponse.delete({
                where: { guildId_name: { guildId, name: name.toLowerCase() } }
            });
        } catch (error) {
            logger.error('CannedResponse delete hatası:', error);
            throw error;
        }
    },
};

// ==================== STATS FUNCTIONS ====================
export const statsDB = {
    async get(guildId) {
        try {
            return await prisma.guildStats.findUnique({
                where: { guildId }
            });
        } catch (error) {
            logger.error('Stats get hatası:', error);
            throw error;
        }
    },

    async getDetailed(guildId) {
        try {
            const stats = await prisma.guildStats.findUnique({
                where: { guildId }
            });

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const todayTickets = await prisma.ticket.count({
                where: { guildId, createdAt: { gte: today } }
            });

            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);

            const weekTickets = await prisma.ticket.count({
                where: { guildId, createdAt: { gte: weekAgo } }
            });

            const topStaff = await prisma.ticket.groupBy({
                by: ['claimedBy'],
                where: { guildId, claimedBy: { not: null } },
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
                take: 5
            });

            return { ...stats, todayTickets, weekTickets, topStaff };
        } catch (error) {
            logger.error('getDetailed hatası:', error);
            throw error;
        }
    },
};

// ==================== API KEY FUNCTIONS ====================
export const apiKeyDB = {
    async create(guildId, name, permissions = 'read') {
        try {
            const key = generateApiKey();
            return await prisma.apiKey.create({
                data: { guildId, name, key, permissions }
            });
        } catch (error) {
            logger.error('ApiKey create hatası:', error);
            throw error;
        }
    },

    async validate(key) {
        try {
            const apiKey = await prisma.apiKey.findUnique({
                where: { key }
            });

            if (!apiKey || !apiKey.enabled) return null;
            if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

            // Update usage
            await prisma.apiKey.update({
                where: { key },
                data: { lastUsed: new Date(), usageCount: { increment: 1 } }
            });

            return apiKey;
        } catch (error) {
            return null;
        }
    },

    async getAll(guildId) {
        try {
            return await prisma.apiKey.findMany({
                where: { guildId },
                select: {
                    id: true,
                    name: true,
                    permissions: true,
                    lastUsed: true,
                    usageCount: true,
                    enabled: true,
                    createdAt: true
                }
            });
        } catch (error) {
            logger.error('ApiKey getAll hatası:', error);
            throw error;
        }
    },

    async delete(id) {
        try {
            return await prisma.apiKey.delete({
                where: { id }
            });
        } catch (error) {
            logger.error('ApiKey delete hatası:', error);
            throw error;
        }
    },
};

function generateApiKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'ftk_';
    for (let i = 0; i < 32; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

export default prisma;
