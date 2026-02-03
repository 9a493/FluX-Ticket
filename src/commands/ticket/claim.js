import { SlashCommandBuilder } from 'discord.js';
import { claimTicket } from '../../utils/ticketManager.js';

export default {
    data: new SlashCommandBuilder()
        .setName('claim')
        .setDescription('Ticketı sahiplen'),

    async execute(interaction) {
        await claimTicket(interaction);
    },
};
