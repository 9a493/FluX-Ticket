import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ticketDB, guildDB } from '../../utils/database.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('mystats')
        .setDescription('Kendi ticket istatistiklerinizi gösterir')
        .addUserOption(option =>
            option.setName('kullanıcı')
                .setDescription('Başka bir yetkili (sadece yöneticiler)')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const targetUser = interaction.options.getUser('kullanıcı') || interaction.user;
        const member = interaction.member;

        try {
            // Başka birinin istatistiğini görme yetkisi
            if (targetUser.id !== interaction.user.id && !member.permissions.has('Administrator')) {
                return interaction.editReply({
                    content: '❌ Başka birinin istatistiklerini görmek için yönetici olmalısınız!',
                });
            }

            // İstatistikleri getir
            const stats = await ticketDB.getStaffStats(interaction.guild.id, targetUser.id);

            // Rating yıldızları
            const ratingStars = stats.averageRating > 0
                ? '⭐'.repeat(Math.round(stats.averageRating)) + '☆'.repeat(5 - Math.round(stats.averageRating))
                : 'Henüz değerlendirme yok';

            // Performans seviyesi
            let performanceLevel = '🌱 Yeni Başlayan';
            let performanceColor = '#95A5A6';

            if (stats.closed >= 100) {
                performanceLevel = '🏆 Efsane';
                performanceColor = '#FFD700';
            } else if (stats.closed >= 50) {
                performanceLevel = '💎 Uzman';
                performanceColor = '#9B59B6';
            } else if (stats.closed >= 25) {
                performanceLevel = '🌟 Tecrübeli';
                performanceColor = '#3498DB';
            } else if (stats.closed >= 10) {
                performanceLevel = '⭐ Aktif';
                performanceColor = '#2ECC71';
            }

            const embed = new EmbedBuilder()
                .setColor(performanceColor)
                .setTitle(`📊 ${targetUser.id === interaction.user.id ? 'Kişisel' : targetUser.username + "'in"} İstatistikleri`)
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: '🎫 Sahiplenilen', value: `\`${stats.claimed}\``, inline: true },
                    { name: '🔒 Kapatılan', value: `\`${stats.closed}\``, inline: true },
                    { name: '⭐ Ort. Değerlendirme', value: stats.averageRating > 0 ? `${stats.averageRating.toFixed(1)}/5` : 'N/A', inline: true },
                    { name: '📈 Seviye', value: performanceLevel, inline: true },
                    { name: '🌟 Değerlendirmeler', value: ratingStars, inline: true },
                )
                .setFooter({ text: `${interaction.guild.name} Ticket Sistemi` })
                .setTimestamp();

            // Başarı rozetleri
            const badges = [];
            if (stats.closed >= 10) badges.push('🏅 10+ Ticket');
            if (stats.closed >= 50) badges.push('🎖️ 50+ Ticket');
            if (stats.closed >= 100) badges.push('🏆 100+ Ticket');
            if (stats.averageRating >= 4.5) badges.push('⭐ Yıldız Yetkili');
            if (stats.averageRating >= 4.8) badges.push('💎 Mükemmel Hizmet');

            if (badges.length > 0) {
                embed.addFields({
                    name: '🎖️ Rozetler',
                    value: badges.join(' • '),
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });

            logger.info(`Mystats görüntülendi: ${targetUser.tag} by ${interaction.user.tag}`);

        } catch (error) {
            logger.error('Mystats command hatası:', error);
            await interaction.editReply({
                content: '❌ İstatistikler yüklenirken bir hata oluştu!',
            });
        }
    },
};
