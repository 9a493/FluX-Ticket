import { EmbedBuilder } from 'discord.js';
import { ticketDB, guildDB, dailyStatsDB, reminderDB, staffDB, statsDB } from './database.js';
import logger from './logger.js';

let client = null;
let intervals = [];

export function startScheduler(discordClient) {
    client = discordClient;

    // Clear old intervals
    intervals.forEach(clearInterval);
    intervals = [];

    // Auto-close check (every 30 minutes)
    intervals.push(setInterval(checkAutoClose, 30 * 60 * 1000));
    
    // Scheduled close check (every minute)
    intervals.push(setInterval(checkScheduledClose, 60 * 1000));
    
    // Reminder check (every minute)
    intervals.push(setInterval(checkReminders, 60 * 1000));
    
    // Daily stats recording (every hour)
    intervals.push(setInterval(recordDailyStats, 60 * 60 * 1000));
    
    // Daily reset (midnight)
    scheduleDailyReset();
    
    logger.info('⏰ Scheduler started with all tasks');
}

async function checkAutoClose() {
    if (!client) return;

    try {
        const guilds = await client.guilds.fetch();
        
        for (const [guildId, guild] of guilds) {
            const guildConfig = await guildDB.getOrCreate(guildId, guild.name);
            if (!guildConfig.autoCloseHours || guildConfig.autoCloseHours <= 0) continue;

            const inactiveTickets = await ticketDB.getInactiveTickets(guildConfig.autoCloseHours);
            
            for (const ticket of inactiveTickets) {
                if (ticket.guildId !== guildId) continue;

                try {
                    const fullGuild = await client.guilds.fetch(guildId);
                    const channel = await fullGuild.channels.fetch(ticket.channelId).catch(() => null);
                    
                    if (!channel) continue;

                    // Send warning
                    const embed = new EmbedBuilder()
                        .setColor('#FEE75C')
                        .setTitle('⏰ Otomatik Kapatma Uyarısı')
                        .setDescription(`Bu ticket ${guildConfig.autoCloseHours} saattir aktif değil ve otomatik olarak kapatılacak.`)
                        .setTimestamp();

                    await channel.send({ embeds: [embed] });
                    
                    // Close after 5 minutes
                    setTimeout(async () => {
                        await ticketDB.close(ticket.channelId, client.user.id, 'Otomatik kapatma (inaktivite)');
                        await channel.delete().catch(() => {});
                        logger.info(`Auto-closed ticket #${ticket.ticketNumber} (inactivity)`);
                    }, 5 * 60 * 1000);

                } catch (error) {
                    logger.error(`Auto-close error for ticket ${ticket.id}:`, error);
                }
            }
        }
    } catch (error) {
        logger.error('Auto-close check error:', error);
    }
}

async function checkScheduledClose() {
    if (!client) return;

    try {
        const tickets = await ticketDB.getScheduledTickets();
        const now = new Date();

        for (const ticket of tickets) {
            if (!ticket.scheduledCloseAt || new Date(ticket.scheduledCloseAt) > now) continue;

            try {
                const guild = await client.guilds.fetch(ticket.guildId).catch(() => null);
                if (!guild) continue;

                const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);
                if (!channel) continue;

                const embed = new EmbedBuilder()
                    .setColor('#ED4245')
                    .setTitle('🔒 Zamanlı Kapatma')
                    .setDescription(ticket.scheduledCloseReason || 'Zamanlanmış kapatma süresi doldu.')
                    .setTimestamp();

                await channel.send({ embeds: [embed] });
                
                await ticketDB.close(
                    ticket.channelId, 
                    ticket.scheduledCloseBy || client.user.id, 
                    ticket.scheduledCloseReason || 'Zamanlanmış kapatma'
                );

                setTimeout(() => channel.delete().catch(() => {}), 10000);
                
                logger.info(`Scheduled close: ticket #${ticket.ticketNumber}`);

            } catch (error) {
                logger.error(`Scheduled close error for ticket ${ticket.id}:`, error);
            }
        }
    } catch (error) {
        logger.error('Scheduled close check error:', error);
    }
}

async function checkReminders() {
    if (!client) return;

    try {
        const dueReminders = await reminderDB.getDue();

        for (const reminder of dueReminders) {
            try {
                const guild = await client.guilds.fetch(reminder.guildId).catch(() => null);
                if (!guild) continue;

                const channel = await guild.channels.fetch(reminder.channelId).catch(() => null);
                if (!channel) continue;

                const embed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle('⏰ Hatırlatma')
                    .setDescription(reminder.message || 'Hatırlatma!')
                    .addFields({ name: '👤 Oluşturan', value: `<@${reminder.userId}>`, inline: true })
                    .setTimestamp();

                await channel.send({
                    content: `<@${reminder.userId}>`,
                    embeds: [embed],
                });

                await reminderDB.markComplete(reminder.id);
                
                logger.debug(`Reminder sent for ticket in channel ${reminder.channelId}`);

            } catch (error) {
                logger.error(`Reminder error for ${reminder.id}:`, error);
                await reminderDB.markComplete(reminder.id);
            }
        }
    } catch (error) {
        logger.error('Reminder check error:', error);
    }
}

async function recordDailyStats() {
    if (!client) return;

    try {
        const guilds = await client.guilds.fetch();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const [guildId, guild] of guilds) {
            try {
                // Get today's tickets
                const allTickets = await ticketDB.getAllTickets(guildId);
                const todayTickets = allTickets.filter(t => new Date(t.createdAt) >= today);
                const todayClosed = allTickets.filter(t => t.closedAt && new Date(t.closedAt) >= today);

                // Calculate averages
                const ratings = todayClosed.filter(t => t.rating).map(t => t.rating);
                const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

                // Record stats
                await dailyStatsDB.recordDaily(guildId, {
                    ticketsOpened: todayTickets.length,
                    ticketsClosed: todayClosed.length,
                    avgRating,
                });

            } catch (error) {
                logger.error(`Daily stats error for guild ${guildId}:`, error);
            }
        }

        logger.debug('Daily stats recorded');

    } catch (error) {
        logger.error('Record daily stats error:', error);
    }
}

function scheduleDailyReset() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    
    const msUntilMidnight = midnight.getTime() - now.getTime();

    setTimeout(async () => {
        // Reset daily counters
        logger.info('🌙 Daily reset running...');
        
        try {
            // Reset staff loads
            const guilds = await client.guilds.fetch();
            for (const [guildId, guild] of guilds) {
                await staffDB.resetAllLoads(guildId);
            }
            logger.info('Staff loads reset');
        } catch (error) {
            logger.error('Daily reset error:', error);
        }

        // Schedule next reset
        scheduleDailyReset();
    }, msUntilMidnight);

    logger.debug(`Next daily reset in ${Math.round(msUntilMidnight / 1000 / 60)} minutes`);
}

export function stopScheduler() {
    intervals.forEach(clearInterval);
    intervals = [];
    logger.info('Scheduler stopped');
}

export default { startScheduler, stopScheduler };
