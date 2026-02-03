import { EmbedBuilder } from 'discord.js';
import { ticketDB, guildDB } from './database.js';
import { generateTranscript, createTranscriptEmbed } from './transcript.js';
import { notifyTicketClosed } from './notifications.js';
import logger from './logger.js';

const BASE_URL = process.env.BASE_URL || 'https://fluxdigital.com.tr';

const scheduledCloses = new Map();

/**
 * Schedule a ticket close
 */
export function scheduleClose(channelId, closeTime, userId, reason = null) {
    // Önceki zamanlamayı iptal et
    cancelScheduledClose(channelId);

    const delay = closeTime.getTime() - Date.now();
    if (delay <= 0) return;

    const timeout = setTimeout(async () => {
        await executeScheduledClose(channelId, userId, reason);
    }, delay);

    scheduledCloses.set(channelId, { timeout, closeTime, userId, reason });
    logger.info(`Scheduled close for ${channelId} at ${closeTime.toISOString()}`);
}

/**
 * Cancel a scheduled close
 */
export function cancelScheduledClose(channelId) {
    const scheduled = scheduledCloses.get(channelId);
    if (scheduled) {
        clearTimeout(scheduled.timeout);
        scheduledCloses.delete(channelId);
        logger.info(`Cancelled scheduled close for ${channelId}`);
        return true;
    }
    return false;
}

/**
 * Get scheduled close info
 */
export function getScheduledClose(channelId) {
    return scheduledCloses.get(channelId);
}

/**
 * Execute scheduled close
 */
async function executeScheduledClose(channelId, userId, reason) {
    try {
        const ticket = await ticketDB.get(channelId);
        if (!ticket || ticket.status === 'closed') {
            scheduledCloses.delete(channelId);
            return;
        }

        const client = global.discordClient;
        if (!client) {
            logger.error('Discord client not available for scheduled close');
            return;
        }

        const guild = await client.guilds.fetch(ticket.guildId).catch(() => null);
        if (!guild) {
            scheduledCloses.delete(channelId);
            return;
        }

        const channel = await guild.channels.fetch(channelId).catch(() => null);
        if (!channel) {
            await ticketDB.close(channelId, 'SYSTEM', 'Channel deleted');
            scheduledCloses.delete(channelId);
            return;
        }

        const guildConfig = await guildDB.get(guild.id);

        // Generate transcript
        let transcriptId = null;
        try {
            transcriptId = await generateTranscript(channel, ticket, guild);
        } catch (e) {
            logger.error('Transcript error:', e);
        }

        // Close in database
        await ticketDB.close(channelId, userId || 'SYSTEM', reason || 'Zamanlanmış kapatma', 'System');

        // Send close message
        const embed = new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('🔒 Ticket Kapatıldı (Zamanlanmış)')
            .setDescription('Bu ticket zamanlanmış kapatma ile kapatıldı.\n5 saniye içinde kanal silinecek...')
            .addFields(
                { name: '📝 Ticket', value: `#${ticket.ticketNumber.toString().padStart(4, '0')}`, inline: true },
            )
            .setTimestamp();

        if (reason) {
            embed.addFields({ name: '📋 Sebep', value: reason, inline: false });
        }

        if (transcriptId) {
            embed.addFields({
                name: '📄 Transcript',
                value: `[Web'de Görüntüle](${BASE_URL}/transcript/${transcriptId})`,
                inline: true
            });
        }

        await channel.send({ embeds: [embed] });

        // Log kanalına bildir
        if (guildConfig?.logChannelId || guildConfig?.transcriptChannelId) {
            const logChannelId = guildConfig.transcriptChannelId || guildConfig.logChannelId;
            try {
                const logChannel = await guild.channels.fetch(logChannelId);
                const updatedTicket = await ticketDB.get(channelId);
                const transcriptEmbed = createTranscriptEmbed(updatedTicket, transcriptId, BASE_URL);
                await logChannel.send({ embeds: [transcriptEmbed] });
            } catch (error) {
                // Log hatası sessiz
            }
        }

        // Notify
        await notifyTicketClosed(client, ticket, guild, null, reason);

        // Delete channel
        setTimeout(async () => {
            try {
                await channel.delete();
            } catch (e) {
                logger.error('Channel delete error:', e);
            }
        }, 5000);

        scheduledCloses.delete(channelId);
        logger.info(`Scheduled close executed for ticket #${ticket.ticketNumber}`);

    } catch (error) {
        logger.error('Scheduled close error:', error);
        scheduledCloses.delete(channelId);
    }
}

/**
 * Load scheduled closes from database on startup
 */
export async function loadScheduledCloses() {
    try {
        const tickets = await ticketDB.getScheduledTickets();
        
        for (const ticket of tickets) {
            if (ticket.scheduledCloseAt) {
                const closeTime = new Date(ticket.scheduledCloseAt);
                if (closeTime > new Date()) {
                    scheduleClose(ticket.channelId, closeTime, ticket.scheduledCloseBy, ticket.scheduledCloseReason);
                } else {
                    // Zaman geçmiş, hemen kapat
                    await executeScheduledClose(ticket.channelId, ticket.scheduledCloseBy, ticket.scheduledCloseReason);
                }
            }
        }
        
        logger.info(`Loaded ${scheduledCloses.size} scheduled closes`);
    } catch (error) {
        logger.error('Load scheduled closes error:', error);
    }
}

export default { scheduleClose, cancelScheduledClose, getScheduledClose, loadScheduledCloses };
