import { EmbedBuilder } from 'discord.js';
import { staffDB } from './database.js';
import logger from './logger.js';

// XP Rewards
const XP_REWARDS = {
    CLAIM_TICKET: 10,
    CLOSE_TICKET: 25,
    FIRST_RESPONSE: 15,
    FAST_RESPONSE: 20,      // < 5 dakika
    FIVE_STAR_RATING: 50,
    FOUR_STAR_RATING: 30,
    THREE_STAR_RATING: 15,
    HELP_USER: 5,           // Her mesaj
    DAILY_BONUS: 100,
    STREAK_BONUS: 25,       // Her streak günü için
};

// Level Thresholds
const LEVELS = [
    { level: 1, xp: 0, title: 'Çaylak' },
    { level: 2, xp: 100, title: 'Asistan' },
    { level: 3, xp: 300, title: 'Destek Uzmanı' },
    { level: 4, xp: 600, title: 'Kıdemli Destek' },
    { level: 5, xp: 1000, title: 'Süpervizör' },
    { level: 6, xp: 1500, title: 'Takım Lideri' },
    { level: 7, xp: 2500, title: 'Usta' },
    { level: 8, xp: 4000, title: 'Uzman' },
    { level: 9, xp: 6000, title: 'Efsane' },
    { level: 10, xp: 10000, title: 'Grandmaster' },
];

// Badge Definitions
const BADGES = {
    // Ticket Badges
    FIRST_TICKET: { id: 'first_ticket', name: 'İlk Adım', emoji: '🎯', description: 'İlk ticketını kapat', requirement: { ticketsClosed: 1 } },
    TICKET_10: { id: 'ticket_10', name: 'Yardımsever', emoji: '🤝', description: '10 ticket kapat', requirement: { ticketsClosed: 10 } },
    TICKET_50: { id: 'ticket_50', name: 'Destek Kahramanı', emoji: '🦸', description: '50 ticket kapat', requirement: { ticketsClosed: 50 } },
    TICKET_100: { id: 'ticket_100', name: 'Yüzbaşı', emoji: '💯', description: '100 ticket kapat', requirement: { ticketsClosed: 100 } },
    TICKET_500: { id: 'ticket_500', name: 'Efsane', emoji: '🏆', description: '500 ticket kapat', requirement: { ticketsClosed: 500 } },
    
    // Rating Badges
    FIVE_STAR: { id: 'five_star', name: 'Mükemmeliyetçi', emoji: '⭐', description: 'İlk 5 yıldızını al', requirement: { fiveStars: 1 } },
    RATING_MASTER: { id: 'rating_master', name: 'Rating Ustası', emoji: '🌟', description: '4.5+ ortalama (min 20 rating)', requirement: { avgRating: 4.5, minRatings: 20 } },
    
    // Speed Badges
    SPEED_DEMON: { id: 'speed_demon', name: 'Hız Şeytanı', emoji: '⚡', description: '< 2 dakika ortalama yanıt', requirement: { avgResponse: 2 } },
    QUICK_DRAW: { id: 'quick_draw', name: 'Hızlı Silahşör', emoji: '🔫', description: '10 ticket < 1 dakikada yanıtla', requirement: { quickResponses: 10 } },
    
    // Streak Badges
    STREAK_7: { id: 'streak_7', name: 'Haftalık Seri', emoji: '🔥', description: '7 gün üst üste aktif ol', requirement: { streak: 7 } },
    STREAK_30: { id: 'streak_30', name: 'Aylık Seri', emoji: '💎', description: '30 gün üst üste aktif ol', requirement: { streak: 30 } },
    STREAK_100: { id: 'streak_100', name: 'Adanmış', emoji: '👑', description: '100 gün üst üste aktif ol', requirement: { streak: 100 } },
    
    // Special Badges
    NIGHT_OWL: { id: 'night_owl', name: 'Gece Kuşu', emoji: '🦉', description: '00:00-06:00 arası 10 ticket kapat', requirement: { nightTickets: 10 } },
    WEEKEND_WARRIOR: { id: 'weekend_warrior', name: 'Hafta Sonu Savaşçısı', emoji: '⚔️', description: 'Hafta sonu 20 ticket kapat', requirement: { weekendTickets: 20 } },
    MULTILINGUAL: { id: 'multilingual', name: 'Çok Dilli', emoji: '🌍', description: 'Farklı dillerde destek ver', requirement: { languages: 2 } },
};

