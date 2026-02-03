// ==================== LANGUAGE SYSTEM ====================
import { guildDB } from './database.js';
import logger from './logger.js';

// Dil dosyaları
const languages = {
    tr: {
        // Common
        error: '❌ Bir hata oluştu!',
        noPermission: '❌ Bu komutu kullanma yetkiniz yok!',
        staffOnly: '❌ Bu komutu kullanmak için yetkili olmalısınız!',
        adminOnly: '❌ Bu komutu kullanmak için yönetici olmalısınız!',
        ticketChannelOnly: '❌ Bu komut sadece ticket kanallarında kullanılabilir!',
        
        // Ticket
        ticketCreated: '✅ Ticketınız oluşturuldu: {channel}',
        ticketExists: '❌ Zaten açık bir ticketınız var: {channel}',
        ticketLimit: '❌ Maksimum ticket limitine ulaştınız ({limit})!',
        blacklisted: '❌ Ticket sistemi kullanma yetkiniz engellenmiş.',
        welcomeTitle: '🎫 Ticket #{number}',
        welcomeDesc: 'Merhaba {user},\n\nTicketınız oluşturuldu. Yetkili ekip en kısa sürede size yardımcı olacaktır.\n\n**Lütfen beklerken:**\n• Sorununuzu detaylı bir şekilde açıklayın\n• Gerekirse ekran görüntüleri ekleyin\n• Sabırlı olun',
        
        // Claim
        claimSuccess: '✅ Ticket Sahiplenildi',
        claimSuccessDesc: '{user} bu ticketı sahiplendi ve size yardımcı olacaktır.',
        alreadyClaimed: '❌ Bu ticket zaten {user} tarafından sahiplenilmiş!',
        notClaimed: '❌ Bu ticket henüz sahiplenilmemiş!',
        unclaimSuccess: '🔓 Ticket Serbest Bırakıldı',
        unclaimSuccessDesc: '{user} bu ticketın sahipliğinden vazgeçti.',
        
        // Close
        closeConfirmTitle: '⚠️ Ticketı Kapat',
        closeConfirmDesc: 'Bu ticketı kapatmak istediğinize emin misiniz?\n\n**Bu işlem:**\n• Ticket arşivlenecek\n• Transcript oluşturulacak\n• 5 saniye sonra kanal silinecek',
        closeSuccess: '🔒 Ticket Kapatıldı',
        closeSuccessDesc: 'Bu ticket {user} tarafından kapatıldı.\n5 saniye içinde bu kanal silinecek...',
        closeCancelled: '❌ Ticket kapatma işlemi iptal edildi.',
        
        // User management
        userAdded: '✅ {user} ticketa eklendi.',
        userRemoved: '✅ {user} tickettan çıkarıldı.',
        cannotRemoveOwner: '❌ Ticket sahibini çıkaramazsınız!',
        
        // Rating
        ratingTitle: '⭐ Değerlendirme',
        ratingDesc: 'Destek deneyiminizi değerlendirin!',
        ratingThanks: '✅ Değerlendirmeniz için teşekkürler!',
        ratingSkipped: 'Değerlendirme atlandı.',
        
        // Panel
        panelTitle: '🎫 Destek Ticket Sistemi',
        panelDesc: '**Nasıl ticket açarım?**\nAşağıdaki butona tıklayarak yeni bir destek talebi oluşturabilirsiniz.\n\n**Ne zaman ticket açmalıyım?**\n• Sorununuz olduğunda\n• Yardıma ihtiyacınız olduğunda\n• Şikayet veya öneriniz olduğunda\n\n**Kurallar:**\n• Gereksiz ticket açmayın\n• Yetkililere saygılı olun\n• Konunuzu açık ve net anlatın',
        panelButton: 'Ticket Oluştur',
        panelButtonCategory: 'Kategori Seç',
        
        // Modal
        modalTitle: '🎫 Ticket Oluştur',
        modalSubject: 'Konu',
        modalSubjectPlaceholder: 'Kısa bir başlık girin',
        modalDesc: 'Açıklama',
        modalDescPlaceholder: 'Sorununuzu detaylı açıklayın...',
        
        // Stats
        statsTitle: '📊 Ticket İstatistikleri',
        
        // Priority
        priorityLow: '🟢 Düşük',
        priorityMedium: '🟡 Orta',
        priorityHigh: '🟠 Yüksek',
        priorityUrgent: '🔴 Acil',
        priorityChanged: 'Öncelik değiştirildi: {old} → {new}',
        
        // Status
        statusOpen: '🟢 Açık',
        statusClaimed: '🟡 Sahiplenildi',
        statusClosed: '🔴 Kapalı',
        statusArchived: '📦 Arşivlenmiş',
        
        // DM Notifications
        dmCreated: '🎫 **Ticket Oluşturuldu**\n\nTicket #{number} oluşturuldu.\nSunucu: {guild}\n\nYetkili ekip en kısa sürede size yardımcı olacaktır.',
        dmClaimed: '✅ **Ticket Sahiplenildi**\n\nTicket #{number} {staff} tarafından sahiplenildi.\nSunucu: {guild}\n\nSize yardımcı olacak.',
        dmClosed: '🔒 **Ticket Kapatıldı**\n\nTicket #{number} kapatıldı.\nSunucu: {guild}\n{reason}',
        
        // Auto-close
        inactivityWarning: '⚠️ **İnaktivite Uyarısı**\n\nBu ticket {hours} saattir inaktif.\n24 saat içinde yanıt yoksa otomatik kapatılacaktır.\n\nTicketı açık tutmak için herhangi bir mesaj gönderin.',
        autoCloseMsg: '🔒 Bu ticket inaktivite nedeniyle otomatik olarak kapatıldı.',
        
        // Schedule
        scheduledClose: '⏰ Bu ticket {time} otomatik olarak kapatılacak.',
        scheduleCancelled: '✅ Zamanlanmış kapatma iptal edildi.',
        
        // Transfer
        transferSuccess: '🔄 Ticket {from} tarafından {to} kişisine devredildi.',
        
        // Archive
        archiveSuccess: '📦 Ticket arşivlendi.',
        archiveDesc: 'Bu ticket arşivlendi ve salt okunur modda.',
        
        // Category
        selectCategory: '📋 Lütfen ticket kategorisi seçin:',
        categoryCreated: '✅ Kategori oluşturuldu: {name}',
        categoryDeleted: '🗑️ Kategori silindi: {name}',
        categoryUpdated: '✏️ Kategori güncellendi: {name}',
        
        // Blacklist
        userBlacklisted: '🚫 {user} ticket sisteminden engellendi.',
        userUnblacklisted: '✅ {user} engeli kaldırıldı.',
        
        // Canned
        cannedCreated: '✅ Hazır yanıt oluşturuldu: {name}',
        cannedDeleted: '🗑️ Hazır yanıt silindi: {name}',
        cannedNotFound: '❌ Hazır yanıt bulunamadı: {name}',
        
        // Help
        helpTitle: '📚 FluX Ticket Bot - Yardım',
    },
    en: {
        // Common
        error: '❌ An error occurred!',
        noPermission: '❌ You don\'t have permission to use this command!',
        staffOnly: '❌ This command is for staff only!',
        adminOnly: '❌ This command is for administrators only!',
        ticketChannelOnly: '❌ This command can only be used in ticket channels!',
        
        // Ticket
        ticketCreated: '✅ Your ticket has been created: {channel}',
        ticketExists: '❌ You already have an open ticket: {channel}',
        ticketLimit: '❌ You have reached the maximum ticket limit ({limit})!',
        blacklisted: '❌ You are blacklisted from using the ticket system.',
        welcomeTitle: '🎫 Ticket #{number}',
        welcomeDesc: 'Hello {user},\n\nYour ticket has been created. Our team will assist you shortly.\n\n**While waiting:**\n• Describe your issue in detail\n• Add screenshots if needed\n• Please be patient',
        
        // Claim
        claimSuccess: '✅ Ticket Claimed',
        claimSuccessDesc: '{user} has claimed this ticket and will assist you.',
        alreadyClaimed: '❌ This ticket is already claimed by {user}!',
        notClaimed: '❌ This ticket is not claimed yet!',
        unclaimSuccess: '🔓 Ticket Released',
        unclaimSuccessDesc: '{user} has released this ticket.',
        
        // Close
        closeConfirmTitle: '⚠️ Close Ticket',
        closeConfirmDesc: 'Are you sure you want to close this ticket?\n\n**This action will:**\n• Archive the ticket\n• Create a transcript\n• Delete the channel in 5 seconds',
        closeSuccess: '🔒 Ticket Closed',
        closeSuccessDesc: 'This ticket was closed by {user}.\nThis channel will be deleted in 5 seconds...',
        closeCancelled: '❌ Ticket close cancelled.',
        
        // User management
        userAdded: '✅ {user} has been added to the ticket.',
        userRemoved: '✅ {user} has been removed from the ticket.',
        cannotRemoveOwner: '❌ You cannot remove the ticket owner!',
        
        // Rating
        ratingTitle: '⭐ Rating',
        ratingDesc: 'Rate your support experience!',
        ratingThanks: '✅ Thank you for your feedback!',
        ratingSkipped: 'Rating skipped.',
        
        // Panel
        panelTitle: '🎫 Support Ticket System',
        panelDesc: '**How to create a ticket?**\nClick the button below to create a new support request.\n\n**When should I create a ticket?**\n• When you have an issue\n• When you need help\n• When you have a complaint or suggestion\n\n**Rules:**\n• Don\'t create unnecessary tickets\n• Be respectful to staff\n• Explain your issue clearly',
        panelButton: 'Create Ticket',
        panelButtonCategory: 'Select Category',
        
        // Modal
        modalTitle: '🎫 Create Ticket',
        modalSubject: 'Subject',
        modalSubjectPlaceholder: 'Enter a brief title',
        modalDesc: 'Description',
        modalDescPlaceholder: 'Describe your issue in detail...',
        
        // Stats
        statsTitle: '📊 Ticket Statistics',
        
        // Priority
        priorityLow: '🟢 Low',
        priorityMedium: '🟡 Medium',
        priorityHigh: '🟠 High',
        priorityUrgent: '🔴 Urgent',
        priorityChanged: 'Priority changed: {old} → {new}',
        
        // Status
        statusOpen: '🟢 Open',
        statusClaimed: '🟡 Claimed',
        statusClosed: '🔴 Closed',
        statusArchived: '📦 Archived',
        
        // DM Notifications
        dmCreated: '🎫 **Ticket Created**\n\nTicket #{number} has been created.\nServer: {guild}\n\nOur team will assist you shortly.',
        dmClaimed: '✅ **Ticket Claimed**\n\nTicket #{number} has been claimed by {staff}.\nServer: {guild}\n\nThey will assist you.',
        dmClosed: '🔒 **Ticket Closed**\n\nTicket #{number} has been closed.\nServer: {guild}\n{reason}',
        
        // Auto-close
        inactivityWarning: '⚠️ **Inactivity Warning**\n\nThis ticket has been inactive for {hours} hours.\nIt will be automatically closed in 24 hours without response.\n\nSend any message to keep it open.',
        autoCloseMsg: '🔒 This ticket was automatically closed due to inactivity.',
        
        // Schedule
        scheduledClose: '⏰ This ticket will be automatically closed {time}.',
        scheduleCancelled: '✅ Scheduled close cancelled.',
        
        // Transfer
        transferSuccess: '🔄 Ticket transferred from {from} to {to}.',
        
        // Archive
        archiveSuccess: '📦 Ticket archived.',
        archiveDesc: 'This ticket has been archived and is read-only.',
        
        // Category
        selectCategory: '📋 Please select a ticket category:',
        categoryCreated: '✅ Category created: {name}',
        categoryDeleted: '🗑️ Category deleted: {name}',
        categoryUpdated: '✏️ Category updated: {name}',
        
        // Blacklist
        userBlacklisted: '🚫 {user} has been blacklisted from the ticket system.',
        userUnblacklisted: '✅ {user} has been unblacklisted.',
        
        // Canned
        cannedCreated: '✅ Canned response created: {name}',
        cannedDeleted: '🗑️ Canned response deleted: {name}',
        cannedNotFound: '❌ Canned response not found: {name}',
        
        // Help
        helpTitle: '📚 FluX Ticket Bot - Help',
    },
};

