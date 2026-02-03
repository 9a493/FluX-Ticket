import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Bot gecikmesini gösterir'),
    cooldown: 5,

    async execute(interaction) {
        const sent = await interaction.reply({ content: '🏓 Ping ölçülüyor...', fetchReply: true });
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        const apiLatency = Math.round(interaction.client.ws.ping);

        const embed = new EmbedBuilder()
            .setColor(latency < 200 ? '#57F287' : latency < 500 ? '#FEE75C' : '#ED4245')
            .setTitle('🏓 Pong!')
            .addFields(
                { name: '📡 Bot Gecikmesi', value: `\`${latency}ms\``, inline: true },
                { name: '🌐 API Gecikmesi', value: `\`${apiLatency}ms\``, inline: true },
            )
            .setTimestamp();

        await interaction.editReply({ content: null, embeds: [embed] });
    },
};
