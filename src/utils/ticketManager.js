import { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder,
    ChannelType, 
    PermissionFlagsBits 
} from 'discord.js';
import { ticketDB, guildDB, categoryDB, userDB } from './database.js';
import { generateTranscript } from './transcript.js';
import { sendDM, notifyTicketCreated, notifyTicketClosed, notifyTicketClaimed } from './notifications.js';
import logger from './logger.js';

/**
 * Ticket oluşturur (kategori seçimi veya direkt)
 */
export async function createTicket(interaction, modalData = null) {
    await interaction.deferReply({ ephemeral: true });

    const { guild, user, member } = interaction;

    try {
        // Guild config
        const guildConfig = await guildDB.getOrCreate(guild.id, guild.name);

        // Blacklist kontrolü
        const isBlacklisted = await userDB.isBlacklisted(user.id);
        if (isBlacklisted) {
            return interaction.editReply({
                content: '❌ Ticket sistemi kullanma yetkiniz engellenmiş.',
            });
        }

        // Mevcut ticket kontrolü
        const existingTicket = await ticketDB.getUserActiveTicket(guild.id, user.id);
        if (existingTicket) {
            return interaction.editReply({
                content: `❌ Zaten açık bir ticketınız var: <#${existingTicket.channelId}>`,
            });
        }

        // Ticket limiti kontrolü
        const ticketCount = await ticketDB.getUserTicketCount(guild.id, user.id);
        const maxTickets = guildConfig.maxTicketsPerUser || 3;
        if (ticketCount >= maxTickets) {
            return interaction.editReply({
                content: `❌ Maksimum ticket limitine ulaştınız (${maxTickets}).`,
            });
        }

        // Kategorileri kontrol et
        const categories = await categoryDB.getAll(guild.id);

        if (categories.length > 1) {
            // Çoklu kategori - seçim menüsü göster
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('ticket_category_select')
                .setPlaceholder('Kategori seçin...')
                .addOptions(
                    categories.map(cat => ({
                        label: cat.name,
                        value: cat.id,
                        emoji: cat.emoji || '🎫',
                        description: cat.description?.substring(0, 50) || undefined,
                    }))
                );

            const row = new ActionRowBuilder().addComponents(selectMenu);

            return interaction.editReply({
                content: '📋 Lütfen ticket kategorisi seçin:',
                components: [row],
            });
        }

        // Tek kategori veya kategori yok - direkt oluştur
        const categoryId = categories.length === 1 ? categories[0].id : null;
        await createTicketChannel(interaction, guildConfig, categoryId, modalData);

    } catch (error) {
        logger.error('createTicket hatası:', error);
        await interaction.editReply({
            content: '❌ Ticket oluşturulurken bir hata oluştu!',
        });
    }
}

/**
 * Kategori seçildikten sonra ticket oluşturur
 */
export async function createTicketWithCategory(interaction, categoryId) {
    await interaction.deferUpdate();

    const { guild, user } = interaction;

    try {
        const guildConfig = await guildDB.getOrCreate(guild.id, guild.name);
        await createTicketChannel(interaction, guildConfig, categoryId, null, true);
    } catch (error) {
        logger.error('createTicketWithCategory hatası:', error);
        await interaction.editReply({
            content: '❌ Ticket oluşturulurken bir hata oluştu!',
            components: [],
        });
    }
}

/**
 * Ticket kanalı oluşturur
 */