/**
 * XP ekle ve level kontrolü yap
 */
export async function addXP(guildId, userId, amount, reason = null) {
    try {
        const staff = await staffDB.getOrCreate(guildId, userId, 'Unknown');
        const oldLevel = staff.level;
        const newXP = staff.xp + amount;
        
        // Yeni level hesapla
        const newLevel = calculateLevel(newXP);
        
        // Güncelle
        await staffDB.updateXP(guildId, userId, newXP, newLevel);
        
        // Level atladı mı?
        const leveledUp = newLevel > oldLevel;
        
        if (leveledUp) {
            logger.info(`${userId} leveled up to ${newLevel}!`);
        }
        
        return {
            oldXP: staff.xp,
            newXP,
            oldLevel,
            newLevel,
            leveledUp,
            levelTitle: getLevelTitle(newLevel),
            xpGained: amount,
            reason,
        };
        
    } catch (error) {
        logger.error('Add XP error:', error);
        return null;
    }
}

/**
 * Level hesapla
 */
function calculateLevel(xp) {
    for (let i = LEVELS.length - 1; i >= 0; i--) {
        if (xp >= LEVELS[i].xp) {
            return LEVELS[i].level;
        }
    }
    return 1;
}

/**
 * Level title'ı al
 */
export function getLevelTitle(level) {
    const levelData = LEVELS.find(l => l.level === level);
    return levelData?.title || 'Bilinmiyor';
}

/**
 * Sonraki level için gereken XP
 */
export function getXPToNextLevel(currentXP) {
    const currentLevel = calculateLevel(currentXP);
    const nextLevel = LEVELS.find(l => l.level === currentLevel + 1);
    
    if (!nextLevel) return { needed: 0, progress: 100 };
    
    const currentLevelXP = LEVELS.find(l => l.level === currentLevel)?.xp || 0;
    const needed = nextLevel.xp - currentXP;
    const progress = ((currentXP - currentLevelXP) / (nextLevel.xp - currentLevelXP)) * 100;
    
    return { needed, progress: Math.min(100, Math.max(0, progress)) };
}

/**
 * Badge kontrolü ve ekleme
 */
export async function checkAndAwardBadges(guildId, userId, stats) {
    try {
        const staff = await staffDB.get(guildId, userId);
        if (!staff) return [];
        
        const currentBadges = staff.badges ? staff.badges.split(',') : [];
        const newBadges = [];
        
        for (const [key, badge] of Object.entries(BADGES)) {
            // Zaten var mı?
            if (currentBadges.includes(badge.id)) continue;
            
            // Gereksinimi karşılıyor mu?
            let earned = false;
            const req = badge.requirement;
            
            if (req.ticketsClosed && stats.ticketsClosed >= req.ticketsClosed) earned = true;
            if (req.fiveStars && stats.fiveStarCount >= req.fiveStars) earned = true;
            if (req.avgRating && req.minRatings && stats.averageRating >= req.avgRating && stats.totalRatings >= req.minRatings) earned = true;
            if (req.avgResponse && stats.avgFirstResponse <= req.avgResponse) earned = true;
            if (req.quickResponses && stats.quickResponses >= req.quickResponses) earned = true;
            if (req.streak && stats.longestStreak >= req.streak) earned = true;
            if (req.nightTickets && stats.nightTickets >= req.nightTickets) earned = true;
            if (req.weekendTickets && stats.weekendTickets >= req.weekendTickets) earned = true;
            
            if (earned) {
                currentBadges.push(badge.id);
                newBadges.push(badge);
            }
        }
        
        // Yeni badge varsa kaydet
        if (newBadges.length > 0) {
            await staffDB.updateBadges(guildId, userId, currentBadges.join(','));
            logger.info(`${userId} earned ${newBadges.length} new badges!`);
        }
        
        return newBadges;
        
    } catch (error) {
        logger.error('Check badges error:', error);
        return [];
    }
}

/**
 * Streak güncelle
 */
