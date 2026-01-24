import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import logger from './logger.js';
import { guildDB, ticketDB, userDB, categoryDB } from './database.js';
import { generateTranscript } from './transcript.js';

/**
 * Ticket oluşturur (Button ile)
 */
export async function createTicket(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    const member = interaction.member;

    try {
        // Kullanıcı blacklist'te mi kontrol et
        const isBlacklisted = await userDB.isBlacklisted(member.id);
        if (isBlacklisted) {
            return interaction.editReply({
                content: '❌ Ticket sistemi kullanma yetkiniz engellenmiş. Sunucu yöneticileriyle iletişime geçin.',
            });
        }

        // Guild ayarlarını getir
        const guildConfig = await guildDB.getOrCreate(guild.id, guild.name);

        // Kullanıcının zaten açık ticketı var mı?
        const existingTicket = await ticketDB.getUserActiveTicket(guild.id, member.id);
        if (existingTicket) {
            return interaction.editReply({
                content: `❌ Zaten açık bir ticketınız var: <#${existingTicket.channelId}>`,
            });
        }

        // Ticket limiti kontrolü
        const userTicketCount = await ticketDB.getUserTicketCount(guild.id, member.id);
        const maxTickets = guildConfig.maxTicketsPerUser || 3;
        if (userTicketCount >= maxTickets) {
            return interaction.editReply({
                content: `❌ Maksimum ticket limitine ulaştınız (${maxTickets}). Lütfen mevcut ticketlarınızı kapatın.`,
            });
        }

        // Kategorileri kontrol et
        const categories = await categoryDB.getAll(guild.id);
        
        if (categories.length > 0) {
            // Çoklu kategori varsa select menu göster
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('ticket_category_select')
                .setPlaceholder('Bir kategori seçin...')
                .addOptions(categories.map(cat => ({
                    label: cat.name,
                    value: cat.id,
                    description: cat.description || `${cat.name} için ticket aç`,
                    emoji: cat.emoji || '🎫',
                })));

            const row = new ActionRowBuilder().addComponents(selectMenu);

            return interaction.editReply({
                content: '📋 Lütfen ticket kategorisi seçin:',
                components: [row],
            });
        }

        // Kategori yoksa direkt ticket aç
        await createTicketChannel(interaction, guild, member, guildConfig, null);

    } catch (error) {
        logger.error('Ticket oluşturma hatası:', error);
        await interaction.editReply({
            content: '❌ Ticket oluşturulurken bir hata oluştu! Lütfen sunucu yöneticisine bildirin.',
        });
    }
}

/**
 * Kategori seçildikten sonra ticket kanalı oluşturur
 */
export async function createTicketWithCategory(interaction, categoryId) {
    await interaction.deferUpdate();

    const guild = interaction.guild;
    const member = interaction.member;

    try {
        const guildConfig = await guildDB.getOrCreate(guild.id, guild.name);
        const category = categoryId ? await prisma.category.findUnique({ where: { id: categoryId } }) : null;

        await createTicketChannel(interaction, guild, member, guildConfig, category);
    } catch (error) {
        logger.error('Kategori ile ticket oluşturma hatası:', error);
        await interaction.editReply({
            content: '❌ Ticket oluşturulurken bir hata oluştu!',
        });
    }
}

/**
 * Ticket kanalı oluşturur (ortak fonksiyon)
 */