async function createTicketChannel(interaction, guildConfig, categoryId, modalData = null, isUpdate = false) {
    const { guild, user, member } = interaction;

    // Kategori bilgisi
    let category = null;
    if (categoryId) {
        category = await categoryDB.get(categoryId);
    }

    // Ticket numarası
    const ticketNumber = (guildConfig.ticketCount + 1).toString().padStart(4, '0');

    // Kanal adı
    const channelName = category 
        ? `${category.emoji || '🎫'}-${category.name.toLowerCase()}-${ticketNumber}`
        : `ticket-${ticketNumber}`;

    // Discord kategorisi
    const discordCategoryId = category?.discordCategoryId || guildConfig.categoryId;

    // Yetkili rolleri
    const staffRoles = category?.staffRoles 
        ? category.staffRoles.split(',').filter(r => r)
        : guildConfig.staffRoles?.split(',').filter(r => r) || [];

    // Kanal oluştur
    const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: discordCategoryId,
        permissionOverwrites: [
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
        topic: `Ticket #${ticketNumber} | ${user.tag} | ${category?.name || 'Genel'}`,
    });

    // Database'e kaydet
    const ticket = await ticketDB.create(guild.id, user.id, channel.id, categoryId);
    
    // Modal verisi varsa kaydet
    if (modalData) {
        await ticketDB.update(channel.id, {
            subject: modalData.subject,
            description: modalData.description,
        });
    }

    // Karşılama mesajı
    const welcomeMessage = guildConfig.welcomeMessage 
        ? guildConfig.welcomeMessage.replace('{user}', user.toString())
        : `Merhaba ${user},\n\nTicketınız oluşturuldu. Yetkili ekip en kısa sürede size yardımcı olacaktır.\n\n**Lütfen beklerken:**\n• Sorununuzu detaylı bir şekilde açıklayın\n• Gerekirse ekran görüntüleri ekleyin\n• Sabırlı olun, en kısa sürede dönüş yapılacaktır`;

    const embed = new EmbedBuilder()
        .setColor(category?.color || '#5865F2')
        .setTitle(`🎫 Ticket #${ticketNumber}`)
        .setDescription(welcomeMessage)
        .addFields(
            { name: '👤 Açan', value: `${user}`, inline: true },
            { name: '📁 Kategori', value: `${category?.emoji || '🎫'} ${category?.name || 'Genel'}`, inline: true },
            { name: '📅 Tarih', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
        )
        .setFooter({ text: `Ticket ID: ${ticket.id}` })
        .setTimestamp();

    // Modal verisi varsa göster
    if (modalData?.subject) {
        embed.addFields({ name: '📋 Konu', value: modalData.subject, inline: false });
    }
    if (modalData?.description) {
        embed.addFields({ name: '📝 Açıklama', value: modalData.description, inline: false });
    }

    // Butonlar
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('Ticketı Kapat')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒'),
        new ButtonBuilder()
            .setCustomId('claim_ticket')
            .setLabel('Sahiplen')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('✋'),
    );

    await channel.send({
        content: `${user} | ${staffRoles.map(r => `<@&${r}>`).join(' ') || ''}`,
        embeds: [embed],
        components: [row],
    });

    // Yanıt
    const replyMethod = isUpdate ? 'editReply' : 'editReply';
    await interaction[replyMethod]({
        content: `✅ Ticketınız oluşturuldu: ${channel}`,
        components: [],
    });

    // Bildirim gönder
    await notifyTicketCreated(interaction.client, ticket, guild, member);

    logger.info(`Ticket #${ticketNumber} created by ${user.tag} in ${guild.name}`);
}

/**
 * Ticket kapatma işlemi (onay sorar)
 */
export async function closeTicket(interaction) {
    const channel = interaction.channel;
    const reason = interaction.options?.getString('sebep') || null;

    try {
        const ticket = await ticketDB.get(channel.id);
        if (!ticket) {
            return interaction.reply({
                content: '❌ Bu kanal bir ticket değil!',
                ephemeral: true,
            });
        }

        // Yetki kontrolü
        const guildConfig = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);
        const staffRoles = guildConfig.staffRoles?.split(',').filter(r => r) || [];
        const isStaff = staffRoles.some(roleId => interaction.member.roles.cache.has(roleId));
        const isOwner = ticket.userId === interaction.user.id;

        if (!isStaff && !isOwner && !interaction.member.permissions.has('Administrator')) {
            return interaction.reply({
                content: '❌ Bu komutu kullanmak için yetkili veya ticket sahibi olmalısınız!',
                ephemeral: true,
            });
        }

        // Onay mesajı
        const embed = new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('⚠️ Ticketı Kapat')
            .setDescription(
                'Bu ticketı kapatmak istediğinize emin misiniz?\n\n' +
                '**Bu işlem:**\n' +
                '• Ticket arşivlenecek\n' +
                '• Transcript oluşturulacak\n' +
                '• 10 saniye sonra kanal silinecek'
            )
            .setTimestamp();

        if (reason) {
            embed.addFields({ name: '📋 Sebep', value: reason, inline: false });
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('close_confirm')
                .setLabel('Kapat')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔒'),
            new ButtonBuilder()
                .setCustomId('close_cancel')
                .setLabel('İptal')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('❌'),
        );

        // Reason'ı geçici olarak kaydet
        if (reason) {
            await ticketDB.update(channel.id, { closeReason: reason });
        }

        await interaction.reply({
            embeds: [embed],
            components: [row],
        });

    } catch (error) {
        logger.error('closeTicket hatası:', error);
        await interaction.reply({
            content: '❌ Bir hata oluştu!',
            ephemeral: true,
        });
    }
}

