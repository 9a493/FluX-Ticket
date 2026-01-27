import { EmbedBuilder } from 'discord.js';
import { ticketDB, guildDB, statsDB } from './database.js';
import logger from './logger.js';

// SLA Check interval (5 dakika)
const SLA_CHECK_INTERVAL = 5 * 60 * 1000;

let client = null;
let slaInterval = null;

/**
 * SLA sistemini başlat
 */
export function startSLAMonitor(discordClient) {
    client = discordClient;
    
    if (slaInterval) {
        clearInterval(slaInterval);
    }

    slaInterval = setInterval(checkSLABreaches, SLA_CHECK_INTERVAL);
    logger.info('✅ SLA Monitor started');
}

/**
 * Ticket için SLA deadline hesapla
 */
export function calculateSLADeadline(ticket, guildConfig, category = null) {
    const now = new Date();
    
    // Kategori-specific SLA veya guild default
    const firstResponseMins = category?.slaFirstResponseMins || guildConfig.slaFirstResponseMins || 60;
    const resolutionHours = category?.slaResolutionHours || guildConfig.slaResolutionHours || 24;
    
    // İlk yanıt deadline
    const firstResponseDeadline = new Date(now.getTime() + firstResponseMins * 60 * 1000);
    
    // Çözüm deadline
    const resolutionDeadline = new Date(now.getTime() + resolutionHours * 60 * 60 * 1000);
    
    return {
        firstResponseDeadline,
        resolutionDeadline,
        firstResponseMins,
        resolutionHours,
    };
}

/**
 * İlk yanıt verildiğinde SLA güncelle
 */
export async function recordFirstResponse(channelId) {
    try {
        const ticket = await ticketDB.get(channelId);
        if (!ticket || ticket.firstResponseAt) return;

        const now = new Date();
        const responseTime = now.getTime() - new Date(ticket.createdAt).getTime();
        const responseMinutes = responseTime / (1000 * 60);

        // SLA karşılandı mı?
        const guildConfig = await guildDB.getOrCreate(ticket.guildId, 'Unknown');
        const slaFirstResponseMins = ticket.category?.slaFirstResponseMins || guildConfig.slaFirstResponseMins || 60;
        const slaMet = responseMinutes <= slaFirstResponseMins;

        await ticketDB.update(channelId, {
            firstResponseAt: now,
            slaFirstResponseAt: now,
            slaFirstResponseMet: slaMet,
        });

        // İstatistikleri güncelle
        if (slaMet) {
            await statsDB.incrementSLAMet(ticket.guildId);
        }

        logger.info(`SLA first response recorded for ticket #${ticket.ticketNumber}: ${slaMet ? 'MET' : 'MISSED'} (${responseMinutes.toFixed(1)} mins)`);

    } catch (error) {
        logger.error('SLA recordFirstResponse error:', error);
    }
}

/**
 * SLA ihlallerini kontrol et
 */
async function checkSLABreaches() {
    if (!client) return;

    try {
        // Tüm açık ticketları al
        const tickets = await ticketDB.getOpenTicketsWithSLA();

        for (const ticket of tickets) {
            const guildConfig = await guildDB.getOrCreate(ticket.guildId, 'Unknown');
            
            if (!guildConfig.slaEnabled) continue;

            const now = new Date();
            
            // İlk yanıt SLA kontrolü
            if (!ticket.firstResponseAt && !ticket.slaBreached) {
                const slaFirstResponseMins = ticket.category?.slaFirstResponseMins || guildConfig.slaFirstResponseMins || 60;
                const deadline = new Date(new Date(ticket.createdAt).getTime() + slaFirstResponseMins * 60 * 1000);
                
                if (now > deadline) {
                    await handleSLABreach(ticket, guildConfig, 'first_response');
                }
            }

            // Çözüm SLA kontrolü
            if (ticket.slaDueAt && now > new Date(ticket.slaDueAt) && !ticket.slaBreached) {
                await handleSLABreach(ticket, guildConfig, 'resolution');
            }
        }

    } catch (error) {
        logger.error('SLA check error:', error);
    }
}

/**
 * SLA ihlali işle
 */
