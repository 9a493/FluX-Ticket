import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } from 'discord.js';
import logger from './logger.js';
import { guildDB, ticketDB, userDB } from './database.js';

/**
 * Ticket oluşturur
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

        // staffRoles string'den array'e çevir (SQLite için)
        const staffRoles = guildConfig.staffRoles 
            ? guildConfig.staffRoles.split(',').filter(r => r)
            : [];

        // Kullanıcının zaten açık ticketı var mı?
        const existingTicket = await ticketDB.getUserActiveTicket(guild.id, member.id);
        if (existingTicket) {
            return interaction.editReply({
                content: `❌ Zaten açık bir ticketınız var: <#${existingTicket.channelId}>`,
            });
        }

        // Kategori kontrolü
        if (!guildConfig.categoryId) {
            // Kategori yoksa oluştur
            try {
                const category = await guild.channels.create({
                    name: 'Tickets',
                    type: ChannelType.GuildCategory,
                });
                await guildDB.update(guild.id, { categoryId: category.id });
                guildConfig.categoryId = category.id;
            } catch (error) {
                logger.error('Kategori oluşturma hatası:', error);
                return interaction.editReply({
                    content: '❌ Ticket kategorisi oluşturulamadı. Lütfen sunucu yöneticisine `/setup` komutunu kullanmasını söyleyin.',
                });
            }
        }

        // Ticket kanalı oluştur
        const ticketChannel = await guild.channels.create({
            name: `ticket-${(guildConfig.ticketCount + 1).toString().padStart(4, '0')}`,
            type: ChannelType.GuildText,
            parent: guildConfig.categoryId,
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
        const ticket = await ticketDB.create(guild.id, member.id, ticketChannel.id);

        // Hoş geldin mesajı
        const welcomeEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`🎫 Ticket #${ticket.ticketNumber.toString().padStart(4, '0')}`)
            .setDescription(
                `Merhaba ${member},\n\n` +
                'Ticketınız oluşturuldu. Yetkili ekip en kısa sürede size yardımcı olacaktır.\n\n' +
                '**Lütfen beklerken:**\n' +
                '• Sorununuzu detaylı bir şekilde açıklayın\n' +
                '• Gerekirse ekran görüntüleri ekleyin\n' +
                '• Sabırlı olun, en kısa sürede dönüş yapılacaktır\n\n' +
                '**Kullanabileceğiniz komutlar:**\n' +
                '• `/close` - Ticketı kapat\n' +
                (staffRoles.length > 0 ? '• `/claim` - Ticketı sahiplen (yetkili)\n' : '') +
                '• `/add <kullanıcı>` - Kullanıcı ekle\n' +
                '• `/remove <kullanıcı>` - Kullanıcı çıkar'
            )
            .addFields(
                { name: '📝 Ticket Numarası', value: `#${ticket.ticketNumber.toString().padStart(4, '0')}`, inline: true },
                { name: '👤 Açan', value: `${member}`, inline: true },
                { name: '📅 Açılma Tarihi', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
            )
            .setThumbnail(member.user.displayAvatarURL())
            .setFooter({ text: 'Ticketı kapatmak için /close komutunu kullanın' })
            .setTimestamp();

        const closeButton = new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('Ticketı Kapat')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(closeButton);

        // Staff ping
        const staffMention = staffRoles.length > 0 
            ? staffRoles.map(r => `<@&${r}>`).join(' ')
            : '';

        await ticketChannel.send({
            content: staffMention || null,
            embeds: [welcomeEmbed],
            components: [row],
        });

        // Kullanıcıya başarı mesajı
        await interaction.editReply({
            content: `✅ Ticketınız oluşturuldu: ${ticketChannel}`,
        });

        // Log kanalına bildir
        if (guildConfig.logChannelId) {
            try {
                const logChannel = await guild.channels.fetch(guildConfig.logChannelId);
                const logEmbed = new EmbedBuilder()
                    .setColor('#57F287')
                    .setTitle('📬 Yeni Ticket Açıldı')
                    .addFields(
                        { name: 'Ticket', value: `${ticketChannel}`, inline: true },
                        { name: 'Kullanıcı', value: `${member}`, inline: true },
                        { name: 'Numara', value: `#${ticket.ticketNumber.toString().padStart(4, '0')}`, inline: true },
                    )
                    .setTimestamp();
                
                await logChannel.send({ embeds: [logEmbed] });
            } catch (error) {
                logger.warn('Log kanalına mesaj gönderilemedi:', error.message);
            }
        }

        logger.info(`Ticket oluşturuldu: #${ticket.ticketNumber} by ${member.user.tag} in ${guild.name}`);

    } catch (error) {
        logger.error('Ticket oluşturma hatası:', error);
        await interaction.editReply({
            content: '❌ Ticket oluşturulurken bir hata oluştu! Lütfen sunucu yöneticisine bildirin.',
        });
    }
}

/**
 * Ticket kapatma onayı ister
 */
