import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { ticketDB, guildDB } from '../../utils/database.js';
import { generateTranscript } from '../../utils/transcript.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('archive')
        .setDescription('Ticket\'ı silmeden arşivler (salt okunur)')
        .addStringOption(option =>
            option.setName('sebep')
                .setDescription('Arşivleme sebebi')
                .setRequired(false)
                .setMaxLength(200)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const channel = interaction.channel;
        const member = interaction.member;
        const reason = interaction.options.getString('sebep');

        try {
            // Bu bir ticket kanalı mı?
            const ticket = await ticketDB.get(channel.id);
            if (!ticket) {
                return interaction.editReply({
                    content: '❌ Bu komut sadece ticket kanallarında kullanılabilir!',
                });
            }

            // Zaten arşivlenmiş mi?
            if (ticket.status === 'archived') {
                return interaction.editReply({
                    content: '❌ Bu ticket zaten arşivlenmiş!',
                });
            }

            // Yetkili kontrolü
            const guildConfig = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);
            const staffRoles = guildConfig.staffRoles 
                ? guildConfig.staffRoles.split(',').filter(r => r)
                : [];
            
            const isStaff = staffRoles.some(roleId => member.roles.cache.has(roleId));
            if (!isStaff && !member.permissions.has('Administrator')) {
                return interaction.editReply({
                    content: '❌ Bu komutu kullanmak için yetkili olmalısınız!',
                });
            }

            // Transcript oluştur
            let transcriptUrl = null;
            try {
                transcriptUrl = await generateTranscript(channel, ticket);
            } catch (error) {
                logger.error('Transcript oluşturma hatası (archive):', error);
            }

            // Database'de arşivle
            await ticketDB.update(channel.id, {
                status: 'archived',
                closedBy: interaction.user.id,
                closeReason: reason || 'Arşivlendi',
                closedAt: new Date(),
                transcriptUrl,
            });

            // Kanal izinlerini güncelle (salt okunur)
            try {
                // Herkesten mesaj gönderme iznini kaldır
                await channel.permissionOverwrites.edit(interaction.guild.id, {
                    SendMessages: false,
                });

                // Ticket sahibinden mesaj iznini kaldır
                await channel.permissionOverwrites.edit(ticket.userId, {
                    SendMessages: false,
                    ViewChannel: true,
                });

                // Staff'tan mesaj iznini kaldır
                for (const roleId of staffRoles) {
                    try {
                        await channel.permissionOverwrites.edit(roleId, {
                            SendMessages: false,
                            ViewChannel: true,
                        });
                    } catch (error) {
                        // Rol bulunamazsa devam et
                    }
                }

                // Kanal adını güncelle
                const ticketNumber = ticket.ticketNumber.toString().padStart(4, '0');
                await channel.setName(`📦-archived-${ticketNumber}`);

                // Topic güncelle
                await channel.setTopic(`🔒 Arşivlenmiş Ticket #${ticketNumber} | Salt Okunur`);
            } catch (error) {
                logger.warn('Kanal izinleri güncellenirken hata:', error.message);
            }

            // Bilgilendirme mesajı
            const embed = new EmbedBuilder()
                .setColor('#9B59B6')
                .setTitle('📦 Ticket Arşivlendi')
                .setDescription(
                    'Bu ticket arşivlendi ve salt okunur modda.\n\n' +
                    '**Ne yapabilirsiniz?**\n' +
                    '• Mesajları okuyabilirsiniz\n' +
                    '• Yeni mesaj gönderemezsiniz\n' +
                    '• `/reopen` ile yeniden açabilirsiniz\n' +
                    '• `/close` ile tamamen kapatabilirsiniz'
                )
                .addFields(
                    { name: '📝 Ticket', value: `#${ticket.ticketNumber.toString().padStart(4, '0')}`, inline: true },
                    { name: '👤 Arşivleyen', value: `${interaction.user}`, inline: true },
                    { name: '⏱️ Açık Kalma Süresi', value: formatDuration(Date.now() - new Date(ticket.createdAt).getTime()), inline: true },
                )
                .setTimestamp();

            if (reason) {
                embed.addFields({ name: '📋 Sebep', value: reason, inline: false });
            }

            if (transcriptUrl) {
                embed.addFields({ name: '📄 Transcript', value: `[Görüntüle](${transcriptUrl})`, inline: true });
            }

            await interaction.editReply({ embeds: [embed] });

            // Log
            if (guildConfig.logChannelId) {
                try {
                    const logChannel = await interaction.guild.channels.fetch(guildConfig.logChannelId);
                    const logEmbed = new EmbedBuilder()
                        .setColor('#9B59B6')
                        .setTitle('📦 Ticket Arşivlendi')
                        .addFields(
                            { name: 'Ticket', value: `#${ticket.ticketNumber.toString().padStart(4, '0')}`, inline: true },
                            { name: 'Arşivleyen', value: `${interaction.user}`, inline: true },
                            { name: 'Ticket Sahibi', value: `<@${ticket.userId}>`, inline: true },
                        )
                        .setTimestamp();

                    if (reason) {
                        logEmbed.addFields({ name: 'Sebep', value: reason, inline: false });
                    }
                    
                    await logChannel.send({ embeds: [logEmbed] });
                } catch (error) {
                    // Log hatası sessiz
                }
            }

            logger.info(`Ticket #${ticket.ticketNumber} archived by ${interaction.user.tag}`);

        } catch (error) {
            logger.error('Archive command hatası:', error);
            await interaction.editReply({
                content: '❌ Ticket arşivlenirken bir hata oluştu!',
            });
        }
    },
};

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
