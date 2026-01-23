import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } from 'discord.js';
import logger from './logger.js';

// Geçici veri saklama (database eklenince burası kalkacak)
const ticketData = new Map();
const guildConfigs = new Map();

/**
 * Ticket oluşturur
 */
export async function createTicket(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    const member = interaction.member;

    // Geçici config kontrolü (database eklenince oradan çekilecek)
    let config = guildConfigs.get(guild.id);
    
    // Eğer setup yapılmamışsa varsayılan değerler
    if (!config) {
        // Tickets kategorisi ara
        let category = guild.channels.cache.find(
            c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === 'tickets'
        );

        // Kategori yoksa oluştur
        if (!category) {
            try {
                category = await guild.channels.create({
                    name: 'Tickets',
                    type: ChannelType.GuildCategory,
                });
            } catch (error) {
                logger.error('Kategori oluşturma hatası:', error);
                return interaction.editReply({
                    content: '❌ Ticket kategorisi oluşturulamadı. Lütfen sunucu yöneticisine `/setup` komutunu kullanmasını söyleyin.',
                });
            }
        }

        config = {
            categoryId: category.id,
            staffRoleId: null, // Setup ile ayarlanacak
        };
    }

    // Kullanıcının zaten açık ticketı var mı kontrol et
    const existingTicket = guild.channels.cache.find(
        c => c.name === `ticket-${member.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}-${member.id}`
    );

    if (existingTicket) {
        return interaction.editReply({
            content: `❌ Zaten açık bir ticketınız var: ${existingTicket}`,
        });
    }

    try {
        // Ticket numarası oluştur
        const ticketNumber = (ticketData.size + 1).toString().padStart(4, '0');
        
        // Ticket kanalı oluştur
        const ticketChannel = await guild.channels.create({
            name: `ticket-${ticketNumber}`,
            type: ChannelType.GuildText,
            parent: config.categoryId,
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
                    ],
                },
                ...(config.staffRoleId ? [{
                    id: config.staffRoleId,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.ManageMessages,
                    ],
                }] : []),
            ],
        });

        // Ticket bilgisini kaydet
        ticketData.set(ticketChannel.id, {
            ticketNumber,
            userId: member.id,
            guildId: guild.id,
            createdAt: Date.now(),
            status: 'open',
        });

        // Hoş geldin mesajı
        const welcomeEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`🎫 Ticket #${ticketNumber}`)
            .setDescription(
                `Merhaba ${member},\n\n` +
                'Ticketınız oluşturuldu. Yetkili ekip en kısa sürede size yardımcı olacaktır.\n\n' +
                '**Lütfen beklerken:**\n' +
                '• Sorununuzu detaylı bir şekilde açıklayın\n' +
                '• Gerekirse ekran görüntüleri ekleyin\n' +
                '• Sabırlı olun, en kısa sürede dönüş yapılacaktır'
            )
            .addFields(
                { name: '📝 Ticket Numarası', value: `#${ticketNumber}`, inline: true },
                { name: '👤 Açan', value: `${member}`, inline: true },
                { name: '📅 Açılma Tarihi', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
            )
            .setThumbnail(member.user.displayAvatarURL())
            .setFooter({ text: 'Ticketı kapatmak için aşağıdaki butona tıklayın' })
            .setTimestamp();

        const closeButton = new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('Ticketı Kapat')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(closeButton);

        await ticketChannel.send({
            content: config.staffRoleId ? `<@&${config.staffRoleId}>` : '',
            embeds: [welcomeEmbed],
            components: [row],
        });

        // Kullanıcıya başarı mesajı
        await interaction.editReply({
            content: `✅ Ticketınız oluşturuldu: ${ticketChannel}`,
        });

        logger.info(`Ticket oluşturuldu: #${ticketNumber} by ${member.user.tag} in ${guild.name}`);

    } catch (error) {
        logger.error('Ticket oluşturma hatası:', error);
        await interaction.editReply({
            content: '❌ Ticket oluşturulurken bir hata oluştu! Botun gerekli izinlere sahip olduğundan emin olun.',
        });
    }
}

/**
 * Ticket kapatma onayı ister
 */
export async function closeTicket(interaction) {
    const channel = interaction.channel;
    const ticketInfo = ticketData.get(channel.id);

    if (!ticketInfo) {
        return interaction.reply({
            content: '❌ Bu bir ticket kanalı değil!',
            ephemeral: true,
        });
    }

    const confirmEmbed = new EmbedBuilder()
        .setColor('#FEE75C')
        .setTitle('⚠️ Ticketı Kapat')
        .setDescription('Bu ticketı kapatmak istediğinize emin misiniz?\nBu işlem geri alınamaz.')
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
}

/**
 * Ticketı kapatır
 */
export async function confirmClose(interaction) {
    await interaction.deferUpdate();

    const channel = interaction.channel;
    const ticketInfo = ticketData.get(channel.id);

    if (!ticketInfo) {
        return interaction.followUp({
            content: '❌ Ticket bilgisi bulunamadı!',
            ephemeral: true,
        });
    }

    try {
        // Kapanış mesajı
        const closeEmbed = new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('🔒 Ticket Kapatılıyor')
            .setDescription(
                `Ticket ${interaction.user} tarafından kapatıldı.\n` +
                '5 saniye içinde bu kanal silinecek...'
            )
            .addFields(
                { name: '📝 Ticket Numarası', value: `#${ticketInfo.ticketNumber}`, inline: true },
                { name: '⏱️ Açık Kalma Süresi', value: formatDuration(Date.now() - ticketInfo.createdAt), inline: true },
            )
            .setTimestamp();

        await interaction.editReply({
            embeds: [closeEmbed],
            components: [],
        });

        // Ticket bilgisini sil
        ticketData.delete(channel.id);

        // 5 saniye sonra kanalı sil
        setTimeout(async () => {
            try {
                await channel.delete();
                logger.info(`Ticket kapatıldı: #${ticketInfo.ticketNumber} by ${interaction.user.tag}`);
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

/**
 * Config kaydetme fonksiyonu (dışarıdan çağrılabilir)
 */
export function saveGuildConfig(guildId, config) {
    guildConfigs.set(guildId, config);
    logger.info(`Guild config saved for ${guildId}`);
}