export async function closeTicket(interaction) {
    const channel = interaction.channel;

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
                '• 5 saniye sonra kanal silinecek\n' +
                '• Bu işlem geri alınamaz'
            )
            .addFields(
                { name: '📝 Ticket', value: `#${ticket.ticketNumber.toString().padStart(4, '0')}`, inline: true },
                { name: '⏱️ Açık Kalma Süresi', value: formatDuration(Date.now() - ticket.createdAt.getTime()), inline: true },
            )
            .setTimestamp();

        const confirmButton = new ButtonBuilder()
            .setCustomId('close_confirm')
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
 * Ticketı kapatır
 */
export async function confirmClose(interaction) {
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

        // Database'de kapat
        await ticketDB.close(channel.id, interaction.user.id);

        // Kapanış mesajı
        const closeEmbed = new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('🔒 Ticket Kapatıldı')
            .setDescription(
                `Ticket ${interaction.user} tarafından kapatıldı.\n` +
                '5 saniye içinde bu kanal silinecek...'
            )
            .addFields(
                { name: '📝 Ticket Numarası', value: `#${ticket.ticketNumber.toString().padStart(4, '0')}`, inline: true },
                { name: '⏱️ Açık Kalma Süresi', value: formatDuration(Date.now() - ticket.createdAt.getTime()), inline: true },
                { name: '💬 Mesaj Sayısı', value: `${ticket.messageCount}`, inline: true },
            )
            .setTimestamp();

        await interaction.editReply({
            embeds: [closeEmbed],
            components: [],
        });

        // Log kanalına bildir
        const guild = interaction.guild;
        const guildConfig = await guildDB.getOrCreate(guild.id, guild.name);
        
        if (guildConfig.logChannelId) {
            try {
                const logChannel = await guild.channels.fetch(guildConfig.logChannelId);
                const logEmbed = new EmbedBuilder()
                    .setColor('#ED4245')
                    .setTitle('🔒 Ticket Kapatıldı')
                    .addFields(
                        { name: 'Ticket', value: `#${ticket.ticketNumber.toString().padStart(4, '0')}`, inline: true },
                        { name: 'Açan', value: `<@${ticket.userId}>`, inline: true },
                        { name: 'Kapatan', value: `${interaction.user}`, inline: true },
                        { name: 'Süre', value: formatDuration(Date.now() - ticket.createdAt.getTime()), inline: true },
                        { name: 'Mesajlar', value: `${ticket.messageCount}`, inline: true },
                    )
                    .setTimestamp();
                
                await logChannel.send({ embeds: [logEmbed] });
            } catch (error) {
                logger.warn('Log kanalına mesaj gönderilemedi:', error.message);
            }
        }

        // 5 saniye sonra kanalı sil
        setTimeout(async () => {
            try {
                await channel.delete();
                logger.info(`Ticket kapatıldı ve silindi: #${ticket.ticketNumber} by ${interaction.user.tag}`);
            } catch (error) {
                logger.error('Kanal silme hatası:', error);
            }
        }, 5000);

    } catch (error) {
        logger.error('Ticket kapatma hatası:', error);
        await interaction.followUp({
            content: '❌ Ticket kapatılırken bir hata oluştu!',
            ephemeral: true,
        });
    }
}

/**
 * Süreyi formatlar
 */
function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} gün ${hours % 24} saat`;
    if (hours > 0) return `${hours} saat ${minutes % 60} dakika`;
    if (minutes > 0) return `${minutes} dakika`;
    return `${seconds} saniye`;
}