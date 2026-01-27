export default {
    general: {
        error: 'Bir hata oluştu!',
        success: 'İşlem başarılı!',
        noPermission: 'Bu işlem için yetkiniz yok!',
        notFound: 'Bulunamadı!',
    },
    ticket: {
        created: 'Ticket oluşturuldu!',
        closed: 'Ticket kapatıldı.',
        reopened: 'Ticket yeniden açıldı.',
        claimed: 'Ticket sahiplenildi.',
        unclaimed: 'Ticket sahiplenilmesi bırakıldı.',
        transferred: 'Ticket transfer edildi.',
        blacklisted: 'Kara listede olduğunuz için ticket açamazsınız!',
        maxReached: 'Maksimum açık ticket sayısına ({max}) ulaştınız!',
        notTicketChannel: 'Bu komut sadece ticket kanallarında kullanılabilir!',
        alreadyClaimed: 'Bu ticket zaten sahiplenilmiş!',
        notClaimed: 'Bu ticket henüz sahiplenilmemiş!',
        welcomeMessage: 'Merhaba! Ticket talebiniz alındı. Lütfen sorununuzu detaylı bir şekilde açıklayın, en kısa sürede size yardımcı olacağız.',
        closeMessage: 'Ticket kapatıldı. Yardımcı olabildiysek ne mutlu!',
    },
    commands: {
        setup: {
            success: 'Bot başarıyla ayarlandı!',
            categoryCreated: 'Ticket kategorisi oluşturuldu.',
            panelSent: 'Ticket paneli gönderildi.',
        },
        blacklist: {
            added: '{user} kara listeye eklendi.',
            removed: '{user} kara listeden çıkarıldı.',
            alreadyBlacklisted: 'Bu kullanıcı zaten kara listede!',
            notBlacklisted: 'Bu kullanıcı kara listede değil!',
        },
        canned: {
            created: 'Hazır yanıt oluşturuldu: {name}',
            deleted: 'Hazır yanıt silindi: {name}',
            notFound: 'Hazır yanıt bulunamadı!',
            used: 'Hazır yanıt kullanıldı.',
        },
    },
    panel: {
        title: '🎫 Destek Talebi',
        description: 'Aşağıdaki butona tıklayarak destek talebi oluşturabilirsiniz.',
        buttonLabel: 'Ticket Aç',
    },
};
