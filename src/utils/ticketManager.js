import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType, StringSelectMenuBuilder } from 'discord.js';
import logger from './logger.js';
import { guildDB, ticketDB, userDB, categoryDB, auditDB } from './database.js';
import { t, getLang } from './i18n.js';
import { generateTranscript, createTranscriptEmbed } from './transcript.js';
import { notifyTicketCreated, notifyTicketClosed, notifyTicketClaimed } from './notifications.js';

const BASE_URL = process.env.BASE_URL || 'https://fluxdigital.com.tr';

/**
 * Süreyi formatlar
 */
export function formatDuration(ms) {
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
 * Kullanıcının yetkili olup olmadığını kontrol eder
 */
export function isStaff(member, guildConfig) {
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
    
    const staffRoles = guildConfig.staffRoles 
        ? guildConfig.staffRoles.split(',').filter(r => r)
        : [];
    
    return staffRoles.some(roleId => member.roles.cache.has(roleId));
}

/**
 * Ticket oluşturur (buton ile)
 */
export async function createTicket(interaction, categoryId = null, subject = null, description = null) {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    const member = interaction.member;

    try {
        // Kullanıcı blacklist'te mi?
        const isBlacklisted = await userDB.isBlacklisted(member.id);
        if (isBlacklisted) {
            return interaction.editReply({
                content: t(guild.id, 'blacklisted'),
            });
        }

        // Guild ayarlarını al
        const guildConfig = await guildDB.getOrCreate(guild.id, guild.name);

        // Kullanıcının açık ticket sayısını kontrol et
        const activeTickets = await ticketDB.getUserActiveTickets(guild.id, member.id);
        const maxTickets = guildConfig.maxTicketsPerUser || 3;
        
        if (activeTickets.length >= maxTickets) {
            return interaction.editReply({
                content: t(guild.id, 'ticketLimit', { limit: maxTickets }) + 
                    `\n\nAçık ticketlarınız: ${activeTickets.map(t => `<#${t.channelId}>`).join(', ')}`,
            });
        }

        // Kategori bilgisini al
        let category = null;
        if (categoryId) {
            category = await categoryDB.get(categoryId);
        }

        // Staff rolleri
        const staffRoles = guildConfig.staffRoles 
            ? guildConfig.staffRoles.split(',').filter(r => r)
            : [];

        // Kategori özel rolleri
        if (category?.staffRoles) {
            const categoryRoles = category.staffRoles.split(',').filter(r => r);
            staffRoles.push(...categoryRoles);
        }

        // Discord kategorisi (ticket kanallarının olacağı yer)
        let discordCategoryId = category?.discordCategoryId || guildConfig.categoryId;

        // Kategori yoksa oluştur
        if (!discordCategoryId) {
            try {
                const discordCategory = await guild.channels.create({
                    name: '🎫 Tickets',
                    type: ChannelType.GuildCategory,
                });
                discordCategoryId = discordCategory.id;
                await guildDB.update(guild.id, { categoryId: discordCategoryId });
            } catch (error) {
                logger.error('Kategori oluşturma hatası:', error);
                return interaction.editReply({
                    content: '❌ Ticket kategorisi oluşturulamadı. Lütfen `/setup` komutunu kullanın.',
                });
            }
        }

        // Kullanıcı bilgilerini kaydet/güncelle
        await userDB.getOrCreate(member.id, member.user.username, member.user.globalName, member.user.displayAvatarURL());

        // Ticket kanalı oluştur
        const ticketNumber = (guildConfig.ticketCount + 1).toString().padStart(4, '0');
        const channelName = category 
            ? `${category.emoji || '🎫'}-${category.name.toLowerCase()}-${ticketNumber}`
            : `ticket-${ticketNumber}`;

        const ticketChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: discordCategoryId,
            topic: `Ticket #${ticketNumber} | ${member.user.tag} | ${subject || 'Destek Talebi'}`,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: member.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.AttachFiles,
                        PermissionFlagsBits.EmbedLinks,
                    ],
                },
                ...staffRoles.map(roleId => ({
                    id: roleId,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.ManageMessages,
                        PermissionFlagsBits.AttachFiles,
                        PermissionFlagsBits.EmbedLinks,
                    ],
                })),
            ],
        });

        // Database'e kaydet
        const ticket = await ticketDB.create(
            guild.id, 
            member.id, 
            ticketChannel.id, 
            category?.id || null,
            subject,
            description,
            member.user.tag
        );

        // Kullanıcı ticket sayısını artır
        await userDB.incrementTickets(member.id);

        // Hoş geldin mesajı
        const welcomeEmbed = new EmbedBuilder()
            .setColor(category?.color || '#5865F2')
            .setTitle(`🎫 Ticket #${ticketNumber}`)
            .setDescription(
                guildConfig.welcomeMessage?.replace('{user}', member.toString()) ||
                t(guild.id, 'welcomeDesc', { user: member.toString() })
            )
            .addFields(
                { name: '📝 Ticket Numarası', value: `#${ticketNumber}`, inline: true },
                { name: '👤 Açan', value: `${member}`, inline: true },
                { name: '📅 Açılış', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
            )
            .setThumbnail(member.user.displayAvatarURL())
            .setFooter({ text: 'Ticketı kapatmak için aşağıdaki butonu kullanın' })
            .setTimestamp();

        if (category) {
            welcomeEmbed.addFields({ name: '📁 Kategori', value: `${category.emoji || '🎫'} ${category.name}`, inline: true });
        }

        if (subject) {
            welcomeEmbed.addFields({ name: '📋 Konu', value: subject, inline: false });
        }

        if (description) {
            welcomeEmbed.addFields({ name: '📝 Açıklama', value: description, inline: false });
        }

        // Butonlar
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('claim_ticket')
                .setLabel('Sahiplen')
                .setEmoji('✋')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('close_ticket')
                .setLabel('Kapat')
                .setEmoji('🔒')
                .setStyle(ButtonStyle.Danger),
        );

        // Staff ping
        const staffMention = staffRoles.length > 0 
            ? staffRoles.map(r => `<@&${r}>`).join(' ')
            : '';

        await ticketChannel.send({
            content: staffMention || undefined,
            embeds: [welcomeEmbed],
            components: [row],
        });

        // Kullanıcıya başarı mesajı
        await interaction.editReply({
            content: t(guild.id, 'ticketCreated', { channel: ticketChannel.toString() }),
        });

        // DM bildirimi
        await notifyTicketCreated(interaction.client, ticket, guild, member.user);

        // Log kanalına bildir
        await sendTicketLog(guild, guildConfig, {
            title: '📬 Yeni Ticket Açıldı',
            color: '#57F287',
            fields: [
                { name: 'Ticket', value: `${ticketChannel}`, inline: true },
                { name: 'Kullanıcı', value: `${member}`, inline: true },
                { name: 'Numara', value: `#${ticketNumber}`, inline: true },
            ],
        });

        // Audit log
        await auditDB.log(guild.id, 'TICKET_CREATE', 'TICKET', member.id, member.user.tag, ticket.id, {
            ticketNumber: ticket.ticketNumber,
            categoryId: category?.id,
        });

        logger.info(`Ticket oluşturuldu: #${ticketNumber} by ${member.user.tag} in ${guild.name}`);

    } catch (error) {
        logger.error('Ticket oluşturma hatası:', error);
        await interaction.editReply({
            content: t(guild.id, 'error') + ' Ticket oluşturulamadı.',
        }).catch(() => {});
    }
}

