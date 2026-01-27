import { 
    ChannelType, 
    PermissionFlagsBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} from 'discord.js';
import { guildDB, ticketDB, categoryDB, userDB } from './database.js';
import { checkSpam, recordTicketCreation } from './spamProtection.js';
import { calculateSLADeadline } from './sla.js';
import { t, getLocale } from './i18n.js';
import logger from './logger.js';

/**
 * Yeni ticket oluştur
 */
export async function createTicket(guild, user, categoryId = null, options = {}) {
    try {
        // Guild config al
        const guildConfig = await guildDB.getOrCreate(guild.id, guild.name);
        const locale = getLocale(guildConfig.locale);

        // Blacklist kontrolü
        const isBlacklisted = await userDB.isBlacklisted(user.id);
        if (isBlacklisted) {
            return { success: false, error: t(locale, 'ticket.blacklisted') };
        }

        // Max ticket kontrolü
        const activeTickets = await ticketDB.getUserTicketCount(guild.id, user.id);
        if (activeTickets >= (guildConfig.maxTicketsPerUser || 3)) {
            return { success: false, error: t(locale, 'ticket.maxReached', { max: guildConfig.maxTicketsPerUser || 3 }) };
        }

        // Spam kontrolü
        const spamCheck = await checkSpam(guild.id, user.id, guildConfig);
        if (spamCheck.isSpam) {
            return { 
                success: false, 
                error: `⚠️ Spam koruması: ${spamCheck.resetIn} dakika sonra tekrar deneyebilirsiniz.` 
            };
        }

        // Kategori bilgisini al
        let category = null;
        if (categoryId) {
            category = await categoryDB.get(categoryId);
        }

        // Discord kategorisini bul
        const discordCategoryId = category?.discordCategoryId || guildConfig.categoryId;

        // Ticket numarası
        const ticketNumber = (guildConfig.ticketCount || 0) + 1;
        const paddedNumber = ticketNumber.toString().padStart(4, '0');

        // Kanal adı
        const channelName = category 
            ? `${category.emoji || '🎫'}-${paddedNumber}`
            : `ticket-${paddedNumber}`;

        // Staff rollerini al
        const staffRoles = category?.staffRoles || guildConfig.staffRoles;
        const staffRoleIds = staffRoles?.split(',').filter(r => r) || [];

        // Kanal izinlerini oluştur
        const permissionOverwrites = [
            {
                id: guild.id,
                deny: [PermissionFlagsBits.ViewChannel],
            },
            {
                id: user.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.EmbedLinks,
                ],
            },
        ];

        // Staff rollerini ekle
        for (const roleId of staffRoleIds) {
            permissionOverwrites.push({
                id: roleId,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.ManageMessages,
                    PermissionFlagsBits.AttachFiles,
                ],
            });
        }

        // Kanalı oluştur
        const channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: discordCategoryId,
            permissionOverwrites,
            topic: `Ticket #${paddedNumber} | ${user.tag} | ${options.subject || 'Destek Talebi'}`,
        });

        // Database'e kaydet
        const ticket = await ticketDB.create(guild.id, user.id, channel.id, categoryId);

        // Subject ve description güncelle
        if (options.subject || options.description) {
            await ticketDB.update(channel.id, {
                subject: options.subject,
                description: options.description,
            });
        }

        // SLA deadline hesapla
        if (guildConfig.slaEnabled) {
            const slaDeadline = calculateSLADeadline(ticket, guildConfig, category);
            await ticketDB.update(channel.id, {
                slaDueAt: slaDeadline.resolutionDeadline,
            });
        }

        // Spam kaydı
        recordTicketCreation(guild.id, user.id);

        // Hoşgeldin mesajı embed
        const welcomeEmbed = new EmbedBuilder()
            .setColor(category?.color || '#5865F2')
            .setTitle(`${category?.emoji || '🎫'} Ticket #${paddedNumber}`)
            .setDescription(guildConfig.welcomeMessage || t(locale, 'ticket.welcomeMessage'))
            .addFields(
                { name: '👤 Açan', value: `${user}`, inline: true },
                { name: '📁 Kategori', value: category?.name || 'Genel', inline: true },
                { name: '📅 Tarih', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
            )
            .setFooter({ text: `FluX Ticket • ${guild.name}` })
            .setTimestamp();

        if (options.subject) {
            welcomeEmbed.addFields({ name: '📝 Konu', value: options.subject, inline: false });
        }

        if (options.description) {
            welcomeEmbed.addFields({ 
                name: '📋 Açıklama', 
                value: options.description.length > 1000 
                    ? options.description.substring(0, 1000) + '...' 
                    : options.description, 
                inline: false 
            });
        }

        // SLA bilgisi
        if (guildConfig.slaEnabled) {
            const slaFirstResponseMins = category?.slaFirstResponseMins || guildConfig.slaFirstResponseMins || 60;
            welcomeEmbed.addFields({ 
                name: '⏱️ SLA', 
                value: `İlk yanıt hedefi: ${slaFirstResponseMins} dakika`, 
                inline: false 
            });
        }

        // Butonlar
        const actionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('claim')
                .setLabel('Sahiplen')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('✋'),
            new ButtonBuilder()
                .setCustomId('close')
                .setLabel('Kapat')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔒'),
        );

        await channel.send({
            content: `${user} ${staffRoleIds.map(r => `<@&${r}>`).join(' ')}`,
            embeds: [welcomeEmbed],
            components: [actionRow],
        });

        // DM bildirimi
        if (guildConfig.dmNotifications) {
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor('#57F287')
                    .setTitle('🎫 Ticket Oluşturuldu')
                    .setDescription(`**${guild.name}** sunucusunda ticketınız oluşturuldu.`)
                    .addFields(
                        { name: '📝 Ticket', value: `#${paddedNumber}`, inline: true },
                        { name: '📁 Kanal', value: `${channel}`, inline: true },
                    )
                    .setTimestamp();

                await user.send({ embeds: [dmEmbed] }).catch(() => {});
            } catch (error) {
                // DM kapalı olabilir
            }
        }

        // Log kanalına bildir
        if (guildConfig.logChannelId) {
            try {
                const logChannel = await guild.channels.fetch(guildConfig.logChannelId);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setColor('#57F287')
                        .setTitle('📬 Yeni Ticket')
                        .addFields(
                            { name: '📝 Ticket', value: `#${paddedNumber}`, inline: true },
                            { name: '👤 Açan', value: `${user.tag} (${user.id})`, inline: true },
                            { name: '📁 Kategori', value: category?.name || 'Genel', inline: true },
                        )
                        .setTimestamp();

                    if (options.subject) {
                        logEmbed.addFields({ name: '📝 Konu', value: options.subject, inline: false });
                    }

                    await logChannel.send({ embeds: [logEmbed] });
                }
            } catch (error) {
                logger.warn('Log channel send error:', error);
            }
        }

        logger.info(`Ticket #${paddedNumber} created by ${user.tag} in ${guild.name}`);

        return { 
            success: true, 
            ticket,
            channel,
            ticketNumber: paddedNumber,
        };

    } catch (error) {
        logger.error('createTicket error:', error);
        return { success: false, error: 'Ticket oluşturulurken bir hata oluştu!' };
    }
}

