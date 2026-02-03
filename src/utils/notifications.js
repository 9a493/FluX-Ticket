import { EmbedBuilder, WebhookClient } from 'discord.js';
import { guildDB } from './database.js';
import { t } from './i18n.js';
import logger from './logger.js';

const webhookCache = new Map();

/**
 * Send a DM to a user
 */
export async function sendDM(user, options) {
    try {
        const embed = new EmbedBuilder()
            .setColor(options.color || '#5865F2')
            .setTitle(options.title)
            .setDescription(options.description)
            .setTimestamp();
        
        if (options.fields) embed.addFields(options.fields);
        if (options.footer) embed.setFooter({ text: options.footer });
        
        await user.send({ embeds: [embed] });
        return true;
    } catch (error) {
        // DM kapalı olabilir, sessizce devam et
        return false;
    }
}

/**
 * Send to webhook
 */
export async function sendWebhook(guildId, options) {
    try {
        const config = await guildDB.get(guildId);
        if (!config?.webhookUrl) return false;

        let webhook = webhookCache.get(config.webhookUrl);
        if (!webhook) {
            webhook = new WebhookClient({ url: config.webhookUrl });
            webhookCache.set(config.webhookUrl, webhook);
        }

        const embed = new EmbedBuilder()
            .setColor(options.color || '#5865F2')
            .setTitle(options.title)
            .setDescription(options.description || '')
            .setTimestamp();
        
        if (options.fields) embed.addFields(options.fields);

        await webhook.send({
            username: options.username || 'FluX Ticket',
            avatarURL: options.avatarURL || 'https://fluxdigital.com.tr/favicon.ico',
            embeds: [embed],
        });
        return true;
    } catch (error) {
        logger.error('Webhook error:', error.message);
        return false;
    }
}

/**
 * Notify when ticket is created
 */
export async function notifyTicketCreated(client, ticket, guild, user) {
    try {
        const config = await guildDB.get(guild.id);
        if (!config) return;

        const num = ticket.ticketNumber.toString().padStart(4, '0');

        // DM Notification
        if (config.dmNotifications) {
            await sendDM(user, {
                title: '🎫 Ticket Oluşturuldu',
                description: `Ticket **#${num}** başarıyla oluşturuldu.\n\n**Sunucu:** ${guild.name}\n\nYetkili ekip en kısa sürede size yardımcı olacaktır.`,
                color: '#57F287',
                footer: 'FluX Ticket System',
            });
        }

        // Webhook Notification
        if (config.webhookUrl) {
            await sendWebhook(guild.id, {
                title: '📬 Yeni Ticket Açıldı',
                description: `**#${num}** - ${user.tag}`,
                color: '#57F287',
                fields: [
                    { name: 'Kullanıcı', value: `${user}`, inline: true },
                    { name: 'Ticket', value: `#${num}`, inline: true },
                ],
            });
        }
    } catch (error) {
        logger.error('notifyTicketCreated error:', error);
    }
}

/**
 * Notify when ticket is claimed
 */
export async function notifyTicketClaimed(client, ticket, guild, staff) {
    try {
        const config = await guildDB.get(guild.id);
        if (!config) return;

        const num = ticket.ticketNumber.toString().padStart(4, '0');

        // DM to ticket owner
        if (config.dmNotifications) {
            try {
                const owner = await client.users.fetch(ticket.userId);
                await sendDM(owner, {
                    title: '✅ Ticket Sahiplenildi',
                    description: `Ticket **#${num}** **${staff.tag}** tarafından sahiplenildi.\n\n**Sunucu:** ${guild.name}\n\nSize yardımcı olacak.`,
                    color: '#57F287',
                    footer: 'FluX Ticket System',
                });
            } catch (e) {}
        }

        // Webhook
        if (config.webhookUrl) {
            await sendWebhook(guild.id, {
                title: '✅ Ticket Sahiplenildi',
                description: `**#${num}** - ${staff.tag}`,
                color: '#57F287',
                fields: [
                    { name: 'Yetkili', value: `${staff}`, inline: true },
                    { name: 'Ticket', value: `#${num}`, inline: true },
                ],
            });
        }
    } catch (error) {
        logger.error('notifyTicketClaimed error:', error);
    }
}

/**
 * Notify when ticket is closed
 */
export async function notifyTicketClosed(client, ticket, guild, closedBy, reason) {
    try {
        const config = await guildDB.get(guild.id);
        if (!config) return;

        const num = ticket.ticketNumber.toString().padStart(4, '0');

        // DM to ticket owner
        if (config.dmNotifications) {
            try {
                const owner = await client.users.fetch(ticket.userId);
                await sendDM(owner, {
                    title: '🔒 Ticket Kapatıldı',
                    description: `Ticket **#${num}** kapatıldı.\n\n**Sunucu:** ${guild.name}${reason ? `\n**Sebep:** ${reason}` : ''}\n\nDestek için teşekkürler!`,
                    color: '#ED4245',
                    footer: 'FluX Ticket System',
                });
            } catch (e) {}
        }

        // Webhook
        if (config.webhookUrl) {
            await sendWebhook(guild.id, {
                title: '🔒 Ticket Kapatıldı',
                description: `**#${num}** - ${closedBy?.tag || 'Sistem'}`,
                color: '#ED4245',
                fields: reason ? [{ name: 'Sebep', value: reason }] : [],
            });
        }
    } catch (error) {
        logger.error('notifyTicketClosed error:', error);
    }
}

/**
 * Notify when user is added to ticket
 */
export async function notifyUserAdded(client, ticket, guild, addedUser, addedBy) {
    try {
        const config = await guildDB.get(guild.id);
        if (!config?.dmNotifications) return;

        const num = ticket.ticketNumber.toString().padStart(4, '0');

        await sendDM(addedUser, {
            title: '➕ Ticket\'a Eklendiniz',
            description: `**#${num}** numaralı ticketa eklendiniz.\n\n**Sunucu:** ${guild.name}\n**Ekleyen:** ${addedBy.tag}`,
            color: '#5865F2',
            footer: 'FluX Ticket System',
        });
    } catch (error) {
        logger.error('notifyUserAdded error:', error);
    }
}

export default { 
    sendDM, 
    sendWebhook, 
    notifyTicketCreated, 
    notifyTicketClaimed, 
    notifyTicketClosed,
    notifyUserAdded,
};
