import { SlashCommandBuilder } from 'discord.js';
import { closeTicket } from '../../utils/ticketManager.js';

export default {
    data: new SlashCommandBuilder()
        .setName('close')
        .setDescription('Ticketı kapatır')
        .addStringOption(option =>
            option.setName('sebep')
                .setDescription('Kapatma sebebi (opsiyonel)')
                .setRequired(false)
        ),

    async execute(interaction) {
        // ticketManager'daki closeTicket fonksiyonunu kullan
        await closeTicket(interaction);
    },
};