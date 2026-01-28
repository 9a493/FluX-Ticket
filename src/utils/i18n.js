// ==================== LANGUAGE SYSTEM ====================
import { guildDB } from './database.js';
import logger from './logger.js';

const languages = {
    tr: {
        error: '❌ Bir hata oluştu!',
        noPermission: '❌ Bu komutu kullanma yetkiniz yok!',
        staffOnly: '❌ Bu komutu kullanmak için yetkili olmalısınız!',
        ticketChannelOnly: '❌ Bu komut sadece ticket kanallarında kullanılabilir!',
        ticketCreated: '✅ Ticketınız oluşturuldu: {channel}',
        ticketExists: '❌ Zaten açık bir ticketınız var: {channel}',
        blacklisted: '❌ Ticket sistemi kullanma yetkiniz engellenmiş.',
        welcomeTitle: '🎫 Ticket #{number}',
        welcomeDesc: 'Merhaba {user},\n\nTicketınız oluşturuldu. Yetkili ekip en kısa sürede size yardımcı olacaktır.',
        claimSuccess: '✅ Ticket Sahiplenildi',
        claimSuccessDesc: '{user} bu ticketı sahiplendi.',
        alreadyClaimed: '❌ Bu ticket zaten {user} tarafından sahiplenilmiş!',
        unclaimSuccess: '🔓 Ticket Serbest Bırakıldı',
        closeConfirmTitle: '⚠️ Ticketı Kapat',
        closeConfirmDesc: 'Bu ticketı kapatmak istediğinize emin misiniz?',
        closeSuccess: '🔒 Ticket Kapatıldı',
        userAdded: '✅ {user} eklendi.',
        userRemoved: '✅ {user} çıkarıldı.',
        ratingTitle: '⭐ Değerlendirme',
        ratingDesc: 'Destek deneyiminizi değerlendirin!',
        panelTitle: '🎫 Destek Ticket Sistemi',
        panelDesc: 'Aşağıdaki butona tıklayarak ticket oluşturun.',
        panelButton: 'Ticket Oluştur',
        statsTitle: '📊 İstatistikler',
        helpTitle: '📚 Yardım',
        modalTitle: '🎫 Ticket Oluştur',
        modalSubject: 'Konu',
        modalDesc: 'Açıklama',
        dmCreated: '🎫 Ticket #{number} oluşturuldu ({guild})',
        dmClaimed: '✅ Ticket #{number} {staff} tarafından sahiplenildi ({guild})',
        dmClosed: '🔒 Ticket #{number} kapatıldı ({guild})',
        inactivityWarning: '⚠️ Bu ticket {hours} saattir inaktif. 24 saat içinde yanıt yoksa kapanacak.',
        autoCloseMsg: '🔒 Ticket inaktivite nedeniyle otomatik kapatıldı.',
        scheduledClose: '⏰ Bu ticket {time} sonra otomatik kapatılacak.',
        priorityLow: '🟢 Düşük',
        priorityMedium: '🟡 Orta',
        priorityHigh: '🟠 Yüksek',
        priorityUrgent: '🔴 Acil',
    },
    en: {
        error: '❌ An error occurred!',
        noPermission: '❌ You don\'t have permission!',
        staffOnly: '❌ Staff only command!',
        ticketChannelOnly: '❌ This command can only be used in ticket channels!',
        ticketCreated: '✅ Your ticket has been created: {channel}',
        ticketExists: '❌ You already have an open ticket: {channel}',
        blacklisted: '❌ You are blacklisted from the ticket system.',
        welcomeTitle: '🎫 Ticket #{number}',
        welcomeDesc: 'Hello {user},\n\nYour ticket has been created. Our team will assist you shortly.',
        claimSuccess: '✅ Ticket Claimed',
        claimSuccessDesc: '{user} has claimed this ticket.',
        alreadyClaimed: '❌ This ticket is already claimed by {user}!',
        unclaimSuccess: '🔓 Ticket Released',
        closeConfirmTitle: '⚠️ Close Ticket',
        closeConfirmDesc: 'Are you sure you want to close this ticket?',
        closeSuccess: '🔒 Ticket Closed',
        userAdded: '✅ {user} added.',
        userRemoved: '✅ {user} removed.',
        ratingTitle: '⭐ Rating',
        ratingDesc: 'Rate your support experience!',
        panelTitle: '🎫 Support Ticket System',
        panelDesc: 'Click the button below to create a ticket.',
        panelButton: 'Create Ticket',
        statsTitle: '📊 Statistics',
        helpTitle: '📚 Help',
        modalTitle: '🎫 Create Ticket',
        modalSubject: 'Subject',
        modalDesc: 'Description',
        dmCreated: '🎫 Ticket #{number} created ({guild})',
        dmClaimed: '✅ Ticket #{number} claimed by {staff} ({guild})',
        dmClosed: '🔒 Ticket #{number} closed ({guild})',
        inactivityWarning: '⚠️ This ticket has been inactive for {hours} hours. It will close in 24 hours without response.',
        autoCloseMsg: '🔒 Ticket auto-closed due to inactivity.',
        scheduledClose: '⏰ This ticket will close in {time}.',
        priorityLow: '🟢 Low',
        priorityMedium: '🟡 Medium',
        priorityHigh: '🟠 High',
        priorityUrgent: '🔴 Urgent',
    },
};

const guildLangs = new Map();

export function t(guildId, key, replacements = {}) {
    const lang = guildLangs.get(guildId) || 'tr';
    let text = languages[lang]?.[key] || languages.tr?.[key] || key;
    for (const [k, v] of Object.entries(replacements)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
    return text;
}

export function setLang(guildId, lang) {
    if (languages[lang]) {
        guildLangs.set(guildId, lang);
        return true;
    }
    return false;
}

export function getLang(guildId) {
    return guildLangs.get(guildId) || 'tr';
}

export function loadLang(guildId, lang) {
    if (lang && languages[lang]) guildLangs.set(guildId, lang);
}

export default { t, setLang, getLang, loadLang };
