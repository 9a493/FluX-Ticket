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

// ==================== GUILD FUNCTIONS ====================
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

    // Guild sil
    async delete(guildId) {
        try {
            return await prisma.guild.delete({
                where: { id: guildId },
            });
        } catch (error) {
            logger.error('Guild delete hatası:', error);
            throw error;
        }
    },
};

// ==================== TICKET FUNCTIONS ====================
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

            // Kullanıcı ticket sayısını artır
            await userDB.incrementTicketCount(userId);

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

    // Ticket ID ile getir
    async getById(ticketId) {
        try {
            return await prisma.ticket.findUnique({
                where: { id: ticketId },
                include: {
                    guild: true,
                    category: true,
                }
            });
        } catch (error) {
            logger.error('Ticket getById hatası:', error);
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

    // Kullanıcının toplam aktif ticket sayısı
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
            logger.error('getUserTicketCount hatası:', error);
            return 0;
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

    // Ticket unclaim et
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

    // Ticket kapat
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

    // Ticket yeniden aç
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

            // İstatistikleri güncelle
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
            // logger.warn('Mesaj sayısı güncellenemedi:', error.message);
        }
    },

    // Öncelik güncelle
    async setPriority(channelId, priority) {
        try {
            return await prisma.ticket.update({
                where: { channelId },
                data: { priority },
            });
        } catch (error) {
            logger.error('Ticket setPriority hatası:', error);
            throw error;
        }
    },

    // Tag ekle
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
                data: { tags: currentTags.join(',') },
            });
        } catch (error) {
            logger.error('Ticket addTag hatası:', error);
            throw error;
        }
    },

    // Tag kaldır
    async removeTag(channelId, tag) {
        try {
            const ticket = await prisma.ticket.findUnique({
                where: { channelId },
                select: { tags: true }
            });

            const currentTags = ticket?.tags ? ticket.tags.split(',').filter(t => t && t !== tag) : [];

            return await prisma.ticket.update({
                where: { channelId },
                data: { tags: currentTags.join(',') },
            });
        } catch (error) {
            logger.error('Ticket removeTag hatası:', error);
            throw error;
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

    // Guild'in tüm açık ticketlarını getir
    async getOpenTickets(guildId) {
        try {
            return await prisma.ticket.findMany({
                where: {
                    guildId,
                    status: { in: ['open', 'claimed'] }
                },
                orderBy: { createdAt: 'desc' }
            });
        } catch (error) {
            logger.error('getOpenTickets hatası:', error);
            throw error;
        }
    },

    // Yetkili istatistikleri
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
    // Kategori oluştur
    async create(guildId, name, options = {}) {
        try {
            // Sıralama için son kategori numarasını al
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

    // Kategori getir
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

    // Kategori güncelle
    async update(categoryId, data) {
        try {
            return await prisma.category.update({
                where: { id: categoryId },
                data,
            });
        } catch (error) {
            logger.error('Category update hatası:', error);
            throw error;
        }
    },

    // Kategori sil
    async delete(categoryId) {
        try {
            return await prisma.category.delete({
                where: { id: categoryId },
            });
        } catch (error) {
            logger.error('Category delete hatası:', error);
            throw error;
        }
    },
};

// ==================== USER FUNCTIONS ====================
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

    // Kullanıcı getir
    async get(userId) {
        try {
            return await prisma.user.findUnique({
                where: { id: userId }
            });
        } catch (error) {
            logger.error('User get hatası:', error);
            return null;
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

    // Blacklist ekle
    async addBlacklist(userId, username, reason = null) {
        try {
            return await prisma.user.upsert({
                where: { id: userId },
                update: {
                    blacklisted: true,
                    blacklistReason: reason,
                },
                create: {
                    id: userId,
                    username,
                    blacklisted: true,
                    blacklistReason: reason,
                }
            });
        } catch (error) {
            logger.error('addBlacklist hatası:', error);
            throw error;
        }
    },

    // Blacklist kaldır
    async removeBlacklist(userId) {
        try {
            return await prisma.user.update({
                where: { id: userId },
                data: {
                    blacklisted: false,
                    blacklistReason: null,
                }
            });
        } catch (error) {
            logger.error('removeBlacklist hatası:', error);
            throw error;
        }
    },

    // Ticket sayısını artır
    async incrementTicketCount(userId) {
        try {
            await prisma.user.updateMany({
                where: { id: userId },
                data: { totalTickets: { increment: 1 } }
            });
        } catch (error) {
            // Kullanıcı yoksa hata verme
        }
    },
};

// ==================== CANNED RESPONSE FUNCTIONS ====================
export const cannedDB = {
    // Hazır yanıt oluştur
    async create(guildId, name, content, createdBy) {
        try {
            return await prisma.cannedResponse.create({
                data: {
                    guildId,
                    name: name.toLowerCase(),
                    content,
                    createdBy,
                }
            });
        } catch (error) {
            logger.error('CannedResponse create hatası:', error);
            throw error;
        }
    },

    // Hazır yanıt getir
    async get(guildId, name) {
        try {
            return await prisma.cannedResponse.findUnique({
                where: {
                    guildId_name: {
                        guildId,
                        name: name.toLowerCase(),
                    }
                }
            });
        } catch (error) {
            logger.error('CannedResponse get hatası:', error);
            return null;
        }
    },

    // Tüm hazır yanıtları getir
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

    // Hazır yanıt güncelle
    async update(guildId, name, data) {
        try {
            return await prisma.cannedResponse.update({
                where: {
                    guildId_name: {
                        guildId,
                        name: name.toLowerCase(),
                    }
                },
                data,
            });
        } catch (error) {
            logger.error('CannedResponse update hatası:', error);
            throw error;
        }
    },

    // Kullanım sayısını artır
    async incrementUse(guildId, name) {
        try {
            return await prisma.cannedResponse.update({
                where: {
                    guildId_name: {
                        guildId,
                        name: name.toLowerCase(),
                    }
                },
                data: { useCount: { increment: 1 } }
            });
        } catch (error) {
            logger.error('CannedResponse incrementUse hatası:', error);
        }
    },

    // Hazır yanıt sil
    async delete(guildId, name) {
        try {
            return await prisma.cannedResponse.delete({
                where: {
                    guildId_name: {
                        guildId,
                        name: name.toLowerCase(),
                    }
                }
            });
        } catch (error) {
            logger.error('CannedResponse delete hatası:', error);
            throw error;
        }
    },
};

// ==================== STATS FUNCTIONS ====================
export const statsDB = {
    // Guild istatistiklerini getir
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

    // Ortalama değerlendirmeyi güncelle
    async updateAverageRating(guildId) {
        try {
            const result = await prisma.ticket.aggregate({
                where: { guildId, rating: { not: null } },
                _avg: { rating: true }
            });

            return await prisma.guildStats.update({
                where: { guildId },
                data: { averageRating: result._avg.rating }
            });
        } catch (error) {
            logger.error('updateAverageRating hatası:', error);
        }
    },

    // Detaylı istatistikler
    async getDetailed(guildId) {
        try {
            const stats = await prisma.guildStats.findUnique({
                where: { guildId }
            });

            // Bugün açılan ticketlar
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const todayTickets = await prisma.ticket.count({
                where: {
                    guildId,
                    createdAt: { gte: today }
                }
            });

            // Bu hafta açılan ticketlar
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);

            const weekTickets = await prisma.ticket.count({
                where: {
                    guildId,
                    createdAt: { gte: weekAgo }
                }
            });

            // Kategoriye göre dağılım
            const categoryStats = await prisma.ticket.groupBy({
                by: ['categoryId'],
                where: { guildId },
                _count: { id: true }
            });

            // En aktif yetkililer
            const topStaff = await prisma.ticket.groupBy({
                by: ['claimedBy'],
                where: { guildId, claimedBy: { not: null } },
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
                take: 5
            });

            return {
                ...stats,
                todayTickets,
                weekTickets,
                categoryStats,
                topStaff,
            };
        } catch (error) {
            logger.error('getDetailed hatası:', error);
            throw error;
        }
    },
};

export default prisma;
