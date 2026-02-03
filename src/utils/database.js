import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import logger from './logger.js';

// Prisma Client Singleton Pattern
const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma || new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
        ? ['query', 'error', 'warn'] 
        : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

// Database bağlantısını test et
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

// Graceful shutdown için
export async function disconnectDatabase() {
    await prisma.$disconnect();
    logger.info('Database bağlantısı kapatıldı');
}

// ==================== GUILD DB ====================
export const guildDB = {
    async getOrCreate(guildId, guildName) {
        try {
            let guild = await prisma.guild.findUnique({
                where: { id: guildId },
                include: {
                    categories: { orderBy: { order: 'asc' } },
                    stats: true,
                }
            });

            if (!guild) {
                guild = await prisma.guild.create({
                    data: {
                        id: guildId,
                        name: guildName,
                        stats: { create: {} }
                    },
                    include: {
                        categories: true,
                        stats: true,
                    }
                });
                logger.info(`Yeni guild oluşturuldu: ${guildName} (${guildId})`);
            }

            return guild;
        } catch (error) {
            logger.error('Guild getOrCreate hatası:', error);
            throw error;
        }
    },

    async get(guildId) {
        return prisma.guild.findUnique({
            where: { id: guildId },
            include: {
                categories: { orderBy: { order: 'asc' } },
                stats: true,
            }
        });
    },

    async update(guildId, data) {
        try {
            return await prisma.guild.update({
                where: { id: guildId },
                data,
            });
        } catch (error) {
            logger.error('Guild update hatası:', error);
            throw error;
        }
    },

    async setup(guildId, { categoryId, panelChannelId, logChannelId, transcriptChannelId, staffRoles }) {
        try {
            return await prisma.guild.update({
                where: { id: guildId },
                data: {
                    categoryId,
                    panelChannelId,
                    logChannelId,
                    transcriptChannelId,
                    staffRoles: Array.isArray(staffRoles) ? staffRoles.join(',') : staffRoles,
                },
            });
        } catch (error) {
            logger.error('Guild setup hatası:', error);
            throw error;
        }
    },

    async getAll() {
        return prisma.guild.findMany({
            include: { stats: true }
        });
    }
};