/**
 * Ticket kapatmayı onaylar
 */
export async function confirmClose(interaction) {
    await interaction.deferUpdate();

    const channel = interaction.channel;

    try {
        const ticket = await ticketDB.get(channel.id);
        if (!ticket) return;

        // Transcript oluştur
        let transcriptUrl = null;
        try {
            transcriptUrl = await generateTranscript(channel, ticket);
        } catch (error) {
            logger.error('Transcript hatası:', error);
        }

        // Database'de kapat
        const closedTicket = await ticketDB.close(
            channel.id,
            interaction.user.id,
            ticket.closeReason || 'Sebep belirtilmedi',
            transcriptUrl
        );

        // Kapanış mesajı
        const ticketNumber = ticket.ticketNumber.toString().padStart(4, '0');
        
        const embed = new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('🔒 Ticket Kapatıldı')
            .setDescription(`Ticket ${interaction.user} tarafından kapatıldı.\n10 saniye içinde bu kanal silinecek...`)
            .addFields(
                { name: '📝 Ticket', value: `#${ticketNumber}`, inline: true },
                { name: '👤 Kapatan', value: `${interaction.user}`, inline: true },
                { name: '⏱️ Açık Kalma Süresi', value: formatDuration(Date.now() - new Date(ticket.createdAt).getTime()), inline: true },
            )
            .setTimestamp();

        if (ticket.closeReason) {
            embed.addFields({ name: '📋 Sebep', value: ticket.closeReason, inline: false });
        }

        if (transcriptUrl) {
            embed.addFields({ name: '📄 Transcript', value: `[Görüntüle](${transcriptUrl})`, inline: true });
        }

        await interaction.editReply({
            embeds: [embed],
            components: [],
        });

        // Rating sorusu
        const ratingEmbed = new EmbedBuilder()
            .setColor('#FEE75C')
            .setTitle('⭐ Değerlendirme')
            .setDescription('Destek deneyiminizi değerlendirin!\nBu geri bildirim, hizmet kalitemizi artırmamıza yardımcı olur.');

        const ratingRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('rating_1').setLabel('1').setStyle(ButtonStyle.Secondary).setEmoji('⭐'),
            new ButtonBuilder().setCustomId('rating_2').setLabel('2').setStyle(ButtonStyle.Secondary).setEmoji('⭐'),
            new ButtonBuilder().setCustomId('rating_3').setLabel('3').setStyle(ButtonStyle.Secondary).setEmoji('⭐'),
            new ButtonBuilder().setCustomId('rating_4').setLabel('4').setStyle(ButtonStyle.Secondary).setEmoji('⭐'),
            new ButtonBuilder().setCustomId('rating_5').setLabel('5').setStyle(ButtonStyle.Secondary).setEmoji('⭐'),
        );

        const skipRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('rating_skip')
                .setLabel('Değerlendirme Yapma')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⏭️'),
        );

        await channel.send({
            content: `<@${ticket.userId}>`,
            embeds: [ratingEmbed],
            components: [ratingRow, skipRow],
        });

        // Bildirim
        await notifyTicketClosed(interaction.client, ticket, interaction.guild, interaction.user, ticket.closeReason);

        // Log kanalına bildir
        const guildConfig = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);
        if (guildConfig.logChannelId) {
            try {
                const logChannel = await interaction.guild.channels.fetch(guildConfig.logChannelId);
                const logEmbed = new EmbedBuilder()
                    .setColor('#ED4245')
                    .setTitle('🔒 Ticket Kapatıldı')
                    .addFields(
                        { name: 'Ticket', value: `#${ticketNumber}`, inline: true },
                        { name: 'Açan', value: `<@${ticket.userId}>`, inline: true },
                        { name: 'Kapatan', value: `${interaction.user}`, inline: true },
                        { name: 'Süre', value: formatDuration(Date.now() - new Date(ticket.createdAt).getTime()), inline: true },
                        { name: 'Mesaj', value: `${ticket.messageCount}`, inline: true },
                    )
                    .setTimestamp();

                if (ticket.closeReason) {
                    logEmbed.addFields({ name: 'Sebep', value: ticket.closeReason, inline: false });
                }

                if (transcriptUrl) {
                    logEmbed.addFields({ name: 'Transcript', value: `[Görüntüle](${transcriptUrl})`, inline: true });
                }

                await logChannel.send({ embeds: [logEmbed] });
            } catch (error) {
                // Log hatası sessiz
            }
        }

        // 10 saniye sonra kanalı sil
        setTimeout(async () => {
            try {
                await channel.delete();
                logger.info(`Ticket #${ticketNumber} closed and deleted`);
            } catch (error) {
                logger.error('Kanal silme hatası:', error);
            }
        }, 10000);

    } catch (error) {
        logger.error('confirmClose hatası:', error);
    }
}

