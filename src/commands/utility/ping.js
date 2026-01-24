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

        const botLatency = sent.createdTimestamp - interaction.createdTimestamp;
        const apiLatency = Math.round(interaction.client.ws.ping);

        // Gecikme durumuna göre renk
        let color = '#57F287'; // Yeşil
        let status = '🟢 Mükemmel';

        if (botLatency > 200 || apiLatency > 200) {
            color = '#FEE75C'; // Sarı
            status = '🟡 Normal';
        }
        if (botLatency > 500 || apiLatency > 500) {
            color = '#ED4245'; // Kırmızı
            status = '🔴 Yüksek';
        }

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle('🏓 Pong!')
            .addFields(
                { 
                    name: '📡 Bot Gecikmesi', 
                    value: `\`${botLatency}ms\``, 
                    inline: true 
                },
                { 
                    name: '💓 API Gecikmesi', 
                    value: `\`${apiLatency}ms\``, 
                    inline: true 
                },
                {
                    name: '📊 Durum',
                    value: status,
                    inline: true
                }
            )
            .setTimestamp()
            .setFooter({ 
                text: `İsteyen: ${interaction.user.tag}`, 
                iconURL: interaction.user.displayAvatarURL() 
            });

        // Uptime bilgisi ekle
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);

        embed.addFields({
            name: '⏱️ Uptime',
            value: `\`${days}g ${hours}s ${minutes}dk\``,
            inline: true
        });

        await interaction.editReply({ content: null, embeds: [embed] });
    },
};
