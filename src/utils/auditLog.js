import { auditDB } from './database.js';
import logger from './logger.js';

// Audit Actions
export const AuditActions = {
    // Bot
    BOT_SETUP: 'BOT_SETUP',
    BOT_CONFIG_UPDATE: 'BOT_CONFIG_UPDATE',
    
    // Tickets
    TICKET_CREATE: 'TICKET_CREATE',
    TICKET_CLOSE: 'TICKET_CLOSE',
    TICKET_CLAIM: 'TICKET_CLAIM',
    TICKET_UNCLAIM: 'TICKET_UNCLAIM',
    TICKET_TRANSFER: 'TICKET_TRANSFER',
    TICKET_REOPEN: 'TICKET_REOPEN',
    TICKET_ARCHIVE: 'TICKET_ARCHIVE',
    TICKET_PRIORITY_CHANGE: 'TICKET_PRIORITY_CHANGE',
    TICKET_TAG_ADD: 'TICKET_TAG_ADD',
    TICKET_TAG_REMOVE: 'TICKET_TAG_REMOVE',
    TICKET_USER_ADD: 'TICKET_USER_ADD',
    TICKET_USER_REMOVE: 'TICKET_USER_REMOVE',
    TICKET_MOVE: 'TICKET_MOVE',
    TICKET_RENAME: 'TICKET_RENAME',
    
    // Categories
    CATEGORY_CREATE: 'CATEGORY_CREATE',
    CATEGORY_UPDATE: 'CATEGORY_UPDATE',
    CATEGORY_DELETE: 'CATEGORY_DELETE',
    
    // Users
    USER_BLACKLIST: 'USER_BLACKLIST',
    USER_UNBLACKLIST: 'USER_UNBLACKLIST',
    
    // Canned Responses
    CANNED_CREATE: 'CANNED_CREATE',
    CANNED_UPDATE: 'CANNED_UPDATE',
    CANNED_DELETE: 'CANNED_DELETE',
    
    // API
    API_KEY_CREATE: 'API_KEY_CREATE',
    API_KEY_DELETE: 'API_KEY_DELETE',
};

// Target Types
export const TargetTypes = {
    TICKET: 'TICKET',
    USER: 'USER',
    CATEGORY: 'CATEGORY',
    CANNED: 'CANNED',
    API_KEY: 'API_KEY',
    SYSTEM: 'SYSTEM',
};

/**
 * Log an audit action
 */
export async function logAudit({ guildId, action, targetType, userId, userName, targetId = null, details = null }) {
    try {
        await auditDB.log(guildId, action, targetType, userId, userName, targetId, details);
        logger.debug(`Audit log: ${action} by ${userName} on ${targetType}:${targetId}`);
    } catch (error) {
        logger.error('Audit log error:', error);
    }
}

export default { AuditActions, TargetTypes, logAudit };