/**
 * Kullanıcının staff olup olmadığını kontrol et
 */
export function isStaffMember(member, guildConfig) {
    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
        return true;
    }

    const staffRoles = guildConfig.staffRoles?.split(',').filter(r => r) || [];
    return staffRoles.some(roleId => member.roles.cache.has(roleId));
}

/**
 * Ticket'ı arşivle
 */
export async function archiveTicket(channel, ticket) {
    try {
        // Mesajları topla
        const messages = await channel.messages.fetch({ limit: 100 });
        
        let transcript = `# Ticket #${ticket.ticketNumber.toString().padStart(4, '0')} Transcript\n`;
        transcript += `Created: ${new Date(ticket.createdAt).toISOString()}\n`;
        transcript += `Closed: ${new Date().toISOString()}\n\n`;
        transcript += `---\n\n`;

        const sortedMessages = [...messages.values()].reverse();
        for (const msg of sortedMessages) {
            const time = msg.createdAt.toISOString();
            const author = msg.author.tag;
            const content = msg.content || '[Embed/Attachment]';
            transcript += `[${time}] ${author}: ${content}\n`;
        }

        return transcript;

    } catch (error) {
        logger.error('archiveTicket error:', error);
        return null;
    }
}

export default {
    createTicket,
    isStaffMember,
    archiveTicket,
};
