import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { statsDB, guildDB } from '../../utils/database.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Sunucu ticket istatistiklerini gösterir')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const stats = await statsDB.getDetailed(interaction.guild.id);

            if (!stats) {
                return interaction.editReply({
                    content: '❌ İstatistik bulunamadı! Önce `/setup` komutunu kullanın.',
                });
            }

            // Rating yıldızları
            const ratingStars = stats.averageRating 
                ? '⭐'.repeat(Math.round(stats.averageRating)) + '☆'.repeat(5 - Math.round(stats.averageRating))
                : 'Henüz değerlendirme yok';

            // Ana embed
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('📊 Ticket İstatistikleri')
                .setThumbnail(interaction.guild.iconURL())
                .addFields(
                    { name: '📬 Toplam Ticket', value: `\`${stats.totalTickets || 0}\``, inline: true },
                    { name: '🟢 Açık', value: `\`${stats.openTickets || 0}\``, inline: true },
                    { name: '🔴 Kapalı', value: `\`${stats.closedTickets || 0}\``, inline: true },
                    { name: '📅 Bugün', value: `\`${stats.todayTickets || 0}\``, inline: true },
                    { name: '📆 Bu Hafta', value: `\`${stats.weekTickets || 0}\``, inline: true },
                    { name: '⭐ Ort. Değerlendirme', value: stats.averageRating ? `${stats.averageRating.toFixed(1)}/5 ${ratingStars}` : 'N/A', inline: true },
                )
                .setFooter({ text: `${interaction.guild.name} • Son güncelleme` })
                .setTimestamp();

            // En aktif yetkililer
            if (stats.topStaff && stats.topStaff.length > 0) {
                const topStaffList = await Promise.all(stats.topStaff.map(async (s, i) => {
                    if (!s.claimedBy) return null;
                    try {
                        const member = await interaction.guild.members.fetch(s.claimedBy);
                        const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
                        return `${medals[i]} ${member.displayName}: **${s._count.id}** ticket`;
                    } catch {
                        return null;
                    }
                }));

                const filteredList = topStaffList.filter(s => s !== null);
                if (filteredList.length > 0) {
                    embed.addFields({
                        name: '🏆 En Aktif Yetkililer',
                        value: filteredList.join('\n'),
                        inline: false
                    });
                }
            }

            // Grafik benzeri görselleştirme
            const total = (stats.openTickets || 0) + (stats.closedTickets || 0);
            if (total > 0) {
                const openPercent = Math.round(((stats.openTickets || 0) / total) * 100);
                const closedPercent = 100 - openPercent;

                const openBar = '🟢'.repeat(Math.round(openPercent / 10));
                const closedBar = '🔴'.repeat(Math.round(closedPercent / 10));

                embed.addFields({
                    name: '📈 Durum Dağılımı',
                    value: `Açık: ${openBar} ${openPercent}%\nKapalı: ${closedBar} ${closedPercent}%`,
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });

            logger.info(`Stats görüntülendi by ${interaction.user.tag}`);

        } catch (error) {
            logger.error('Stats command hatası:', error);
            await interaction.editReply({
                content: '❌ İstatistikler yüklenirken bir hata oluştu!',
            });
        }
    },
};
