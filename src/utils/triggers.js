import { prisma } from './database.js';
import logger from './logger.js';

/**
 * Trigger oluştur
 */
export async function createTrigger(guildId, data) {
    try {
        const trigger = await prisma.keywordTrigger.create({
            data: {
                guildId,
                keywords: data.keywords,
                matchType: data.matchType || 'contains',
                autoCategory: data.autoCategory || null,
                autoPriority: data.autoPriority || null,
                autoTags: data.autoTags || null,
                autoResponse: data.autoResponse || null,
                autoAssignRole: data.autoAssignRole || null,
                enabled: data.enabled ?? true,
            },
        });

        logger.info(`Trigger created: ${trigger.keywords}`);
        return trigger;

    } catch (error) {
        logger.error('Create trigger error:', error);
        throw error;
    }
}

/**
 * Trigger güncelle
 */
export async function updateTrigger(triggerId, data) {
    try {
        return await prisma.keywordTrigger.update({
            where: { id: triggerId },
            data,
        });
    } catch (error) {
        logger.error('Update trigger error:', error);
        throw error;
    }
}

/**
 * Trigger sil
 */
export async function deleteTrigger(triggerId) {
    try {
        await prisma.keywordTrigger.delete({
            where: { id: triggerId },
        });
        return true;
    } catch (error) {
        logger.error('Delete trigger error:', error);
        throw error;
    }
}

/**
 * Tüm triggerleri getir
 */
export async function getTriggers(guildId) {
    try {
        return await prisma.keywordTrigger.findMany({
            where: { guildId },
            orderBy: { createdAt: 'desc' },
        });
    } catch (error) {
        logger.error('Get triggers error:', error);
        return [];
    }
}

/**
 * Aktif triggerleri getir
 */
export async function getActiveTriggers(guildId) {
    try {
        return await prisma.keywordTrigger.findMany({
            where: { guildId, enabled: true },
        });
    } catch (error) {
        logger.error('Get active triggers error:', error);
        return [];
    }
}

/**
 * Mesajı triggerlara karşı kontrol et
 */
export async function checkTriggers(guildId, content) {
    try {
        const triggers = await getActiveTriggers(guildId);
        const matchedTriggers = [];

        for (const trigger of triggers) {
            const keywords = trigger.keywords.split(',').map(k => k.trim().toLowerCase());
            const contentLower = content.toLowerCase();

            let matched = false;

            switch (trigger.matchType) {
                case 'exact':
                    matched = keywords.some(k => contentLower === k);
                    break;
                case 'startswith':
                    matched = keywords.some(k => contentLower.startsWith(k));
                    break;
                case 'endswith':
                    matched = keywords.some(k => contentLower.endsWith(k));
                    break;
                case 'regex':
                    try {
                        matched = keywords.some(k => new RegExp(k, 'i').test(content));
                    } catch (e) {
                        // Invalid regex
                    }
                    break;
                case 'contains':
                default:
                    matched = keywords.some(k => contentLower.includes(k));
                    break;
            }

            if (matched) {
                matchedTriggers.push(trigger);
                
                // Kullanım sayısını artır
                await prisma.keywordTrigger.update({
                    where: { id: trigger.id },
                    data: { triggerCount: { increment: 1 } },
                });
            }
        }

        return matchedTriggers;

    } catch (error) {
        logger.error('Check triggers error:', error);
        return [];
    }
}

/**
 * Trigger sonuçlarını birleştir
 */
export function mergeTriggersResults(triggers) {
    const result = {
        category: null,
        priority: null,
        tags: [],
        response: null,
        assignRole: null,
    };

    for (const trigger of triggers) {
        // İlk bulunan kategoriyi kullan
        if (!result.category && trigger.autoCategory) {
            result.category = trigger.autoCategory;
        }

        // En yüksek önceliği kullan
        if (trigger.autoPriority && (!result.priority || trigger.autoPriority > result.priority)) {
            result.priority = trigger.autoPriority;
        }

        // Tagleri birleştir
        if (trigger.autoTags) {
            const tags = trigger.autoTags.split(',').map(t => t.trim());
            result.tags.push(...tags);
        }

        // İlk yanıtı kullan
        if (!result.response && trigger.autoResponse) {
            result.response = trigger.autoResponse;
        }

        // İlk assign role'ü kullan
        if (!result.assignRole && trigger.autoAssignRole) {
            result.assignRole = trigger.autoAssignRole;
        }
    }

    // Tagleri unique yap
    result.tags = [...new Set(result.tags)];

    return result;
}

/**
 * Ticket için triggerleri uygula
 */
export async function applyTriggers(guildId, ticketContent) {
    const matchedTriggers = await checkTriggers(guildId, ticketContent);
    
    if (matchedTriggers.length === 0) {
        return null;
    }

    const result = mergeTriggersResults(matchedTriggers);
    
    logger.info(`${matchedTriggers.length} triggers matched for content`);
    
    return {
        ...result,
        matchedTriggers,
    };
}

/**
 * Trigger istatistikleri
 */
export async function getTriggerStats(guildId) {
    try {
        const triggers = await getTriggers(guildId);
        
        return {
            total: triggers.length,
            active: triggers.filter(t => t.enabled).length,
            totalUsage: triggers.reduce((sum, t) => sum + t.triggerCount, 0),
            topUsed: triggers.sort((a, b) => b.triggerCount - a.triggerCount).slice(0, 5),
        };

    } catch (error) {
        logger.error('Get trigger stats error:', error);
        return null;
    }
}

export default {
    createTrigger,
    updateTrigger,
    deleteTrigger,
    getTriggers,
    getActiveTriggers,
    checkTriggers,
    mergeTriggersResults,
    applyTriggers,
    getTriggerStats,
};