// Guild dil cache'i
const guildLocales = new Map();

// Desteklenen diller
export const availableLocales = ['tr', 'en'];

/**
 * Çeviri al
 */
export function t(guildId, key, replacements = {}) {
    const locale = guildLocales.get(guildId) || 'tr';
    let text = languages[locale]?.[key] || languages.tr?.[key] || key;
    
    for (const [k, v] of Object.entries(replacements)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
    
    return text;
}

/**
 * Guild dilini ayarla (memory)
 */
export function setLang(guildId, locale) {
    if (availableLocales.includes(locale)) {
        guildLocales.set(guildId, locale);
        return true;
    }
    return false;
}

/**
 * Guild dilini al (memory)
 */
export function getLang(guildId) {
    return guildLocales.get(guildId) || 'tr';
}

/**
 * Guild dilini yükle (memory)
 */
export function loadLang(guildId, locale) {
    if (locale && availableLocales.includes(locale)) {
        guildLocales.set(guildId, locale);
    }
}

/**
 * Guild dilini al (database)
 */
export async function getGuildLocale(guildId) {
    try {
        const cached = guildLocales.get(guildId);
        if (cached) return cached;

        const guild = await guildDB.get(guildId);
        const locale = guild?.locale || 'tr';
        guildLocales.set(guildId, locale);
        return locale;
    } catch (error) {
        return 'tr';
    }
}

/**
 * Guild dilini ayarla (database)
 */
export async function setGuildLocale(guildId, locale) {
    if (!availableLocales.includes(locale)) {
        return false;
    }

    try {
        await guildDB.update(guildId, { locale });
        guildLocales.set(guildId, locale);
        return true;
    } catch (error) {
        logger.error('setGuildLocale hatası:', error);
        return false;
    }
}

/**
 * Mevcut dilleri al
 */
export function getAvailableLocales() {
    return availableLocales.map(code => ({
        code,
        name: code === 'tr' ? 'Türkçe' : 'English',
        flag: code === 'tr' ? '🇹🇷' : '🇬🇧',
    }));
}

export default { t, setLang, getLang, loadLang, getGuildLocale, setGuildLocale, getAvailableLocales, availableLocales };