/**
 * Ticket kapatma onayı
 */
export async function closeTicket(interaction, reason = null) {
    const channel = interaction.channel;

    try {
        const ticket = await ticketDB.get(channel.id);

        if (!ticket) {
            return interaction.reply({
                content: t(interaction.guild.id, 'ticketChannelOnly'),
                ephemeral: true,
            });
        }

        if (ticket.status === 'closed' || ticket.status === 'archived') {
            return interaction.reply({
                content: '❌ Bu ticket zaten kapalı!',
                ephemeral: true,
            });
        }

        const confirmEmbed = new EmbedBuilder()
            .setColor('#FEE75C')
            .setTitle(t(interaction.guild.id, 'closeConfirmTitle'))
            .setDescription(t(interaction.guild.id, 'closeConfirmDesc'))
            .addFields(
                { name: '📝 Ticket', value: `#${ticket.ticketNumber.toString().padStart(4, '0')}`, inline: true },
                { name: '⏱️ Açık Kalma Süresi', value: formatDuration(Date.now() - new Date(ticket.createdAt).getTime()), inline: true },
            )
            .setTimestamp();

        if (reason) {
            confirmEmbed.addFields({ name: '📋 Sebep', value: reason, inline: false });
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`close_confirm${reason ? ':' + reason : ''}`)
                .setLabel('Evet, Kapat')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('close_cancel')
                .setLabel('İptal')
                .setStyle(ButtonStyle.Secondary),
        );

        await interaction.reply({
            embeds: [confirmEmbed],
            components: [row],
        });
    } catch (error) {
        logger.error('Close ticket hatası:', error);
        await interaction.reply({
            content: t(interaction.guild.id, 'error'),
            ephemeral: true,
        });
    }
}

