import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { guildDB, statsDB, ticketDB } from '../../utils/database.js';

export default {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Ticket istatistiklerini gösterir'),

    async execute(interaction) {
        await interaction.deferReply();

        const stats = await statsDB.getDetailed(interaction.guild.id);
        const guildConfig = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);

        const slaTotal = (stats?.slaMetCount || 0) + (stats?.slaBreachedCount || 0);
        const slaRate = slaTotal > 0 ? ((stats?.slaMetCount || 0) / slaTotal * 100).toFixed(1) : 'N/A';

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('📊 Ticket İstatistikleri')
            .setThumbnail(interaction.guild.iconURL())
            .addFields(
                { name: '📬 Toplam Ticket', value: `${stats?.totalTickets || 0}`, inline: true },
                { name: '🟢 Açık', value: `${stats?.openTickets || 0}`, inline: true },
                { name: '🔴 Kapalı', value: `${stats?.closedTickets || 0}`, inline: true },
                { name: '📅 Bugün', value: `${stats?.todayTickets || 0}`, inline: true },
                { name: '📆 Bu Hafta', value: `${stats?.weekTickets || 0}`, inline: true },
                { name: '🎯 SLA Oranı', value: `%${slaRate}`, inline: true },
            )
            .setFooter({ text: 'FluX Ticket • İstatistikler' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },
};