// ==================== TICKET DB ====================
export const ticketDB = {
    async create(guildId, userId, channelId, categoryId = null, subject = null, description = null, userName = null) {
        try {
            const guild = await prisma.guild.update({
                where: { id: guildId },
                data: { ticketCount: { increment: 1 } }
            });

            const ticketNumber = guild.ticketCount;

            const ticket = await prisma.ticket.create({
                data: {
                    ticketNumber,
                    channelId,
                    guildId,
                    userId,
                    userName,
                    categoryId,
                    subject,
                    description,
                    status: 'open',
                }
            });

            await prisma.guildStats.upsert({
                where: { guildId },
                update: {
                    totalTickets: { increment: 1 },
                    openTickets: { increment: 1 },
                },
                create: {
                    guildId,
                    totalTickets: 1,
                    openTickets: 1,
                }
            });

            logger.info(`Ticket oluşturuldu: #${ticketNumber} (${channelId})`);
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
                include: {
                    guild: true,
                    category: true,
                }
            });
        } catch (error) {
            logger.error('Ticket get hatası:', error);
            throw error;
        }
    },

    async getById(id) {
        return prisma.ticket.findUnique({
            where: { id },
            include: { guild: true, category: true }
        });
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

    async getUserActiveTickets(guildId, userId) {
        return prisma.ticket.findMany({
            where: {
                guildId,
                userId,
                status: { in: ['open', 'claimed'] }
            }
        });
    },

    async update(channelId, data) {
        try {
            return await prisma.ticket.update({
                where: { channelId },
                data: {
                    ...data,
                    lastActivity: new Date(),
                }
            });
        } catch (error) {
            logger.error('Ticket update hatası:', error);
            throw error;
        }
    },

    async claim(channelId, userId, userName = null) {
        try {
            return await prisma.ticket.update({
                where: { channelId },
                data: {
                    status: 'claimed',
                    claimedBy: userId,
                    claimedByName: userName,
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
                    claimedByName: null,
                    claimedAt: null,
                    lastActivity: new Date(),
                }
            });
        } catch (error) {
            logger.error('Ticket unclaim hatası:', error);
            throw error;
        }
    },

    async close(channelId, closedBy, closeReason = null, closedByName = null) {
        try {
            const ticket = await prisma.ticket.update({
                where: { channelId },
                data: {
                    status: 'closed',
                    closedBy,
                    closedByName,
                    closeReason,
                    closedAt: new Date(),
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
                    closedByName: null,
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

    async setPriority(channelId, priority) {
        return this.update(channelId, { priority });
    },

    async addTag(channelId, tag) {
        const ticket = await this.get(channelId);
        const tags = ticket.tags ? ticket.tags.split(',').filter(t => t) : [];
        if (!tags.includes(tag)) {
            tags.push(tag);
        }
        return this.update(channelId, { tags: tags.join(',') });
    },

    async removeTag(channelId, tag) {
        const ticket = await this.get(channelId);
        const tags = ticket.tags ? ticket.tags.split(',').filter(t => t && t !== tag) : [];
        return this.update(channelId, { tags: tags.join(',') });
    },

    async setRating(channelId, rating, feedback = null) {
        try {
            const ticket = await prisma.ticket.update({
                where: { channelId },
                data: { rating, ratingFeedback: feedback }
            });

            // Ortalama puanı güncelle
            const ratings = await prisma.ticket.aggregate({
                where: { guildId: ticket.guildId, rating: { not: null } },
                _avg: { rating: true },
                _count: { rating: true }
            });

            await prisma.guildStats.update({
                where: { guildId: ticket.guildId },
                data: {
                    averageRating: ratings._avg.rating,
                    totalRatings: ratings._count.rating,
                }
            });

            return ticket;
        } catch (error) {
            logger.error('Ticket setRating hatası:', error);
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
            // Hata olsa da sessizce devam et
        }
    },

    async getInactiveTickets(hours = 48) {
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

    async getByGuild(guildId, options = {}) {
        const { status, limit = 100, offset = 0 } = options;
        
        const where = { guildId };
        if (status) where.status = status;

        return prisma.ticket.findMany({
            where,
            include: { category: true },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
        });
    },

    async countByGuild(guildId, status = null) {
        const where = { guildId };
        if (status) where.status = status;
        return prisma.ticket.count({ where });
    }
};

// ==================== CATEGORY DB ====================
export const categoryDB = {
    async create(guildId, name, options = {}) {
        try {
            const count = await prisma.category.count({ where: { guildId } });
            return await prisma.category.create({
                data: {
                    guildId,
                    name,
                    order: count,
                    ...options,
                }
            });
        } catch (error) {
            logger.error('Category create hatası:', error);
            throw error;
        }
    },

    async get(id) {
        return prisma.category.findUnique({ where: { id } });
    },

    async getByName(guildId, name) {
        return prisma.category.findFirst({
            where: { guildId, name: { equals: name, mode: 'insensitive' } }
        });
    },

    async getAll(guildId, includeDisabled = false) {
        try {
            const where = { guildId };
            if (!includeDisabled) where.enabled = true;

            return await prisma.category.findMany({
                where,
                orderBy: { order: 'asc' }
            });
        } catch (error) {
            logger.error('Category getAll hatası:', error);
            throw error;
        }
    },

    async update(id, data) {
        return prisma.category.update({
            where: { id },
            data: { ...data, updatedAt: new Date() }
        });
    },

    async delete(id) {
        return prisma.category.delete({ where: { id } });
    }
};

// ==================== USER DB ====================
export const userDB = {
    async getOrCreate(userId, username, globalName = null, avatarUrl = null) {
        try {
            let user = await prisma.user.findUnique({ where: { id: userId } });

            if (!user) {
                user = await prisma.user.create({
                    data: { id: userId, username, globalName, avatarUrl }
                });
            } else {
                // Bilgileri güncelle
                user = await prisma.user.update({
                    where: { id: userId },
                    data: { username, globalName, avatarUrl, updatedAt: new Date() }
                });
            }

            return user;
        } catch (error) {
            logger.error('User getOrCreate hatası:', error);
            throw error;
        }
    },

    async get(userId) {
        return prisma.user.findUnique({ where: { id: userId } });
    },

    async isBlacklisted(userId) {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { blacklisted: true, blacklistReason: true }
            });
            return user?.blacklisted || false;
        } catch (error) {
            return false;
        }
    },

    async getBlacklistInfo(userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { blacklisted: true, blacklistReason: true, blacklistedBy: true, blacklistedAt: true }
        });
        return user;
    },

    async addBlacklist(userId, username, reason = null, blacklistedBy = null) {
        return prisma.user.upsert({
            where: { id: userId },
            update: {
                blacklisted: true,
                blacklistReason: reason,
                blacklistedBy,
                blacklistedAt: new Date(),
            },
            create: {
                id: userId,
                username,
                blacklisted: true,
                blacklistReason: reason,
                blacklistedBy,
                blacklistedAt: new Date(),
            }
        });
    },

    async removeBlacklist(userId) {
        return prisma.user.update({
            where: { id: userId },
            data: {
                blacklisted: false,
                blacklistReason: null,
                blacklistedBy: null,
                blacklistedAt: null,
            }
        });
    },

    async incrementTickets(userId) {
        return prisma.user.update({
            where: { id: userId },
            data: { totalTickets: { increment: 1 } }
        });
    }
};

// ==================== STATS DB ====================
export const statsDB = {
    async get(guildId) {
        return prisma.guildStats.findUnique({ where: { guildId } });
    },

    async getDetailed(guildId) {
        try {
            const stats = await prisma.guildStats.findUnique({ where: { guildId } });
            if (!stats) return null;

            // Bugünkü ticketlar
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const todayTickets = await prisma.ticket.count({
                where: { guildId, createdAt: { gte: today } }
            });

            // Bu haftaki ticketlar
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            
            const weekTickets = await prisma.ticket.count({
                where: { guildId, createdAt: { gte: weekAgo } }
            });

            // En aktif yetkililer
            const topStaff = await prisma.ticket.groupBy({
                by: ['claimedBy'],
                where: { 
                    guildId, 
                    claimedBy: { not: null },
                    closedAt: { gte: weekAgo }
                },
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
                take: 5,
            });

            return {
                ...stats,
                todayTickets,
                weekTickets,
                topStaff,
            };
        } catch (error) {
            logger.error('Stats getDetailed hatası:', error);
            throw error;
        }
    },

    async update(guildId, data) {
        return prisma.guildStats.update({
            where: { guildId },
            data
        });
    }
};

// ==================== CANNED RESPONSE DB ====================
export const cannedDB = {
    async create(guildId, name, content, createdBy, createdByName = null) {
        return prisma.cannedResponse.create({
            data: { guildId, name: name.toLowerCase(), content, createdBy, createdByName }
        });
    },

    async get(guildId, name) {
        return prisma.cannedResponse.findUnique({
            where: { guildId_name: { guildId, name: name.toLowerCase() } }
        });
    },

    async getAll(guildId) {
        return prisma.cannedResponse.findMany({
            where: { guildId },
            orderBy: { useCount: 'desc' }
        });
    },

    async update(id, data) {
        return prisma.cannedResponse.update({
            where: { id },
            data: { ...data, updatedAt: new Date() }
        });
    },

    async delete(id) {
        return prisma.cannedResponse.delete({ where: { id } });
    },

    async incrementUse(id) {
        return prisma.cannedResponse.update({
            where: { id },
            data: { useCount: { increment: 1 } }
        });
    }
};

// ==================== API KEY DB ====================
export const apiKeyDB = {
    generateKey() {
        return 'ftk_' + crypto.randomBytes(24).toString('hex');
    },

    async create(guildId, name, permissions = 'read', createdBy) {
        const key = this.generateKey();
        return prisma.apiKey.create({
            data: { guildId, key, name, permissions, createdBy }
        });
    },

    async get(key) {
        return prisma.apiKey.findUnique({ where: { key } });
    },

    async getById(id) {
        return prisma.apiKey.findUnique({ where: { id } });
    },

    async getAll(guildId) {
        return prisma.apiKey.findMany({
            where: { guildId },
            orderBy: { createdAt: 'desc' }
        });
    },

    async validate(key) {
        const apiKey = await prisma.apiKey.findUnique({ where: { key } });
        if (!apiKey || !apiKey.enabled) return null;
        if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

        // Kullanım sayısını ve son kullanım tarihini güncelle
        await prisma.apiKey.update({
            where: { id: apiKey.id },
            data: { usageCount: { increment: 1 }, lastUsed: new Date() }
        });

        return apiKey;
    },

    async delete(id) {
        return prisma.apiKey.delete({ where: { id } });
    },

    async disable(id) {
        return prisma.apiKey.update({
            where: { id },
            data: { enabled: false }
        });
    }
};

// ==================== TRANSCRIPT DB ====================
export const transcriptDB = {
    async create(data) {
        return prisma.transcript.create({ data });
    },

    async get(id) {
        return prisma.transcript.findUnique({ where: { id } });
    },

    async getByTicket(ticketId) {
        return prisma.transcript.findUnique({ where: { ticketId } });
    },

    async getByGuild(guildId, options = {}) {
        const { limit = 50, offset = 0 } = options;
        return prisma.transcript.findMany({
            where: { guildId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
        });
    },

    async delete(id) {
        return prisma.transcript.delete({ where: { id } });
    }
};

// ==================== AUDIT LOG DB ====================
export const auditDB = {
    async log(guildId, action, targetType, userId, userName = null, targetId = null, details = null) {
        return prisma.auditLog.create({
            data: {
                guildId,
                action,
                targetType,
                targetId,
                userId,
                userName,
                details: details ? JSON.stringify(details) : null,
            }
        });
    },

    async getByGuild(guildId, options = {}) {
        const { action, limit = 100, offset = 0 } = options;
        
        const where = { guildId };
        if (action) where.action = action;

        return prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
        });
    }
};

export default prisma;