/**
 * Ticketı kapatır
 */
export async function confirmClose(interaction, reason = null) {
    await interaction.deferUpdate();

    const channel = interaction.channel;
    const guild = interaction.guild;

    try {
        const ticket = await ticketDB.get(channel.id);

        if (!ticket) {
            return interaction.followUp({
                content: '❌ Ticket bilgisi bulunamadı!',
                ephemeral: true,
            });
        }

        const guildConfig = await guildDB.getOrCreate(guild.id, guild.name);

        // Rating butonları göster
        const ratingRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('rate_1').setLabel('1').setEmoji('⭐').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('rate_2').setLabel('2').setEmoji('⭐').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('rate_3').setLabel('3').setEmoji('⭐').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('rate_4').setLabel('4').setEmoji('⭐').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('rate_5').setLabel('5').setEmoji('⭐').setStyle(ButtonStyle.Secondary),
        );

        const skipRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('rate_skip')
                .setLabel('Değerlendirme Yapma')
                .setStyle(ButtonStyle.Secondary),
        );

        const ratingEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(t(guild.id, 'ratingTitle'))
            .setDescription(t(guild.id, 'ratingDesc'))
            .setFooter({ text: '10 saniye içinde yanıt verilmezse otomatik kapatılacak' });

        await interaction.editReply({
            embeds: [ratingEmbed],
            components: [ratingRow, skipRow],
        });

        // 10 saniye bekle rating için
        const collector = channel.createMessageComponentCollector({
            filter: i => i.user.id === ticket.userId && i.customId.startsWith('rate_'),
            time: 10000,
            max: 1,
        });

        collector.on('collect', async (i) => {
            if (i.customId === 'rate_skip') {
                await i.deferUpdate();
            } else {
                const rating = parseInt(i.customId.split('_')[1]);
                await ticketDB.setRating(channel.id, rating);
                await i.deferUpdate();
            }
        });

        collector.on('end', async () => {
            await executeClose(interaction, ticket, reason);
        });

    } catch (error) {
        logger.error('Confirm close hatası:', error);
        await executeClose(interaction, await ticketDB.get(channel.id), reason);
    }
}

/**
 * Kapanış işlemini gerçekleştirir
 */
async function executeClose(interaction, ticket, reason = null) {
    const channel = interaction.channel;
    const guild = interaction.guild;

    try {
        const guildConfig = await guildDB.getOrCreate(guild.id, guild.name);

        // Transcript oluştur
        let transcriptId = null;
        try {
            transcriptId = await generateTranscript(channel, ticket, guild);
        } catch (error) {
            logger.error('Transcript hatası:', error);
        }

        // Database'de kapat
        await ticketDB.close(channel.id, interaction.user.id, reason, interaction.user.tag);

        // Kapanış mesajı
        const closeEmbed = new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle(t(guild.id, 'closeSuccess'))
            .setDescription(t(guild.id, 'closeSuccessDesc', { user: interaction.user.toString() }))
            .addFields(
                { name: '📝 Ticket', value: `#${ticket.ticketNumber.toString().padStart(4, '0')}`, inline: true },
                { name: '⏱️ Açık Kalma Süresi', value: formatDuration(Date.now() - new Date(ticket.createdAt).getTime()), inline: true },
                { name: '💬 Mesaj Sayısı', value: `${ticket.messageCount}`, inline: true },
            )
            .setTimestamp();

        if (reason) {
            closeEmbed.addFields({ name: '📋 Sebep', value: reason, inline: false });
        }

        if (transcriptId) {
            closeEmbed.addFields({ 
                name: '📄 Transcript', 
                value: `[Web'de Görüntüle](${BASE_URL}/transcript/${transcriptId})`, 
                inline: true 
            });
        }

        await channel.send({ embeds: [closeEmbed], components: [] }).catch(() => {});

        // Log kanalına transcript gönder
        if (guildConfig.logChannelId || guildConfig.transcriptChannelId) {
            const logChannelId = guildConfig.transcriptChannelId || guildConfig.logChannelId;
            try {
                const logChannel = await guild.channels.fetch(logChannelId);
                
                // Güncel ticket bilgilerini al
                const updatedTicket = await ticketDB.get(channel.id);
                const transcriptEmbed = createTranscriptEmbed(updatedTicket, transcriptId, BASE_URL);
                
                await logChannel.send({ embeds: [transcriptEmbed] });
            } catch (error) {
                logger.warn('Log kanalına transcript gönderilemedi:', error.message);
            }
        }

        // DM bildirimi
        await notifyTicketClosed(interaction.client, ticket, guild, interaction.user, reason);

        // Audit log
        await auditDB.log(guild.id, 'TICKET_CLOSE', 'TICKET', interaction.user.id, interaction.user.tag, ticket.id, {
            ticketNumber: ticket.ticketNumber,
            reason,
            transcriptId,
        });

        // 5 saniye sonra kanalı sil
        setTimeout(async () => {
            try {
                await channel.delete();
                logger.info(`Ticket kapatıldı: #${ticket.ticketNumber} by ${interaction.user.tag}`);
            } catch (error) {
                logger.error('Kanal silme hatası:', error);
            }
        }, 5000);

    } catch (error) {
        logger.error('Execute close hatası:', error);
    }
}

