import { EmbedBuilder } from 'discord.js';
import { prisma } from './database.js';
import logger from './logger.js';

// Audit Log Action Types
export const AuditActions = {
    // Ticket Actions
    TICKET_CREATE: 'ticket_create',
    TICKET_CLOSE: 'ticket_close',
    TICKET_REOPEN: 'ticket_reopen',
    TICKET_CLAIM: 'ticket_claim',
    TICKET_UNCLAIM: 'ticket_unclaim',
    TICKET_TRANSFER: 'ticket_transfer',
    TICKET_MOVE: 'ticket_move',
    TICKET_ARCHIVE: 'ticket_archive',
    TICKET_PRIORITY: 'ticket_priority',
    TICKET_TAG_ADD: 'ticket_tag_add',
    TICKET_TAG_REMOVE: 'ticket_tag_remove',
    TICKET_ASSIGN: 'ticket_assign',
    TICKET_ESCALATE: 'ticket_escalate',
    TICKET_MERGE: 'ticket_merge',
    
    // User Actions
    USER_ADD: 'user_add',
    USER_REMOVE: 'user_remove',
    USER_BLACKLIST: 'user_blacklist',
    USER_UNBLACKLIST: 'user_unblacklist',
    
    // Settings Actions
    SETTINGS_UPDATE: 'settings_update',
    CATEGORY_CREATE: 'category_create',
    CATEGORY_UPDATE: 'category_update',
    CATEGORY_DELETE: 'category_delete',
    CANNED_CREATE: 'canned_create',
    CANNED_UPDATE: 'canned_update',
    CANNED_DELETE: 'canned_delete',
    TEMPLATE_CREATE: 'template_create',
    TEMPLATE_UPDATE: 'template_update',
    TEMPLATE_DELETE: 'template_delete',
    
    // Knowledge Base
    KB_CREATE: 'kb_create',
    KB_UPDATE: 'kb_update',
    KB_DELETE: 'kb_delete',
    
    // Staff Actions
    STAFF_ADD: 'staff_add',
    STAFF_REMOVE: 'staff_remove',
    STAFF_PERMISSION: 'staff_permission',
    
    // API Actions
    API_KEY_CREATE: 'api_key_create',
    API_KEY_DELETE: 'api_key_delete',
    
    // System
    BOT_SETUP: 'bot_setup',
    PANEL_SEND: 'panel_send',
};

// Target Types
export const TargetTypes = {
    TICKET: 'ticket',
    USER: 'user',
    CATEGORY: 'category',
    CANNED: 'canned',
    TEMPLATE: 'template',
    KB_ARTICLE: 'kb_article',
    SETTINGS: 'settings',
    STAFF: 'staff',
    API_KEY: 'api_key',
    SYSTEM: 'system',
};

/**
 * Audit log kaydı oluştur
 */
export async function logAudit({
    guildId,
    action,
    targetType,
    targetId = null,
    userId,
    userName,
    oldValue = null,
    newValue = null,
    details = null,
    ipAddress = null,
    userAgent = null,
}) {
    try {
        const log = await prisma.auditLog.create({
            data: {
                guildId,
                action,
                targetType,
                targetId,
                userId,
                userName,
                oldValue: oldValue ? JSON.stringify(oldValue) : null,
                newValue: newValue ? JSON.stringify(newValue) : null,
                details,
                ipAddress,
                userAgent,
            },
        });

        logger.debug(`Audit: ${action} by ${userName} on ${targetType}:${targetId}`);
        return log;

    } catch (error) {
        logger.error('Audit log error:', error);
        return null;
    }
}

/**
 * Audit logları getir
 */
export async function getAuditLogs(guildId, options = {}) {
    const {
        action = null,
        targetType = null,
        targetId = null,
        userId = null,
        limit = 50,
        offset = 0,
        startDate = null,
        endDate = null,
    } = options;

    try {
        const where = { guildId };

        if (action) where.action = action;
        if (targetType) where.targetType = targetType;
        if (targetId) where.targetId = targetId;
        if (userId) where.userId = userId;

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate);
            if (endDate) where.createdAt.lte = new Date(endDate);
        }

        const logs = await prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
        });

        return logs.map(log => ({
            ...log,
            oldValue: log.oldValue ? JSON.parse(log.oldValue) : null,
            newValue: log.newValue ? JSON.parse(log.newValue) : null,
        }));

    } catch (error) {
        logger.error('Get audit logs error:', error);
        return [];
    }
}

/**
 * Ticket için audit logları getir
 */
export async function getTicketAuditLogs(guildId, ticketId) {
    return getAuditLogs(guildId, {
        targetType: TargetTypes.TICKET,
        targetId: ticketId,
        limit: 100,
    });
}

/**
 * Kullanıcı için audit logları getir
 */
export async function getUserAuditLogs(guildId, userId, limit = 50) {
    return getAuditLogs(guildId, { userId, limit });
}

/**
 * Audit log embed'i oluştur
 */
export function createAuditEmbed(log) {
    const actionEmojis = {
        ticket_create: '📬',
        ticket_close: '🔒',
        ticket_reopen: '🔓',
        ticket_claim: '✋',
        ticket_unclaim: '👋',
        ticket_transfer: '🔄',
        ticket_move: '📁',
        ticket_archive: '📦',
        ticket_priority: '🎯',
        user_add: '➕',
        user_remove: '➖',
        user_blacklist: '🚫',
        user_unblacklist: '✅',
        settings_update: '⚙️',
        category_create: '📁',
        category_delete: '🗑️',
        default: '📝',
    };

    const emoji = actionEmojis[log.action] || actionEmojis.default;
    const actionName = log.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`${emoji} ${actionName}`)
        .addFields(
            { name: '👤 Yapan', value: `${log.userName} (<@${log.userId}>)`, inline: true },
            { name: '🎯 Hedef', value: `${log.targetType}: ${log.targetId || 'N/A'}`, inline: true },
        )
        .setTimestamp(new Date(log.createdAt));

    if (log.details) {
        embed.addFields({ name: '📝 Detaylar', value: log.details, inline: false });
    }

    if (log.oldValue && log.newValue) {
        embed.addFields(
            { name: '📤 Önceki', value: `\`\`\`json\n${JSON.stringify(log.oldValue, null, 2).substring(0, 500)}\`\`\``, inline: true },
            { name: '📥 Yeni', value: `\`\`\`json\n${JSON.stringify(log.newValue, null, 2).substring(0, 500)}\`\`\``, inline: true },
        );
    }

    return embed;
}

/**
 * Audit logları temizle (eski kayıtları sil)
 */
export async function cleanupAuditLogs(guildId, daysToKeep = 90) {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        const result = await prisma.auditLog.deleteMany({
            where: {
                guildId,
                createdAt: { lt: cutoffDate },
            },
        });

        logger.info(`Cleaned up ${result.count} audit logs older than ${daysToKeep} days`);
        return result.count;

    } catch (error) {
        logger.error('Cleanup audit logs error:', error);
        return 0;
    }
}

export default {
    logAudit,
    getAuditLogs,
    getTicketAuditLogs,
    getUserAuditLogs,
    createAuditEmbed,
    cleanupAuditLogs,
    AuditActions,
    TargetTypes,
};
