import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ticketDB, reminderDB, guildDB } from '../../utils/database.js';

export default {
    data: new SlashCommandBuilder()
        .setName('remind')
        .setDescription('Ticket için hatırlatıcı kur')
        .addIntegerOption(o => o.setName('süre').setDescription('Dakika cinsinden süre').setRequired(true).setMinValue(1).setMaxValue(10080))
        .addStringOption(o => o.setName('mesaj').setDescription('Hatırlatma mesajı')),

    async execute(interaction) {
        const ticket = await ticketDB.get(interaction.channel.id);
        if (!ticket) return interaction.reply({ content: '❌ Bu komut sadece ticket kanallarında!', ephemeral: true });
        
        const minutes = interaction.options.getInteger('süre');
        const message = interaction.options.getString('mesaj') || 'Ticket hatırlatması';
        
        const remindAt = new Date(Date.now() + minutes * 60 * 1000);
        
        await reminderDB.create(
            interaction.guild.id,
            ticket.id,
            interaction.channel.id,
            interaction.user.id,
            message,
            remindAt
        );
        
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('⏰ Hatırlatıcı Kuruldu')
            .setDescription(`**${message}**`)
            .addFields({ name: '⏱️ Zaman', value: `<t:${Math.floor(remindAt.getTime() / 1000)}:R>`, inline: true })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
