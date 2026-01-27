import { PrismaClient } from '@prisma/client';
import logger from './logger.js';

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma || new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
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

    async getById(ticketId) {
        try {
            return await prisma.ticket.findUnique({
                where: { id: ticketId },
                include: { guild: true, category: true }
            });
        } catch (error) {
            logger.error('Ticket getById hatası:', error);
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

    async incrementMessages(channelId, isStaff = false) {
        try {
            const data = { 
                messageCount: { increment: 1 }, 
                lastActivity: new Date() 
            };
            if (isStaff) {
                data.staffMessageCount = { increment: 1 };
            }
            return await prisma.ticket.update({
                where: { channelId },
                data
            });
        } catch (error) {
            // Silent
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
            return [];
        }
    },

    async getOpenTicketsWithSLA() {
        try {
            return await prisma.ticket.findMany({
                where: {
                    status: { in: ['open', 'claimed'] }
                },
                include: { category: true }
            });
        } catch (error) {
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

            return { claimed, closed, averageRating: avgRating._avg.rating || 0 };
        } catch (error) {
            logger.error('getStaffStats hatası:', error);
            throw error;
        }
    },

    async search(guildId, query, limit = 20) {
        try {
            return await prisma.ticket.findMany({
                where: {
                    guildId,
                    OR: [
                        { subject: { contains: query } },
                        { description: { contains: query } },
                        { tags: { contains: query } },
                    ]
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
            });
        } catch (error) {
            logger.error('Ticket search hatası:', error);
            return [];
        }
    },

    async merge(sourceChannelId, targetChannelId) {
        try {
            const source = await prisma.ticket.update({
                where: { channelId: sourceChannelId },
                data: {
                    status: 'closed',
                    mergedInto: targetChannelId,
                    closedAt: new Date(),
                }
            });

            await prisma.ticket.update({
                where: { channelId: targetChannelId },
                data: {
                    mergedFrom: sourceChannelId,
                    messageCount: { increment: source.messageCount },
                }
            });

            return source;
        } catch (error) {
            logger.error('Ticket merge hatası:', error);
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

    async addBlacklist(userId, username, reason = null, blacklistedBy = null) {
        try {
            return await prisma.user.upsert({
                where: { id: userId },
                update: { 
                    blacklisted: true, 
                    blacklistReason: reason,
                    blacklistedAt: new Date(),
                    blacklistedBy,
                },
                create: { 
                    id: userId, 
                    username, 
                    blacklisted: true, 
                    blacklistReason: reason,
                    blacklistedAt: new Date(),
                    blacklistedBy,
                }
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
                data: { 
                    blacklisted: false, 
                    blacklistReason: null,
                    blacklistedAt: null,
                    blacklistedBy: null,
                }
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

    async incrementSLAMet(guildId) {
        try {
            await prisma.guildStats.update({
                where: { guildId },
                data: { slaMetCount: { increment: 1 } }
            });
        } catch (error) {
            // Silent
        }
    },

    async incrementSLABreached(guildId) {
        try {
            await prisma.guildStats.update({
                where: { guildId },
                data: { slaBreachedCount: { increment: 1 } }
            });
        } catch (error) {
            // Silent
        }
    },
};

// ==================== STAFF FUNCTIONS ====================
export const staffDB = {
    async getOrCreate(guildId, userId, username) {
        try {
            let staff = await prisma.staffMember.findUnique({
                where: { guildId_userId: { guildId, userId } }
            });

            if (!staff) {
                staff = await prisma.staffMember.create({
                    data: { guildId, userId, username }
                });
            }

            return staff;
        } catch (error) {
            logger.error('Staff getOrCreate hatası:', error);
            throw error;
        }
    },

    async get(guildId, userId) {
        try {
            return await prisma.staffMember.findUnique({
                where: { guildId_userId: { guildId, userId } }
            });
        } catch (error) {
            return null;
        }
    },

    async getAll(guildId) {
        try {
            return await prisma.staffMember.findMany({
                where: { guildId },
                orderBy: { xp: 'desc' }
            });
        } catch (error) {
            return [];
        }
    },

    async update(guildId, userId, data) {
        try {
            return await prisma.staffMember.update({
                where: { guildId_userId: { guildId, userId } },
                data
            });
        } catch (error) {
            logger.error('Staff update hatası:', error);
            throw error;
        }
    },

    async updateXP(guildId, userId, xp, level) {
        try {
            return await prisma.staffMember.update({
                where: { guildId_userId: { guildId, userId } },
                data: { xp, level }
            });
        } catch (error) {
            logger.error('Staff updateXP hatası:', error);
            throw error;
        }
    },

    async updateBadges(guildId, userId, badges) {
        try {
            return await prisma.staffMember.update({
                where: { guildId_userId: { guildId, userId } },
                data: { badges }
            });
        } catch (error) {
            logger.error('Staff updateBadges hatası:', error);
            throw error;
        }
    },

    async updateStreak(guildId, userId, currentStreak, longestStreak, lastActiveDate) {
        try {
            return await prisma.staffMember.update({
                where: { guildId_userId: { guildId, userId } },
                data: { currentStreak, longestStreak, lastActiveDate }
            });
        } catch (error) {
            logger.error('Staff updateStreak hatası:', error);
            throw error;
        }
    },

    async incrementStats(guildId, userId, field) {
        try {
            return await prisma.staffMember.update({
                where: { guildId_userId: { guildId, userId } },
                data: { [field]: { increment: 1 } }
            });
        } catch (error) {
            // Silent
        }
    },

    async getAvailableForAssign(guildId) {
        try {
            return await prisma.staffMember.findMany({
                where: {
                    guildId,
                    autoAssignEnabled: true,
                    currentLoad: { lt: prisma.staffMember.fields.maxLoad }
                },
                orderBy: { currentLoad: 'asc' }
            });
        } catch (error) {
            return [];
        }
    },

    async incrementLoad(guildId, userId) {
        try {
            await prisma.staffMember.update({
                where: { guildId_userId: { guildId, userId } },
                data: { currentLoad: { increment: 1 } }
            });
        } catch (error) {
            // Silent
        }
    },

    async decrementLoad(guildId, userId) {
        try {
            await prisma.staffMember.update({
                where: { guildId_userId: { guildId, userId } },
                data: { currentLoad: { decrement: 1 } }
            });
        } catch (error) {
            // Silent
        }
    },

    async resetAllLoads(guildId) {
        try {
            await prisma.staffMember.updateMany({
                where: { guildId },
                data: { currentLoad: 0 }
            });
        } catch (error) {
            // Silent
        }
    },

    async getTopByXP(guildId, limit = 10) {
        try {
            return await prisma.staffMember.findMany({
                where: { guildId },
                orderBy: { xp: 'desc' },
                take: limit
            });
        } catch (error) {
            return [];
        }
    },

    async getTopByTickets(guildId, limit = 10) {
        try {
            return await prisma.staffMember.findMany({
                where: { guildId },
                orderBy: { ticketsClosed: 'desc' },
                take: limit
            });
        } catch (error) {
            return [];
        }
    },

    async getTopByRating(guildId, limit = 10) {
        try {
            return await prisma.staffMember.findMany({
                where: { guildId, totalRatings: { gte: 5 } },
                orderBy: { averageRating: 'desc' },
                take: limit
            });
        } catch (error) {
            return [];
        }
    },

    async getTopByStreak(guildId, limit = 10) {
        try {
            return await prisma.staffMember.findMany({
                where: { guildId },
                orderBy: { longestStreak: 'desc' },
                take: limit
            });
        } catch (error) {
            return [];
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
                    id: true, name: true, permissions: true,
                    lastUsed: true, usageCount: true, enabled: true, createdAt: true
                }
            });
        } catch (error) {
            return [];
        }
    },

    async delete(id) {
        try {
            return await prisma.apiKey.delete({ where: { id } });
        } catch (error) {
            logger.error('ApiKey delete hatası:', error);
            throw error;
        }
    },
};

// ==================== NOTE FUNCTIONS ====================
export const noteDB = {
    async create(ticketId, authorId, content) {
        try {
            return await prisma.ticketNote.create({
                data: { ticketId, authorId, content }
            });
        } catch (error) {
            logger.error('Note create hatası:', error);
            throw error;
        }
    },

    async getAll(ticketId) {
        try {
            return await prisma.ticketNote.findMany({
                where: { ticketId },
                orderBy: { createdAt: 'desc' }
            });
        } catch (error) {
            return [];
        }
    },

    async delete(noteId) {
        try {
            return await prisma.ticketNote.delete({ where: { id: noteId } });
        } catch (error) {
            logger.error('Note delete hatası:', error);
            throw error;
        }
    },
};

// ==================== MESSAGE FUNCTIONS ====================
export const messageDB = {
    async create(ticketId, messageId, authorId, authorName, content, isStaff = false) {
        try {
            return await prisma.ticketMessage.create({
                data: { ticketId, messageId, authorId, authorName, content, isStaff }
            });
        } catch (error) {
            // Duplicate message ID, ignore
        }
    },

    async getAll(ticketId) {
        try {
            return await prisma.ticketMessage.findMany({
                where: { ticketId },
                orderBy: { createdAt: 'asc' }
            });
        } catch (error) {
            return [];
        }
    },

    async search(guildId, query, limit = 20) {
        try {
            const tickets = await prisma.ticket.findMany({
                where: { guildId },
                select: { id: true }
            });
            const ticketIds = tickets.map(t => t.id);

            return await prisma.ticketMessage.findMany({
                where: {
                    ticketId: { in: ticketIds },
                    content: { contains: query }
                },
                take: limit,
                include: { ticket: true }
            });
        } catch (error) {
            return [];
        }
    },
};

// ==================== TEMPLATE FUNCTIONS ====================
export const templateDB = {
    async create(guildId, data) {
        try {
            return await prisma.ticketTemplate.create({
                data: {
                    guildId,
                    name: data.name,
                    description: data.description,
                    emoji: data.emoji,
                    fields: JSON.stringify(data.fields || []),
                    defaultPriority: data.defaultPriority || 2,
                    defaultTags: data.defaultTags,
                    autoAssignRole: data.autoAssignRole,
                }
            });
        } catch (error) {
            logger.error('Template create hatası:', error);
            throw error;
        }
    },

    async get(templateId) {
        try {
            const template = await prisma.ticketTemplate.findUnique({
                where: { id: templateId }
            });
            if (template) {
                template.fields = JSON.parse(template.fields);
            }
            return template;
        } catch (error) {
            return null;
        }
    },

    async getAll(guildId) {
        try {
            const templates = await prisma.ticketTemplate.findMany({
                where: { guildId, enabled: true },
                orderBy: { useCount: 'desc' }
            });
            return templates.map(t => ({ ...t, fields: JSON.parse(t.fields) }));
        } catch (error) {
            return [];
        }
    },

    async delete(templateId) {
        try {
            return await prisma.ticketTemplate.delete({ where: { id: templateId } });
        } catch (error) {
            logger.error('Template delete hatası:', error);
            throw error;
        }
    },

    async incrementUse(templateId) {
        try {
            await prisma.ticketTemplate.update({
                where: { id: templateId },
                data: { useCount: { increment: 1 } }
            });
        } catch (error) {
            // Silent
        }
    },
};

// ==================== DAILY STATS FUNCTIONS ====================
export const dailyStatsDB = {
    async recordDaily(guildId, data) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        try {
            return await prisma.dailyStats.upsert({
                where: { guildId_date: { guildId, date: today } },
                update: data,
                create: { guildId, date: today, ...data }
            });
        } catch (error) {
            logger.error('Daily stats record hatası:', error);
        }
    },

    async getRange(guildId, startDate, endDate) {
        try {
            return await prisma.dailyStats.findMany({
                where: {
                    guildId,
                    date: { gte: startDate, lte: endDate }
                },
                orderBy: { date: 'asc' }
            });
        } catch (error) {
            return [];
        }
    },

    async getLast30Days(guildId) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        return this.getRange(guildId, startDate, endDate);
    },
};

// ==================== REMINDER FUNCTIONS ====================
export const reminderDB = {
    async create(guildId, ticketId, channelId, userId, message, remindAt) {
        try {
            return await prisma.reminder.create({
                data: { guildId, ticketId, channelId, userId, message, remindAt }
            });
        } catch (error) {
            logger.error('Reminder create hatası:', error);
            throw error;
        }
    },

    async getDue() {
        try {
            return await prisma.reminder.findMany({
                where: {
                    completed: false,
                    remindAt: { lte: new Date() }
                }
            });
        } catch (error) {
            return [];
        }
    },

    async markComplete(reminderId) {
        try {
            await prisma.reminder.update({
                where: { id: reminderId },
                data: { completed: true }
            });
        } catch (error) {
            // Silent
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
