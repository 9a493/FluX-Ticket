import { EmbedBuilder, WebhookClient } from 'discord.js';
import { guildDB } from './database.js';
import { t } from './i18n.js';
import logger from './logger.js';

const webhookCache = new Map();

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
        return false;
    }
}

export async function sendWebhook(guildId, options) {
    try {
        const config = await guildDB.getOrCreate(guildId, 'Unknown');
        if (!config.webhookUrl) return false;

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
            username: options.username || 'Ticket Bot',
            embeds: [embed],
        });
        return true;
    } catch (error) {
        logger.error('Webhook error:', error.message);
        return false;
    }
}

export async function notifyTicketCreated(client, ticket, guild, user) {
    const config = await guildDB.getOrCreate(guild.id, guild.name);
    const num = ticket.ticketNumber.toString().padStart(4, '0');

    if (config.dmNotifications) {
        await sendDM(user, {
            title: t(guild.id, 'dmCreated', { number: num, guild: guild.name }),
            description: 'Yetkili ekip en kısa sürede size yardımcı olacaktır.',
            color: '#57F287',
        });
    }

    if (config.webhookUrl) {
        await sendWebhook(guild.id, {
            title: '📬 Yeni Ticket',
            description: `**#${num}** - ${user.tag}`,
            color: '#57F287',
            fields: [
                { name: 'Kullanıcı', value: `${user}`, inline: true },
                { name: 'Ticket', value: `#${num}`, inline: true },
            ],
        });
    }
}

export async function notifyTicketClaimed(client, ticket, guild, staff) {
    const config = await guildDB.getOrCreate(guild.id, guild.name);
    const num = ticket.ticketNumber.toString().padStart(4, '0');

    if (config.dmNotifications) {
        try {
            const owner = await client.users.fetch(ticket.userId);
            await sendDM(owner, {
                title: t(guild.id, 'dmClaimed', { number: num, staff: staff.tag, guild: guild.name }),
                description: `${staff.tag} size yardımcı olacak.`,
                color: '#57F287',
            });
        } catch (e) {}
    }

    if (config.webhookUrl) {
        await sendWebhook(guild.id, {
            title: '✅ Ticket Sahiplenildi',
            description: `**#${num}** - ${staff.tag}`,
            color: '#57F287',
        });
    }
}

export async function notifyTicketClosed(client, ticket, guild, closedBy, reason) {
    const config = await guildDB.getOrCreate(guild.id, guild.name);
    const num = ticket.ticketNumber.toString().padStart(4, '0');

    if (config.dmNotifications) {
        try {
            const owner = await client.users.fetch(ticket.userId);
            await sendDM(owner, {
                title: t(guild.id, 'dmClosed', { number: num, guild: guild.name }),
                description: reason ? `Sebep: ${reason}` : 'Destek için teşekkürler!',
                color: '#ED4245',
            });
        } catch (e) {}
    }

    if (config.webhookUrl) {
        await sendWebhook(guild.id, {
            title: '🔒 Ticket Kapatıldı',
            description: `**#${num}** - ${closedBy?.tag || 'Sistem'}`,
            color: '#ED4245',
            fields: reason ? [{ name: 'Sebep', value: reason }] : [],
        });
    }
}

export default { sendDM, sendWebhook, notifyTicketCreated, notifyTicketClaimed, notifyTicketClosed };
