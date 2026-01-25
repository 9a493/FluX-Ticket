import { EmbedBuilder } from 'discord.js';
import { ticketDB, guildDB } from './database.js';
import { generateTranscript } from './transcript.js';
import { notifyTicketClosed } from './notifications.js';
import logger from './logger.js';

const scheduledCloses = new Map();

export function scheduleClose(channelId, closeTime, userId, reason = null) {
    cancelScheduledClose(channelId);

    const delay = closeTime.getTime() - Date.now();
    if (delay <= 0) return;

    const timeout = setTimeout(async () => {
        await executeScheduledClose(channelId, userId, reason);
    }, delay);

    scheduledCloses.set(channelId, { timeout, closeTime, userId, reason });
    logger.info(`Scheduled close for ${channelId} at ${closeTime.toISOString()}`);
}

export function cancelScheduledClose(channelId) {
    const scheduled = scheduledCloses.get(channelId);
    if (scheduled) {
        clearTimeout(scheduled.timeout);
        scheduledCloses.delete(channelId);
        logger.info(`Cancelled scheduled close for ${channelId}`);
    }
}

async function executeScheduledClose(channelId, userId, reason) {
    try {
        const ticket = await ticketDB.get(channelId);
        if (!ticket || ticket.status === 'closed') {
            scheduledCloses.delete(channelId);
            return;
        }

        const client = global.discordClient;
        if (!client) return;

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

        // Generate transcript
        let transcriptUrl = null;
        try {
            transcriptUrl = await generateTranscript(channel, ticket);
        } catch (e) {
            logger.error('Transcript error:', e);
        }

        // Close in database
        await ticketDB.close(channelId, userId || 'SYSTEM', reason || 'Scheduled close', transcriptUrl);

        // Send close message
        const embed = new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('🔒 Ticket Kapatıldı (Zamanlanmış)')
            .setDescription('5 saniye içinde kanal silinecek...')
            .setTimestamp();

        await channel.send({ embeds: [embed] });

        // Notify
        await notifyTicketClosed(client, ticket, guild, null, reason);

        // Delete channel
        setTimeout(async () => {
            try {
                await channel.delete();
            } catch (e) {}
        }, 5000);

        scheduledCloses.delete(channelId);
        logger.info(`Scheduled close executed for ticket #${ticket.ticketNumber}`);

    } catch (error) {
        logger.error('Scheduled close error:', error);
        scheduledCloses.delete(channelId);
    }
}

export async function loadScheduledCloses() {
    try {
        const tickets = await ticketDB.getScheduledTickets();
        for (const ticket of tickets) {
            if (ticket.scheduledCloseAt) {
                const closeTime = new Date(ticket.scheduledCloseAt);
                if (closeTime > new Date()) {
                    scheduleClose(ticket.channelId, closeTime, ticket.scheduledCloseBy, ticket.scheduledCloseReason);
                } else {
                    await executeScheduledClose(ticket.channelId, ticket.scheduledCloseBy, ticket.scheduledCloseReason);
                }
            }
        }
        logger.info(`Loaded ${scheduledCloses.size} scheduled closes`);
    } catch (error) {
        logger.error('Load scheduled closes error:', error);
    }
}

export default { scheduleClose, cancelScheduledClose, loadScheduledCloses };