async function handleSLABreach(ticket, guildConfig, breachType) {
    try {
        // Ticket'ı breached olarak işaretle
        await ticketDB.update(ticket.channelId, {
            slaBreached: true,
        });

        // İstatistik güncelle
        await statsDB.incrementSLABreached(ticket.guildId);

        // Guild'i al
        const guild = await client.guilds.fetch(ticket.guildId).catch(() => null);
        if (!guild) return;

        // Ticket kanalını al
        const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);
        if (!channel) return;

        // Uyarı mesajı gönder
        const breachMessages = {
            first_response: '⚠️ **SLA İhlali:** İlk yanıt süresi aşıldı!',
            resolution: '⚠️ **SLA İhlali:** Çözüm süresi aşıldı!',
        };

        const embed = new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('⚠️ SLA İhlali')
            .setDescription(breachMessages[breachType])
            .addFields(
                { name: '📝 Ticket', value: `#${ticket.ticketNumber.toString().padStart(4, '0')}`, inline: true },
                { name: '⏱️ Tür', value: breachType === 'first_response' ? 'İlk Yanıt' : 'Çözüm Süresi', inline: true },
            )
            .setTimestamp();

        await channel.send({ embeds: [embed] });

        // Eskalasyon
        if (guildConfig.slaEscalationRole && !ticket.escalatedAt) {
            await escalateTicket(ticket, guildConfig, guild, channel);
        }

        logger.warn(`SLA breach: Ticket #${ticket.ticketNumber} - ${breachType}`);

    } catch (error) {
        logger.error('SLA breach handling error:', error);
    }
}

/**
 * Ticket'ı eskale et
 */
async function escalateTicket(ticket, guildConfig, guild, channel) {
    try {
        await ticketDB.update(ticket.channelId, {
            escalatedAt: new Date(),
            escalatedTo: guildConfig.slaEscalationRole,
            priority: 4, // Acil
        });

        // Kanal adını güncelle
        const ticketNumber = ticket.ticketNumber.toString().padStart(4, '0');
        await channel.setName(`🔴-urgent-${ticketNumber}`).catch(() => {});

        // Eskalasyon mesajı
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('🚨 Ticket Eskale Edildi')
            .setDescription(`Bu ticket SLA ihlali nedeniyle <@&${guildConfig.slaEscalationRole}> rolüne eskale edildi.`)
            .addFields(
                { name: '📝 Ticket', value: `#${ticketNumber}`, inline: true },
                { name: '👤 Açan', value: `<@${ticket.userId}>`, inline: true },
            )
            .setTimestamp();

        await channel.send({
            content: `<@&${guildConfig.slaEscalationRole}>`,
            embeds: [embed],
        });

        // Log kanalına bildir
        if (guildConfig.logChannelId) {
            const logChannel = await guild.channels.fetch(guildConfig.logChannelId).catch(() => null);
            if (logChannel) {
                await logChannel.send({ embeds: [embed] });
            }
        }

        logger.info(`Ticket #${ticket.ticketNumber} escalated`);

    } catch (error) {
        logger.error('Ticket escalation error:', error);
    }
}

/**
 * SLA durumunu kontrol et
 */
export function getSLAStatus(ticket, guildConfig) {
    if (!guildConfig.slaEnabled) return null;

    const now = new Date();
    const created = new Date(ticket.createdAt);
    
    const slaFirstResponseMins = ticket.category?.slaFirstResponseMins || guildConfig.slaFirstResponseMins || 60;
    const slaResolutionHours = ticket.category?.slaResolutionHours || guildConfig.slaResolutionHours || 24;
    
    // İlk yanıt durumu
    let firstResponseStatus = 'pending';
    if (ticket.firstResponseAt) {
        firstResponseStatus = ticket.slaFirstResponseMet ? 'met' : 'breached';
    } else {
        const deadline = new Date(created.getTime() + slaFirstResponseMins * 60 * 1000);
        if (now > deadline) {
            firstResponseStatus = 'breached';
        } else {
            const remaining = deadline.getTime() - now.getTime();
            const remainingMins = Math.ceil(remaining / 60000);
            firstResponseStatus = remainingMins <= 10 ? 'warning' : 'pending';
        }
    }

    // Çözüm durumu
    let resolutionStatus = 'pending';
    const resolutionDeadline = new Date(created.getTime() + slaResolutionHours * 60 * 60 * 1000);
    
    if (ticket.status === 'closed') {
        const closeTime = new Date(ticket.closedAt);
        resolutionStatus = closeTime <= resolutionDeadline ? 'met' : 'breached';
    } else if (now > resolutionDeadline) {
        resolutionStatus = 'breached';
    } else {
        const remaining = resolutionDeadline.getTime() - now.getTime();
        const remainingHours = remaining / (60 * 60 * 1000);
        resolutionStatus = remainingHours <= 2 ? 'warning' : 'pending';
    }

    return {
        firstResponse: {
            status: firstResponseStatus,
            deadline: new Date(created.getTime() + slaFirstResponseMins * 60 * 1000),
            targetMins: slaFirstResponseMins,
        },
        resolution: {
            status: resolutionStatus,
            deadline: resolutionDeadline,
            targetHours: slaResolutionHours,
        },
        breached: ticket.slaBreached,
        escalated: !!ticket.escalatedAt,
    };
}

export default {
    startSLAMonitor,
    calculateSLADeadline,
    recordFirstResponse,
    getSLAStatus,
};
