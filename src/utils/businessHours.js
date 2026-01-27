import { guildDB } from './database.js';
import logger from './logger.js';

/**
 * Şu an çalışma saatleri içinde mi kontrol et
 */
export function isBusinessHours(guildConfig) {
    if (!guildConfig.businessHoursEnabled) {
        return { isOpen: true, message: null };
    }

    const now = new Date();
    
    // Timezone ayarla
    const timezone = guildConfig.timezone || 'Europe/Istanbul';
    const options = { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false };
    const localTime = now.toLocaleTimeString('tr-TR', options);
    const [currentHour, currentMinute] = localTime.split(':').map(Number);
    const currentMinutes = currentHour * 60 + currentMinute;

    // Gün kontrolü (0 = Pazar, 1 = Pazartesi, ...)
    const dayOptions = { timeZone: timezone, weekday: 'short' };
    const localDay = now.toLocaleDateString('en-US', dayOptions);
    const dayMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
    const currentDay = dayMap[localDay];

    // Çalışma günleri
    const businessDays = guildConfig.businessDays 
        ? guildConfig.businessDays.split(',').map(Number)
        : [1, 2, 3, 4, 5]; // Varsayılan: Pazartesi-Cuma

    if (!businessDays.includes(currentDay)) {
        return {
            isOpen: false,
            message: guildConfig.outsideHoursMessage || getDefaultClosedMessage(guildConfig),
            reason: 'day',
            nextOpen: getNextBusinessDay(businessDays, currentDay, guildConfig),
        };
    }

    // Saat kontrolü
    const [startHour, startMinute] = (guildConfig.businessHoursStart || '09:00').split(':').map(Number);
    const [endHour, endMinute] = (guildConfig.businessHoursEnd || '18:00').split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    if (currentMinutes < startMinutes || currentMinutes >= endMinutes) {
        return {
            isOpen: false,
            message: guildConfig.outsideHoursMessage || getDefaultClosedMessage(guildConfig),
            reason: 'time',
            nextOpen: currentMinutes < startMinutes 
                ? `Bugün ${guildConfig.businessHoursStart || '09:00'}`
                : getNextBusinessDay(businessDays, currentDay, guildConfig),
        };
    }

    return { isOpen: true, message: null };
}

/**
 * Varsayılan kapalı mesajı
 */
function getDefaultClosedMessage(guildConfig) {
    const start = guildConfig.businessHoursStart || '09:00';
    const end = guildConfig.businessHoursEnd || '18:00';
    const days = guildConfig.businessDays || '1,2,3,4,5';
    
    const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const workDays = days.split(',').map(d => dayNames[parseInt(d)]).join(', ');

    return `🕐 **Çalışma Saatleri Dışındayız**\n\n` +
           `Çalışma saatlerimiz:\n` +
           `📅 **Günler:** ${workDays}\n` +
           `⏰ **Saatler:** ${start} - ${end}\n\n` +
           `Ticketınız kaydedildi ve en kısa sürede yanıtlanacaktır.`;
}

/**
 * Sonraki çalışma gününü hesapla
 */
function getNextBusinessDay(businessDays, currentDay, guildConfig) {
    const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    
    for (let i = 1; i <= 7; i++) {
        const nextDay = (currentDay + i) % 7;
        if (businessDays.includes(nextDay)) {
            return `${dayNames[nextDay]} ${guildConfig.businessHoursStart || '09:00'}`;
        }
    }
    
    return 'Bilinmiyor';
}

/**
 * Çalışma saati içinde olup olmadığını belirle (basit)
 */
export function isWithinBusinessHours(guildConfig) {
    const result = isBusinessHours(guildConfig);
    return result.isOpen;
}

/**
 * Çalışma saati mesajı oluştur
 */
export function getBusinessHoursMessage(guildConfig) {
    const result = isBusinessHours(guildConfig);
    return result.message;
}

/**
 * Kalan süreyi hesapla
 */
export function getTimeUntilOpen(guildConfig) {
    if (!guildConfig.businessHoursEnabled) return null;

    const result = isBusinessHours(guildConfig);
    if (result.isOpen) return null;

    return {
        nextOpen: result.nextOpen,
        message: `Sonraki açılış: ${result.nextOpen}`,
    };
}

/**
 * Gün adını al
 */
export function getDayName(dayNumber) {
    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    return days[dayNumber] || 'Bilinmiyor';
}

/**
 * Çalışma saatleri özeti
 */
export function getBusinessHoursSummary(guildConfig) {
    if (!guildConfig.businessHoursEnabled) {
        return '24/7 Açık';
    }

    const days = guildConfig.businessDays || '1,2,3,4,5';
    const dayNumbers = days.split(',').map(Number);
    
    // Ardışık günleri grupla
    const groups = [];
    let start = dayNumbers[0];
    let end = dayNumbers[0];

    for (let i = 1; i < dayNumbers.length; i++) {
        if (dayNumbers[i] === end + 1) {
            end = dayNumbers[i];
        } else {
            groups.push({ start, end });
            start = dayNumbers[i];
            end = dayNumbers[i];
        }
    }
    groups.push({ start, end });

    const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
    const dayStr = groups.map(g => 
        g.start === g.end 
            ? dayNames[g.start]
            : `${dayNames[g.start]}-${dayNames[g.end]}`
    ).join(', ');

    const start = guildConfig.businessHoursStart || '09:00';
    const end = guildConfig.businessHoursEnd || '18:00';

    return `${dayStr} ${start}-${end}`;
}

export default {
    isBusinessHours,
    isWithinBusinessHours,
    getBusinessHoursMessage,
    getTimeUntilOpen,
    getDayName,
    getBusinessHoursSummary,
};