/**
 * Rating işlemi
 */
export async function handleRating(interaction, rating) {
    try {
        const ticket = await ticketDB.get(interaction.channel.id);
        if (!ticket) return;

        // Rating kaydet
        await ticketDB.update(interaction.channel.id, { rating });

        const stars = '⭐'.repeat(rating) + '☆'.repeat(5 - rating);

        await interaction.update({
            content: `✅ Teşekkürler! Değerlendirmeniz: ${stars} (${rating}/5)`,
            embeds: [],
            components: [],
        });

        logger.info(`Ticket #${ticket.ticketNumber} rated ${rating}/5`);

    } catch (error) {
        logger.error('handleRating hatası:', error);
    }
}

/**
 * Butonla ticket sahiplenme
 */
export async function claimTicketButton(interaction) {
    try {
        const ticket = await ticketDB.get(interaction.channel.id);
        if (!ticket) {
            return interaction.reply({
                content: '❌ Ticket bulunamadı!',
                ephemeral: true,
            });
        }

        // Yetkili kontrolü
        const guildConfig = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);
        const staffRoles = guildConfig.staffRoles?.split(',').filter(r => r) || [];
        const isStaff = staffRoles.some(roleId => interaction.member.roles.cache.has(roleId));

        if (!isStaff && !interaction.member.permissions.has('Administrator')) {
            return interaction.reply({
                content: '❌ Bu işlem için yetkili olmalısınız!',
                ephemeral: true,
            });
        }

        // Zaten claim edilmiş mi?
        if (ticket.status === 'claimed') {
            if (ticket.claimedBy === interaction.user.id) {
                return interaction.reply({
                    content: '❌ Bu ticketı zaten siz sahiplendiniz!',
                    ephemeral: true,
                });
            }
            return interaction.reply({
                content: `❌ Bu ticket zaten <@${ticket.claimedBy}> tarafından sahiplenilmiş!`,
                ephemeral: true,
            });
        }

        // Claim et
        await ticketDB.claim(interaction.channel.id, interaction.user.id);

        // Kanal adını güncelle
        const ticketNumber = ticket.ticketNumber.toString().padStart(4, '0');
        await interaction.channel.setName(`ticket-${ticketNumber}-${interaction.user.username}`);

        const embed = new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('✅ Ticket Sahiplenildi')
            .setDescription(`${interaction.user} bu ticketı sahiplendi ve size yardımcı olacaktır.`)
            .addFields(
                { name: '📝 Ticket', value: `#${ticketNumber}`, inline: true },
                { name: '👮 Sahiplenen', value: `${interaction.user}`, inline: true },
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        // Bildirim
        await notifyTicketClaimed(interaction.client, ticket, interaction.guild, interaction.user);

        logger.info(`Ticket #${ticketNumber} claimed by ${interaction.user.tag}`);

    } catch (error) {
        logger.error('claimTicketButton hatası:', error);
        await interaction.reply({
            content: '❌ Bir hata oluştu!',
            ephemeral: true,
        });
    }
}

/**
 * Süre formatlar
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

export default {
    createTicket,
    createTicketWithCategory,
    closeTicket,
    confirmClose,
    handleRating,
    claimTicketButton,
    formatDuration,
};
