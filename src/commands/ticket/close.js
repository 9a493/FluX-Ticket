import { SlashCommandBuilder } from 'discord.js';
import { closeTicket } from '../../utils/ticketManager.js';

export default {
    data: new SlashCommandBuilder()
        .setName('close')
        .setDescription('Ticketı kapat')
        .addStringOption(o => o.setName('sebep').setDescription('Kapatma sebebi')),

    async execute(interaction) {
        const reason = interaction.options.getString('sebep');
        await closeTicket(interaction, reason);
    },
};