async function createTicketChannel(interaction, guild, member, guildConfig, category) {
    // staffRoles string'den array'e çevir (SQLite için)
    const staffRoles = guildConfig.staffRoles 
        ? guildConfig.staffRoles.split(',').filter(r => r)
        : [];

    // Kategori varsa ona özel staff roles kullan
    const categoryStaffRoles = category?.staffRoles 
        ? category.staffRoles.split(',').filter(r => r)
        : staffRoles;

    // Kategori kontrolü
    let ticketCategoryId = category?.discordCategoryId || guildConfig.categoryId;
    
    if (!ticketCategoryId) {
        try {
            const newCategory = await guild.channels.create({
                name: 'Tickets',
                type: ChannelType.GuildCategory,
            });
            await guildDB.update(guild.id, { categoryId: newCategory.id });
            ticketCategoryId = newCategory.id;
        } catch (error) {
            logger.error('Kategori oluşturma hatası:', error);
            return interaction.editReply({
                content: '❌ Ticket kategorisi oluşturulamadı. Lütfen sunucu yöneticisine `/setup` komutunu kullanmasını söyleyin.',
            });
        }
    }

    // Ticket numarasını al
    const ticketNumber = guildConfig.ticketCount + 1;
    const ticketName = category 
        ? `${category.emoji || '🎫'}-${category.name.toLowerCase()}-${ticketNumber.toString().padStart(4, '0')}`
        : `ticket-${ticketNumber.toString().padStart(4, '0')}`;

    // Ticket kanalı oluştur
    const ticketChannel = await guild.channels.create({
        name: ticketName,
        type: ChannelType.GuildText,
        parent: ticketCategoryId,
        topic: `Ticket #${ticketNumber} | Açan: ${member.user.tag} | Durum: Açık`,
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
            ...categoryStaffRoles.map(roleId => ({
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
    const ticket = await ticketDB.create(guild.id, member.id, ticketChannel.id, category?.id);

    // Hoş geldin mesajı
    const welcomeEmbed = new EmbedBuilder()
        .setColor(category?.color || '#5865F2')
        .setTitle(`🎫 Ticket #${ticket.ticketNumber.toString().padStart(4, '0')}`)
        .setDescription(
            `Merhaba ${member},\n\n` +
            'Ticketınız oluşturuldu. Yetkili ekip en kısa sürede size yardımcı olacaktır.\n\n' +
            '**Lütfen beklerken:**\n' +
            '• Sorununuzu detaylı bir şekilde açıklayın\n' +
            '• Gerekirse ekran görüntüleri ekleyin\n' +
            '• Sabırlı olun, en kısa sürede dönüş yapılacaktır'
        )
        .addFields(
            { name: '📝 Ticket Numarası', value: `#${ticket.ticketNumber.toString().padStart(4, '0')}`, inline: true },
            { name: '👤 Açan', value: `${member}`, inline: true },
            { name: '📅 Açılma Tarihi', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
        )
        .setThumbnail(member.user.displayAvatarURL())
        .setFooter({ text: 'Destek ekibimiz en kısa sürede size yardımcı olacaktır' })
        .setTimestamp();

    if (category) {
        welcomeEmbed.addFields({ name: '📁 Kategori', value: `${category.emoji || '🎫'} ${category.name}`, inline: true });
    }

    // Butonlar
    const closeButton = new ButtonBuilder()
        .setCustomId('close_ticket')
        .setLabel('Ticketı Kapat')
        .setEmoji('🔒')
        .setStyle(ButtonStyle.Danger);

    const claimButton = new ButtonBuilder()
        .setCustomId('claim_ticket')
        .setLabel('Sahiplen')
        .setEmoji('✋')
        .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(claimButton, closeButton);

    // Staff ping
    const staffMention = categoryStaffRoles.length > 0 
        ? categoryStaffRoles.map(r => `<@&${r}>`).join(' ')
        : '';

    await ticketChannel.send({
        content: staffMention || null,
        embeds: [welcomeEmbed],
        components: [row],
    });

    // Kullanıcıya başarı mesajı
    await interaction.editReply({
        content: `✅ Ticketınız oluşturuldu: ${ticketChannel}`,
        components: [],
    });

    // Log kanalına bildir
    await sendLog(guild, guildConfig, {
        color: '#57F287',
        title: '📬 Yeni Ticket Açıldı',
        fields: [
            { name: 'Ticket', value: `${ticketChannel}`, inline: true },
            { name: 'Kullanıcı', value: `${member}`, inline: true },
            { name: 'Numara', value: `#${ticket.ticketNumber.toString().padStart(4, '0')}`, inline: true },
        ],
    });

    logger.info(`Ticket oluşturuldu: #${ticket.ticketNumber} by ${member.user.tag} in ${guild.name}`);
}

/**
 * Ticket kapatma onayı ister
 */
export async function closeTicket(interaction) {
    const channel = interaction.channel;
    const reason = interaction.options?.getString('sebep') || null;

    try {
        const ticket = await ticketDB.get(channel.id);

        if (!ticket) {
            return interaction.reply({
                content: '❌ Bu bir ticket kanalı değil!',
                ephemeral: true,
            });
        }

        const confirmEmbed = new EmbedBuilder()
            .setColor('#FEE75C')
            .setTitle('⚠️ Ticketı Kapat')
            .setDescription(
                'Bu ticketı kapatmak istediğinize emin misiniz?\n\n' +
                '**Bu işlem:**\n' +
                '• Ticket arşivlenecek\n' +
                '• Transcript oluşturulacak\n' +
                '• 10 saniye sonra kanal silinecek'
            )
            .addFields(
                { name: '📝 Ticket', value: `#${ticket.ticketNumber.toString().padStart(4, '0')}`, inline: true },
                { name: '⏱️ Açık Kalma Süresi', value: formatDuration(Date.now() - new Date(ticket.createdAt).getTime()), inline: true },
            )
            .setTimestamp();

        if (reason) {
            confirmEmbed.addFields({ name: '📋 Kapatma Sebebi', value: reason, inline: false });
        }

        const confirmButton = new ButtonBuilder()
            .setCustomId(`close_confirm:${reason || ''}`)
            .setLabel('Evet, Kapat')
            .setStyle(ButtonStyle.Danger);

        const cancelButton = new ButtonBuilder()
            .setCustomId('close_cancel')
            .setLabel('İptal')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

        await interaction.reply({
            embeds: [confirmEmbed],
            components: [row],
        });
    } catch (error) {
        logger.error('Close ticket hatası:', error);
        await interaction.reply({
            content: '❌ Bir hata oluştu!',
            ephemeral: true,
        });
    }
}

/**
 * Ticketı kapatır ve rating ister
 */
export async function confirmClose(interaction, closeReason = null) {
    await interaction.deferUpdate();

    const channel = interaction.channel;

    try {
        const ticket = await ticketDB.get(channel.id);

        if (!ticket) {
            return interaction.followUp({
                content: '❌ Ticket bilgisi bulunamadı!',
                ephemeral: true,
            });
        }

        // Transcript oluştur
        let transcriptUrl = null;
        try {
            transcriptUrl = await generateTranscript(channel, ticket);
        } catch (error) {
            logger.error('Transcript oluşturma hatası:', error);
        }

        // Database'de kapat
        await ticketDB.close(channel.id, interaction.user.id, closeReason, transcriptUrl);

        // Rating butonları
        const ratingEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('⭐ Değerlendirme')
            .setDescription(
                'Destek deneyiminizi değerlendirin!\n' +
                'Bu geri bildirim, hizmet kalitemizi artırmamıza yardımcı olur.'
            )
            .setTimestamp();

        const ratingButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('rating_1').setEmoji('1️⃣').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('rating_2').setEmoji('2️⃣').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('rating_3').setEmoji('3️⃣').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('rating_4').setEmoji('4️⃣').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('rating_5').setEmoji('5️⃣').setStyle(ButtonStyle.Primary),
        );

        const skipButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('rating_skip')
                .setLabel('Değerlendirme Yapma')
                .setStyle(ButtonStyle.Secondary),
        );

        // Kapanış mesajı
        const closeEmbed = new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('🔒 Ticket Kapatıldı')
            .setDescription(
                `Ticket ${interaction.user} tarafından kapatıldı.\n` +
                '10 saniye içinde bu kanal silinecek...'
            )
            .addFields(
                { name: '📝 Ticket Numarası', value: `#${ticket.ticketNumber.toString().padStart(4, '0')}`, inline: true },
                { name: '⏱️ Açık Kalma Süresi', value: formatDuration(Date.now() - new Date(ticket.createdAt).getTime()), inline: true },
                { name: '💬 Mesaj Sayısı', value: `${ticket.messageCount}`, inline: true },
            )
            .setTimestamp();

        if (closeReason) {
            closeEmbed.addFields({ name: '📋 Kapatma Sebebi', value: closeReason, inline: false });
        }

        if (transcriptUrl) {
            closeEmbed.addFields({ name: '📄 Transcript', value: `[Görüntüle](${transcriptUrl})`, inline: true });
        }

        await interaction.editReply({
            embeds: [closeEmbed],
            components: [],
        });

        // Rating mesajı gönder (sadece ticket sahibine)
        if (ticket.userId !== interaction.user.id) {
            await channel.send({
                content: `<@${ticket.userId}>`,
                embeds: [ratingEmbed],
                components: [ratingButtons, skipButton],
            });
        }

        // Log kanalına bildir
        const guild = interaction.guild;
        const guildConfig = await guildDB.getOrCreate(guild.id, guild.name);
        
        await sendLog(guild, guildConfig, {
            color: '#ED4245',
            title: '🔒 Ticket Kapatıldı',
            fields: [
                { name: 'Ticket', value: `#${ticket.ticketNumber.toString().padStart(4, '0')}`, inline: true },
                { name: 'Açan', value: `<@${ticket.userId}>`, inline: true },
                { name: 'Kapatan', value: `${interaction.user}`, inline: true },
                { name: 'Süre', value: formatDuration(Date.now() - new Date(ticket.createdAt).getTime()), inline: true },
                { name: 'Mesajlar', value: `${ticket.messageCount}`, inline: true },
                ...(closeReason ? [{ name: 'Sebep', value: closeReason, inline: false }] : []),
                ...(transcriptUrl ? [{ name: 'Transcript', value: `[Görüntüle](${transcriptUrl})`, inline: true }] : []),
            ],
        });

        // 10 saniye sonra kanalı sil
        setTimeout(async () => {
            try {
                await channel.delete();
                logger.info(`Ticket kapatıldı ve silindi: #${ticket.ticketNumber} by ${interaction.user.tag}`);
            } catch (error) {
                logger.error('Kanal silme hatası:', error);
            }
        }, 10000);

    } catch (error) {
        logger.error('Ticket kapatma hatası:', error);
        await interaction.followUp({
            content: '❌ Ticket kapatılırken bir hata oluştu!',
            ephemeral: true,
        });
    }
}

/**
 * Rating işlemi
 */
export async function handleRating(interaction, rating) {
    try {
        const ticket = await ticketDB.get(interaction.channel.id);
        
        if (ticket) {
            await ticketDB.update(interaction.channel.id, { rating: parseInt(rating) });
        }

        const stars = '⭐'.repeat(parseInt(rating)) + '☆'.repeat(5 - parseInt(rating));
        
        await interaction.update({
            embeds: [
                new EmbedBuilder()
                    .setColor('#57F287')
                    .setTitle('✅ Teşekkürler!')
                    .setDescription(`Değerlendirmeniz: ${stars}\n\nGeri bildiriminiz için teşekkür ederiz!`)
                    .setTimestamp()
            ],
            components: [],
        });

        logger.info(`Ticket #${ticket?.ticketNumber} rated ${rating}/5`);
    } catch (error) {
        logger.error('Rating hatası:', error);
    }
}

/**
 * Claim işlemi (button ile)
 */
export async function claimTicketButton(interaction) {
    const channel = interaction.channel;
    const member = interaction.member;

    try {
        const ticket = await ticketDB.get(channel.id);
        if (!ticket) {
            return interaction.reply({
                content: '❌ Bu bir ticket kanalı değil!',
                ephemeral: true,
            });
        }

        const guildConfig = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);
        const staffRoles = guildConfig.staffRoles 
            ? guildConfig.staffRoles.split(',').filter(r => r)
            : [];

        const isStaff = staffRoles.some(roleId => member.roles.cache.has(roleId));
        if (!isStaff && !member.permissions.has('Administrator')) {
            return interaction.reply({
                content: '❌ Bu komutu kullanmak için yetkili olmalısınız!',
                ephemeral: true,
            });
        }

        if (ticket.status === 'claimed') {
            return interaction.reply({
                content: `❌ Bu ticket zaten <@${ticket.claimedBy}> tarafından sahiplenilmiş!`,
                ephemeral: true,
            });
        }

        await ticketDB.claim(channel.id, member.id);
        await channel.setName(`${channel.name}-${member.user.username}`);

        const embed = new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('✅ Ticket Sahiplenildi')
            .setDescription(`${member} bu ticketı sahiplendi ve size yardımcı olacaktır.`)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        logger.info(`Ticket #${ticket.ticketNumber} claimed by ${member.user.tag} (button)`);
    } catch (error) {
        logger.error('Claim button hatası:', error);
        await interaction.reply({
            content: '❌ Bir hata oluştu!',
            ephemeral: true,
        });
    }
}

/**
 * Log kanalına mesaj gönderir
 */
async function sendLog(guild, guildConfig, { color, title, fields }) {
    if (!guildConfig.logChannelId) return;

    try {
        const logChannel = await guild.channels.fetch(guildConfig.logChannelId);
        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(title)
            .addFields(fields)
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        logger.warn('Log kanalına mesaj gönderilemedi:', error.message);
    }
}

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
