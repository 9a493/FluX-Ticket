import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ticketDB } from '../../utils/database.js';

export default {
    data: new SlashCommandBuilder()
        .setName('rename')
        .setDescription('Ticket kanalını yeniden adlandır')
        .addStringOption(o => o.setName('isim').setDescription('Yeni kanal adı').setRequired(true)),

    async execute(interaction) {
        const ticket = await ticketDB.get(interaction.channel.id);
        if (!ticket) return interaction.reply({ content: '❌ Bu bir ticket kanalı değil!', ephemeral: true });

        const newName = interaction.options.getString('isim');
        await interaction.channel.setName(newName);
        await interaction.reply({ content: `✅ Kanal adı **${newName}** olarak değiştirildi.`, ephemeral: true });
    },
};
