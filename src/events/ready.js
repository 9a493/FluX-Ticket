import { Events, ActivityType } from 'discord.js';
import logger from '../utils/logger.js';

export default {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        logger.info(`✅ Bot hazır! ${client.user.tag} olarak giriş yapıldı`);
        logger.info(`📊 ${client.guilds.cache.size} sunucuda aktif`);
        logger.info(`👥 ${client.users.cache.size} kullanıcıya hizmet veriyor`);

        // Bot aktivitesi
        const activities = [
            { name: '/setup ile başla', type: ActivityType.Playing },
            { name: `${client.guilds.cache.size} sunucu`, type: ActivityType.Watching },
            { name: 'Ticket Sistemi', type: ActivityType.Competing },
        ];

        let activityIndex = 0;
        const updateActivity = () => {
            client.user.setActivity(activities[activityIndex]);
            activityIndex = (activityIndex + 1) % activities.length;
        };

        updateActivity();
        setInterval(updateActivity, 30000); // Her 30 saniyede bir değiştir

        // Shard bilgisi (gelecekte kullanılacak)
        if (client.shard) {
            logger.info(`🔷 Shard ID: ${client.shard.ids[0]}`);
        }
    },
};