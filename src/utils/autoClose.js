import { EmbedBuilder } from 'discord.js';
import { ticketDB, guildDB } from './database.js';
import logger from './logger.js';
import { generateTranscript } from './transcript.js';

// Auto-close job interval (ms) - her 30 dakikada bir kontrol
const AUTO_CLOSE_INTERVAL = 30 * 60 * 1000;

// Varsayılan inaktivite süresi (saat)
const DEFAULT_INACTIVE_HOURS = 48;

/**
 * Auto-close sistemini başlatır
 */
export function startAutoClose(client) {
    logger.info('🕐 Auto-close sistemi başlatıldı');

    // İlk kontrolü 5 dakika sonra yap
    setTimeout(() => {
        checkInactiveTickets(client);
    }, 5 * 60 * 1000);

    // Sonra her 30 dakikada bir kontrol et
    setInterval(() => {
        checkInactiveTickets(client);
    }, AUTO_CLOSE_INTERVAL);
}

/**
 * İnaktif ticketları kontrol eder ve kapatır
 */
async function checkInactiveTickets(client) {
    try {
        const inactiveTickets = await ticketDB.getInactiveTickets(DEFAULT_INACTIVE_HOURS);

        if (inactiveTickets.length === 0) {
            return;
        }

        logger.info(`🔍 ${inactiveTickets.length} inaktif ticket bulundu`);

        for (const ticket of inactiveTickets) {
            try {
                await closeInactiveTicket(client, ticket);
            } catch (error) {
                logger.error(`Auto-close hatası (Ticket #${ticket.ticketNumber}):`, error);
            }

            // Rate limit için bekle
            await sleep(2000);
        }

    } catch (error) {
        logger.error('Auto-close kontrol hatası:', error);
    }
}

/**
 * İnaktif ticket'ı kapatır
 */
async function closeInactiveTicket(client, ticket) {
    try {
        // Guild'i bul
        const guild = await client.guilds.fetch(ticket.guildId).catch(() => null);
        if (!guild) {
            logger.warn(`Guild bulunamadı: ${ticket.guildId}`);
            return;
        }

        // Kanalı bul
        const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);
        if (!channel) {
            // Kanal silinmiş, database'den kaldır
            await ticketDB.close(ticket.channelId, 'SYSTEM', 'Kanal bulunamadı (auto-cleanup)');
            logger.info(`Ticket #${ticket.ticketNumber} - Kanal bulunamadı, database temizlendi`);
            return;
        }

        // Uyarı mesajı gönder (eğer daha önce gönderilmediyse)
        const lastMessage = (await channel.messages.fetch({ limit: 1 })).first();
        const isWarningMessage = lastMessage?.embeds[0]?.title?.includes('İnaktivite Uyarısı');

        if (!isWarningMessage) {
            // İlk uyarı - 24 saat kaldı
            const warningEmbed = new EmbedBuilder()
                .setColor('#FEE75C')
                .setTitle('⚠️ İnaktivite Uyarısı')
                .setDescription(
                    `Bu ticket **${DEFAULT_INACTIVE_HOURS} saat** boyunca inaktif kaldı.\n\n` +
                    `**24 saat** içinde aktivite olmazsa ticket otomatik olarak kapatılacaktır.\n\n` +
                    `Ticket'ı açık tutmak için herhangi bir mesaj gönderin.`
                )
                .setTimestamp();

            await channel.send({
                content: `<@${ticket.userId}>`,
                embeds: [warningEmbed],
            });

            logger.info(`Ticket #${ticket.ticketNumber} - İnaktivite uyarısı gönderildi`);
            return;
        }

        // Uyarıdan sonra 24 saat geçti mi?
        const warningTime = new Date(lastMessage.createdTimestamp);
        const hoursSinceWarning = (Date.now() - warningTime.getTime()) / (1000 * 60 * 60);

        if (hoursSinceWarning < 24) {
            return; // Henüz 24 saat olmadı
        }

        // Transcript oluştur
        let transcriptUrl = null;
        try {
            transcriptUrl = await generateTranscript(channel, ticket);
        } catch (error) {
            logger.error('Transcript hatası (auto-close):', error);
        }

        // Kapanış mesajı
        const closeEmbed = new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('🔒 Ticket Otomatik Kapatıldı')
            .setDescription(
                `Bu ticket **${DEFAULT_INACTIVE_HOURS + 24} saat** boyunca inaktif kaldığı için otomatik olarak kapatıldı.\n\n` +
                '5 saniye içinde bu kanal silinecek...'
            )
            .addFields(
                { name: '📝 Ticket', value: `#${ticket.ticketNumber.toString().padStart(4, '0')}`, inline: true },
                { name: '⏱️ Toplam Süre', value: formatDuration(Date.now() - new Date(ticket.createdAt).getTime()), inline: true },
            )
            .setTimestamp();

        if (transcriptUrl) {
            closeEmbed.addFields({ name: '📄 Transcript', value: `[Görüntüle](${transcriptUrl})`, inline: true });
        }

        await channel.send({ embeds: [closeEmbed] });

        // Database'de kapat
        await ticketDB.close(ticket.channelId, 'SYSTEM', 'Otomatik kapatma - İnaktivite', transcriptUrl);

        // Log kanalına bildir
        const guildConfig = await guildDB.getOrCreate(guild.id, guild.name);
        if (guildConfig.logChannelId) {
            try {
                const logChannel = await guild.channels.fetch(guildConfig.logChannelId);
                const logEmbed = new EmbedBuilder()
                    .setColor('#ED4245')
                    .setTitle('🤖 Ticket Otomatik Kapatıldı')
                    .addFields(
                        { name: 'Ticket', value: `#${ticket.ticketNumber.toString().padStart(4, '0')}`, inline: true },
                        { name: 'Açan', value: `<@${ticket.userId}>`, inline: true },
                        { name: 'Sebep', value: 'İnaktivite', inline: true },
                    )
                    .setTimestamp();
                
                await logChannel.send({ embeds: [logEmbed] });
            } catch (error) {
                // Log hatası sessiz
            }
        }

        // 5 saniye sonra kanalı sil
        setTimeout(async () => {
            try {
                await channel.delete();
                logger.info(`Ticket #${ticket.ticketNumber} auto-closed and deleted`);
            } catch (error) {
                logger.error('Kanal silme hatası (auto-close):', error);
            }
        }, 5000);

    } catch (error) {
        logger.error(`closeInactiveTicket hatası:`, error);
        throw error;
    }
}

/**
 * Süreyi formatlar
 */
function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} gün ${hours % 24} saat`;
    if (hours > 0) return `${hours} saat ${minutes % 60} dakika`;
    if (minutes > 0) return `${minutes} dakika`;
    return `${seconds} saniye`;
}

/**
 * Bekle
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export default { startAutoClose };
