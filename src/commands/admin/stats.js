import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { statsDB } from '../../utils/database.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Ticket istatistiklerini görüntüle')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        await interaction.deferReply();
        try {
            const stats = await statsDB.getDetailed(interaction.guild.id);
            if (!stats) return interaction.editReply({ content: '📊 Henüz istatistik yok.' });

            const avg = stats.averageRating || 0;
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('📊 Ticket İstatistikleri')
                .addFields(
                    { name: '📬 Toplam', value: `${stats.totalTickets || 0}`, inline: true },
                    { name: '🟢 Açık', value: `${stats.openTickets || 0}`, inline: true },
                    { name: '🔴 Kapalı', value: `${stats.closedTickets || 0}`, inline: true },
                    { name: '📅 Bugün', value: `${stats.todayTickets || 0}`, inline: true },
                    { name: '📆 Hafta', value: `${stats.weekTickets || 0}`, inline: true },
                    { name: '⭐ Puan', value: `${'⭐'.repeat(Math.floor(avg))}☆ (${avg.toFixed(1)}/5)`, inline: true },
                )
                .setTimestamp();

            if (stats.topStaff?.length) {
                const medals = ['🥇', '🥈', '🥉'];
                embed.addFields({ name: '👑 Top Staff', value: stats.topStaff.slice(0, 3).map((s, i) => `${medals[i]} <@${s.claimedBy}> - ${s._count.id}`).join('\n') });
            }
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            logger.error('Stats error:', error);
            await interaction.editReply({ content: '❌ Hata!' });
        }
    },
};