export async function updateStreak(guildId, userId) {
    try {
        const staff = await staffDB.get(guildId, userId);
        if (!staff) return null;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const lastActive = staff.lastActiveDate ? new Date(staff.lastActiveDate) : null;
        
        let newStreak = staff.currentStreak;
        
        if (lastActive) {
            lastActive.setHours(0, 0, 0, 0);
            const diffDays = Math.floor((today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));
            
            if (diffDays === 0) {
                // Bugün zaten aktifti
                return { streak: newStreak, bonus: 0 };
            } else if (diffDays === 1) {
                // Dün aktifti, streak devam
                newStreak++;
            } else {
                // Streak kırıldı
                newStreak = 1;
            }
        } else {
            newStreak = 1;
        }
        
        // Longest streak güncelle
        const longestStreak = Math.max(newStreak, staff.longestStreak);
        
        await staffDB.updateStreak(guildId, userId, newStreak, longestStreak, today);
        
        // Streak bonus XP
        const bonus = newStreak > 1 ? XP_REWARDS.STREAK_BONUS * Math.min(newStreak, 7) : 0;
        if (bonus > 0) {
            await addXP(guildId, userId, bonus, 'Streak bonus');
        }
        
        return { streak: newStreak, bonus };
        
    } catch (error) {
        logger.error('Update streak error:', error);
        return null;
    }
}

/**
 * Leaderboard oluştur
 */
export async function getLeaderboard(guildId, type = 'xp', limit = 10) {
    try {
        let staff;
        
        switch (type) {
            case 'xp':
                staff = await staffDB.getTopByXP(guildId, limit);
                break;
            case 'tickets':
                staff = await staffDB.getTopByTickets(guildId, limit);
                break;
            case 'rating':
                staff = await staffDB.getTopByRating(guildId, limit);
                break;
            case 'streak':
                staff = await staffDB.getTopByStreak(guildId, limit);
                break;
            default:
                staff = await staffDB.getTopByXP(guildId, limit);
        }
        
        return staff.map((s, i) => ({
            rank: i + 1,
            ...s,
            levelTitle: getLevelTitle(s.level),
            badges: s.badges ? s.badges.split(',').map(id => BADGES[Object.keys(BADGES).find(k => BADGES[k].id === id)]).filter(Boolean) : [],
        }));
        
    } catch (error) {
        logger.error('Get leaderboard error:', error);
        return [];
    }
}

/**
 * Staff profil embed'i oluştur
 */
export function createProfileEmbed(staff, user) {
    const { needed, progress } = getXPToNextLevel(staff.xp);
    const progressBar = createProgressBar(progress);
    
    const badges = staff.badges 
        ? staff.badges.split(',').map(id => {
            const badge = BADGES[Object.keys(BADGES).find(k => BADGES[k].id === id)];
            return badge ? `${badge.emoji}` : '';
        }).join(' ')
        : 'Henüz rozet yok';
    
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`📊 ${user.username} - Profil`)
        .setThumbnail(user.displayAvatarURL())
        .addFields(
            { name: '📈 Seviye', value: `**${staff.level}** - ${getLevelTitle(staff.level)}`, inline: true },
            { name: '✨ XP', value: `**${staff.xp}** XP`, inline: true },
            { name: '🔥 Seri', value: `**${staff.currentStreak}** gün`, inline: true },
            { name: '📊 İlerleme', value: `${progressBar}\n${progress.toFixed(1)}% (${needed} XP kaldı)`, inline: false },
            { name: '🎫 Ticketlar', value: `Sahiplenilen: **${staff.ticketsClaimed}**\nKapatılan: **${staff.ticketsClosed}**`, inline: true },
            { name: '⭐ Rating', value: `**${staff.averageRating.toFixed(1)}/5** (${staff.totalRatings} oy)`, inline: true },
            { name: '⚡ Yanıt Süresi', value: `Ort: **${staff.avgFirstResponse.toFixed(1)}** dk`, inline: true },
            { name: '🏆 Rozetler', value: badges, inline: false },
        )
        .setFooter({ text: `En uzun seri: ${staff.longestStreak} gün` })
        .setTimestamp();
    
    return embed;
}

/**
 * Progress bar oluştur
 */
function createProgressBar(percent, length = 10) {
    const filled = Math.round((percent / 100) * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}

export { XP_REWARDS, BADGES, LEVELS };

export default {
    addXP,
    getLevelTitle,
    getXPToNextLevel,
    checkAndAwardBadges,
    updateStreak,
    getLeaderboard,
    createProfileEmbed,
    XP_REWARDS,
    BADGES,
    LEVELS,
};
