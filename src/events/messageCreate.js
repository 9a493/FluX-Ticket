import { Events } from 'discord.js';
import { ticketDB } from '../utils/database.js';

export default {
    name: Events.MessageCreate,
    async execute(message) {
        // Bot mesajlarını sayma
        if (message.author.bot) return;
        
        // DM mesajlarını sayma
        if (!message.guild) return;

        try {
            // Bu bir ticket kanalı mı kontrol et ve mesaj sayısını artır
            await ticketDB.incrementMessages(message.channel.id);
        } catch (error) {
            // Hata olsa da sessizce devam et (her mesajda log spam olmasın)
        }
    },
};
