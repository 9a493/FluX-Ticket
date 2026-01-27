import { guildDB, staffDB } from './database.js';
import logger from './logger.js';

// Son atanan staff index (round-robin için)
const lastAssignedIndex = new Map();

/**
 * Ticket için otomatik yetkili ata
 */
export async function autoAssignTicket(guildId, categoryId = null) {
    try {
        const guildConfig = await guildDB.getOrCreate(guildId, 'Unknown');
        
        if (!guildConfig.autoAssignEnabled) {
            return null;
        }

        // Müsait yetkilileri al
        const availableStaff = await staffDB.getAvailableForAssign(guildId);
        
        if (availableStaff.length === 0) {
            return null;
        }

        let selectedStaff = null;

        switch (guildConfig.autoAssignMode) {
            case 'round-robin':
                selectedStaff = await roundRobinAssign(guildId, availableStaff);
                break;
            case 'load-based':
                selectedStaff = await loadBasedAssign(availableStaff);
                break;
            case 'rating-based':
                selectedStaff = await ratingBasedAssign(availableStaff);
                break;
            case 'random':
                selectedStaff = randomAssign(availableStaff);
                break;
            default:
                selectedStaff = await roundRobinAssign(guildId, availableStaff);
        }

        if (selectedStaff) {
            // Yükü artır
            await staffDB.incrementLoad(guildId, selectedStaff.userId);
            logger.info(`Auto-assigned to ${selectedStaff.username} (${guildConfig.autoAssignMode})`);
        }

        return selectedStaff;

    } catch (error) {
        logger.error('Auto-assign error:', error);
        return null;
    }
}

/**
 * Round-robin atama
 */
async function roundRobinAssign(guildId, staffList) {
    if (staffList.length === 0) return null;

    // Son atanan indexi al
    let lastIndex = lastAssignedIndex.get(guildId) || -1;
    
    // Sonraki index
    let nextIndex = (lastIndex + 1) % staffList.length;
    
    // Güncelle
    lastAssignedIndex.set(guildId, nextIndex);
    
    return staffList[nextIndex];
}

/**
 * Yük bazlı atama (en az yükü olana ata)
 */
async function loadBasedAssign(staffList) {
    if (staffList.length === 0) return null;

    // Yüke göre sırala (düşükten yükseğe)
    const sorted = [...staffList].sort((a, b) => {
        // Önce current load
        if (a.currentLoad !== b.currentLoad) {
            return a.currentLoad - b.currentLoad;
        }
        // Eşitse weight'e göre (yüksek weight öncelikli)
        return b.autoAssignWeight - a.autoAssignWeight;
    });

    return sorted[0];
}

/**
 * Rating bazlı atama (en yüksek ratinge ata)
 */
async function ratingBasedAssign(staffList) {
    if (staffList.length === 0) return null;

    // Rating'e göre sırala (yüksekten düşüğe)
    // Ama önce kapasiteyi kontrol et
    const availableStaff = staffList.filter(s => s.currentLoad < s.maxLoad);
    
    if (availableStaff.length === 0) return null;

    const sorted = [...availableStaff].sort((a, b) => {
        // Önce rating
        if (b.averageRating !== a.averageRating) {
            return b.averageRating - a.averageRating;
        }
        // Eşitse ticket sayısına göre
        return b.ticketsClosed - a.ticketsClosed;
    });

    return sorted[0];
}

/**
 * Rastgele atama
 */
function randomAssign(staffList) {
    if (staffList.length === 0) return null;
    
    const randomIndex = Math.floor(Math.random() * staffList.length);
    return staffList[randomIndex];
}

/**
 * Ticket kapatıldığında yükü azalt
 */
export async function releaseAssignment(guildId, userId) {
    try {
        await staffDB.decrementLoad(guildId, userId);
    } catch (error) {
        logger.error('Release assignment error:', error);
    }
}

/**
 * Staff'ı auto-assign'dan çıkar/ekle
 */
export async function toggleStaffAutoAssign(guildId, userId, enabled) {
    try {
        await staffDB.updateAutoAssign(guildId, userId, enabled);
        return true;
    } catch (error) {
        logger.error('Toggle staff auto-assign error:', error);
        return false;
    }
}

/**
 * Staff yüklerini sıfırla (günlük)
 */
export async function resetDailyLoads(guildId) {
    try {
        await staffDB.resetAllLoads(guildId);
        lastAssignedIndex.delete(guildId);
        logger.info(`Daily loads reset for guild ${guildId}`);
    } catch (error) {
        logger.error('Reset daily loads error:', error);
    }
}

export default {
    autoAssignTicket,
    releaseAssignment,
    toggleStaffAutoAssign,
    resetDailyLoads,
};
