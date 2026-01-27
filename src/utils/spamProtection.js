import { prisma } from './database.js';
import logger from './logger.js';

// In-memory spam tracking
const spamTracker = new Map();

/**
 * Spam kontrolü yap
 */
export async function checkSpam(guildId, userId, guildConfig) {
    if (!guildConfig.spamProtection) {
        return { isSpam: false };
    }

    const maxTickets = guildConfig.spamMaxTickets || 5;
    const timeframeMins = guildConfig.spamTimeframeMins || 60;
    const key = `${guildId}:${userId}`;
    const now = Date.now();
    const cutoff = now - (timeframeMins * 60 * 1000);

    // Get user's ticket history
    if (!spamTracker.has(key)) {
        spamTracker.set(key, []);
    }

    const history = spamTracker.get(key);
    
    // Clean old entries
    const filtered = history.filter(timestamp => timestamp > cutoff);
    spamTracker.set(key, filtered);

    // Check if exceeds limit
    if (filtered.length >= maxTickets) {
        logger.warn(`Spam detected: ${userId} in guild ${guildId} (${filtered.length} tickets in ${timeframeMins} mins)`);
        return {
            isSpam: true,
            count: filtered.length,
            maxAllowed: maxTickets,
            resetIn: Math.ceil((filtered[0] + (timeframeMins * 60 * 1000) - now) / 60000),
        };
    }

    return { isSpam: false };
}

/**
 * Ticket oluşturulduğunda kaydet
 */
export function recordTicketCreation(guildId, userId) {
    const key = `${guildId}:${userId}`;
    
    if (!spamTracker.has(key)) {
        spamTracker.set(key, []);
    }

    spamTracker.get(key).push(Date.now());
}

/**
 * Spam sayacını sıfırla
 */
export function resetSpamCounter(guildId, userId) {
    const key = `${guildId}:${userId}`;
    spamTracker.delete(key);
}

/**
 * Flood tespiti (çok hızlı mesaj)
 */
const floodTracker = new Map();

export function checkFlood(channelId, userId, maxMessages = 5, seconds = 10) {
    const key = `${channelId}:${userId}`;
    const now = Date.now();
    const cutoff = now - (seconds * 1000);

    if (!floodTracker.has(key)) {
        floodTracker.set(key, []);
    }

    const history = floodTracker.get(key);
    const filtered = history.filter(timestamp => timestamp > cutoff);
    filtered.push(now);
    floodTracker.set(key, filtered);

    return filtered.length > maxMessages;
}

/**
 * Duplicate content tespiti
 */
const contentTracker = new Map();

export function checkDuplicateContent(guildId, userId, content) {
    const key = `${guildId}:${userId}`;
    const hash = simpleHash(content.toLowerCase().trim());
    
    if (!contentTracker.has(key)) {
        contentTracker.set(key, new Set());
    }

    const history = contentTracker.get(key);
    
    if (history.has(hash)) {
        return true;
    }

    history.add(hash);
    
    // Max 10 content hash tut
    if (history.size > 10) {
        const first = history.values().next().value;
        history.delete(first);
    }

    return false;
}

/**
 * Basit hash fonksiyonu
 */
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(16);
}

/**
 * Rate limit kontrolü
 */
const rateLimiter = new Map();

export function checkRateLimit(identifier, maxRequests = 10, windowMs = 60000) {
    const now = Date.now();
    
    if (!rateLimiter.has(identifier)) {
        rateLimiter.set(identifier, { count: 1, resetAt: now + windowMs });
        return { limited: false, remaining: maxRequests - 1 };
    }

    const limit = rateLimiter.get(identifier);

    if (now > limit.resetAt) {
        rateLimiter.set(identifier, { count: 1, resetAt: now + windowMs });
        return { limited: false, remaining: maxRequests - 1 };
    }

    limit.count++;

    if (limit.count > maxRequests) {
        return { 
            limited: true, 
            remaining: 0,
            resetIn: Math.ceil((limit.resetAt - now) / 1000),
        };
    }

    return { limited: false, remaining: maxRequests - limit.count };
}

/**
 * Cleanup eski veriler (her saat çalıştır)
 */
export function cleanupSpamData() {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);

    // Spam tracker cleanup
    for (const [key, history] of spamTracker) {
        const filtered = history.filter(timestamp => timestamp > oneHourAgo);
        if (filtered.length === 0) {
            spamTracker.delete(key);
        } else {
            spamTracker.set(key, filtered);
        }
    }

    // Flood tracker cleanup
    for (const [key, history] of floodTracker) {
        const filtered = history.filter(timestamp => timestamp > oneHourAgo);
        if (filtered.length === 0) {
            floodTracker.delete(key);
        } else {
            floodTracker.set(key, filtered);
        }
    }

    // Rate limiter cleanup
    for (const [key, limit] of rateLimiter) {
        if (now > limit.resetAt) {
            rateLimiter.delete(key);
        }
    }

    logger.debug('Spam data cleanup completed');
}

// Her saat cleanup çalıştır
setInterval(cleanupSpamData, 60 * 60 * 1000);

export default {
    checkSpam,
    recordTicketCreation,
    resetSpamCounter,
    checkFlood,
    checkDuplicateContent,
    checkRateLimit,
    cleanupSpamData,
};