/**
 * Ticket sahiplenir
 */
export async function claimTicket(interaction) {
    await interaction.deferReply();

    const channel = interaction.channel;
    const member = interaction.member;

    try {
        const ticket = await ticketDB.get(channel.id);
        if (!ticket) {
            return interaction.editReply({
                content: t(interaction.guild.id, 'ticketChannelOnly'),
            });
        }

        const guildConfig = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);

        // Yetkili mi?
        if (!isStaff(member, guildConfig)) {
            return interaction.editReply({
                content: t(interaction.guild.id, 'staffOnly'),
            });
        }

        // Zaten claim edilmiş mi?
        if (ticket.status === 'claimed') {
            return interaction.editReply({
                content: t(interaction.guild.id, 'alreadyClaimed', { user: `<@${ticket.claimedBy}>` }),
            });
        }

        // Claim et
        await ticketDB.claim(channel.id, member.id, member.user.tag);

        // Kanal adını güncelle
        const ticketNumber = ticket.ticketNumber.toString().padStart(4, '0');
        await channel.setName(`claimed-${ticketNumber}-${member.user.username}`).catch(() => {});

        const embed = new EmbedBuilder()
            .setColor('#57F287')
            .setTitle(t(interaction.guild.id, 'claimSuccess'))
            .setDescription(t(interaction.guild.id, 'claimSuccessDesc', { user: member.toString() }))
            .addFields(
                { name: '📝 Ticket', value: `#${ticketNumber}`, inline: true },
                { name: '👮 Sahiplenen', value: `${member}`, inline: true },
                { name: '⏰ Zaman', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        // DM bildirimi
        await notifyTicketClaimed(interaction.client, ticket, interaction.guild, member.user);

        // Log
        await sendTicketLog(interaction.guild, guildConfig, {
            title: '✅ Ticket Sahiplenildi',
            color: '#57F287',
            fields: [
                { name: 'Ticket', value: `#${ticketNumber}`, inline: true },
                { name: 'Sahiplenen', value: `${member}`, inline: true },
            ],
        });

        logger.info(`Ticket #${ticketNumber} claimed by ${member.user.tag}`);

    } catch (error) {
        logger.error('Claim hatası:', error);
        await interaction.editReply({ content: t(interaction.guild.id, 'error') });
    }
}

/**
 * Log kanalına mesaj gönderir
 */
async function sendTicketLog(guild, guildConfig, options) {
    if (!guildConfig.logChannelId) return;

    try {
        const logChannel = await guild.channels.fetch(guildConfig.logChannelId);
        const embed = new EmbedBuilder()
            .setColor(options.color || '#5865F2')
            .setTitle(options.title)
            .addFields(options.fields)
            .setTimestamp();

        if (options.description) embed.setDescription(options.description);

        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        logger.warn('Log kanalına mesaj gönderilemedi:', error.message);
    }
}

export default {
    createTicket,
    closeTicket,
    confirmClose,
    claimTicket,
    formatDuration,
    isStaff,
};
