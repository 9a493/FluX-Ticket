import { PrismaClient } from '@prisma/client';
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

// Guild Helper Functions
export const guildDB = {
    // Guild ayarlarını getir veya oluştur
    async getOrCreate(guildId, guildName) {
        try {
            let guild = await prisma.guild.findUnique({
                where: { id: guildId },
                include: {
                    categories: true,
                    stats: true,
                }
            });

            if (!guild) {
                guild = await prisma.guild.create({
                    data: {
                        id: guildId,
                        name: guildName,
                        stats: {
                            create: {}
                        }
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

    // Guild ayarlarını güncelle
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

    // Guild setup yap
    async setup(guildId, { categoryId, panelChannelId, logChannelId, staffRoles }) {
        try {
            return await prisma.guild.update({
                where: { id: guildId },
                data: {
                    categoryId,
                    panelChannelId,
                    logChannelId,
                    staffRoles: Array.isArray(staffRoles) ? staffRoles.join(',') : staffRoles,
                },
            });
        } catch (error) {
            logger.error('Guild setup hatası:', error);
            throw error;
        }
    },
};

// Ticket Helper Functions
export const ticketDB = {
    // Yeni ticket oluştur
    async create(guildId, userId, channelId, categoryId = null) {
        try {
            // Guild'in ticket sayısını artır ve ticket numarası al
            const guild = await prisma.guild.update({
                where: { id: guildId },
                data: {
                    ticketCount: { increment: 1 }
                }
            });

            const ticketNumber = guild.ticketCount;

            // Ticket oluştur
            const ticket = await prisma.ticket.create({
                data: {
                    ticketNumber,
                    channelId,
                    guildId,
                    userId,
                    categoryId,
                    status: 'open',
                }
            });

            // İstatistikleri güncelle
            await prisma.guildStats.update({
                where: { guildId },
                data: {
                    totalTickets: { increment: 1 },
                    openTickets: { increment: 1 },
                }
            });

            logger.info(`Ticket oluşturuldu: #${ticketNumber} (${channelId})`);
            return ticket;
        } catch (error) {
            logger.error('Ticket create hatası:', error);
            throw error;
        }
    },

    // Ticket getir
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

    // Kullanıcının aktif ticketını getir
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

    // Ticket güncelle
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

    // Ticket claim et
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

    // Ticket kapat
    async close(channelId, closedBy, closeReason = null) {
        try {
            const ticket = await prisma.ticket.update({
                where: { channelId },
                data: {
                    status: 'closed',
                    closedBy,
                    closeReason,
                    closedAt: new Date(),
                }
            });

            // İstatistikleri güncelle
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

    // Mesaj sayısını artır
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
            // Hata olsa da devam et (kritik değil)
            logger.warn('Mesaj sayısı güncellenemedi:', error.message);
        }
    },

    // İnaktif ticketları getir (auto-close için)
    async getInactiveTickets(hours = 24) {
        try {
            const cutoffTime = new Date();
            cutoffTime.setHours(cutoffTime.getHours() - hours);

            return await prisma.ticket.findMany({
                where: {
                    status: { in: ['open', 'claimed'] },
                    lastActivity: { lt: cutoffTime }
                },
                include: {
                    guild: true,
                }
            });
        } catch (error) {
            logger.error('getInactiveTickets hatası:', error);
            throw error;
        }
    },
};

// Category Helper Functions
export const categoryDB = {
    // Kategori oluştur
    async create(guildId, name, options = {}) {
        try {
            return await prisma.category.create({
                data: {
                    guildId,
                    name,
                    ...options,
                }
            });
        } catch (error) {
            logger.error('Category create hatası:', error);
            throw error;
        }
    },

    // Guild'in kategorilerini getir
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
};

// User Helper Functions
export const userDB = {
    // Kullanıcıyı getir veya oluştur
    async getOrCreate(userId, username) {
        try {
            let user = await prisma.user.findUnique({
                where: { id: userId }
            });

            if (!user) {
                user = await prisma.user.create({
                    data: {
                        id: userId,
                        username,
                    }
                });
            }

            return user;
        } catch (error) {
            logger.error('User getOrCreate hatası:', error);
            throw error;
        }
    },

    // Blacklist kontrolü
    async isBlacklisted(userId) {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { blacklisted: true, blacklistReason: true }
            });

            return user?.blacklisted || false;
        } catch (error) {
            logger.error('isBlacklisted hatası:', error);
            return false;
        }
    },

    // Blacklist ekle/çıkar
    async setBlacklist(userId, blacklisted, reason = null) {
        try {
            return await prisma.user.update({
                where: { id: userId },
                data: {
                    blacklisted,
                    blacklistReason: reason,
                }
            });
        } catch (error) {
            logger.error('setBlacklist hatası:', error);
            throw error;
        }
    },
};

export default prisma;