import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Botun gecikme süresini gösterir'),
    
    cooldown: 5,
    
    async execute(interaction) {
        const sent = await interaction.reply({ 
            content: '🏓 Pong! Hesaplanıyor...', 
            fetchReply: true 
        });

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🏓 Pong!')
            .addFields(
                { 
                    name: '📡 Bot Gecikmesi', 
                    value: `\`${sent.createdTimestamp - interaction.createdTimestamp}ms\``, 
                    inline: true 
                },
                { 
                    name: '💓 API Gecikmesi', 
                    value: `\`${Math.round(interaction.client.ws.ping)}ms\``, 
                    inline: true 
                }
            )
            .setTimestamp()
            .setFooter({ text: `İsteyen: ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

        await interaction.editReply({ content: null, embeds: [embed] });
    },
};