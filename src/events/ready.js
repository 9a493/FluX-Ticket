import { Events, ActivityType } from 'discord.js';
import logger from '../utils/logger.js';

export default {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        logger.info(`✅ Bot hazır! ${client.user.tag} olarak giriş yapıldı`);
        logger.info(`📊 ${client.guilds.cache.size} sunucuda aktif`);
        logger.info(`👥 ${client.users.cache.size} kullanıcıya hizmet veriyor`);

        // Bot aktivitesi - döngülü
        const activities = [
            { name: '/help ile komutlara bak', type: ActivityType.Playing },
            { name: `${client.guilds.cache.size} sunucu`, type: ActivityType.Watching },
            { name: 'Ticket Sistemi', type: ActivityType.Competing },
            { name: 'Destek taleplerini', type: ActivityType.Listening },
        ];

        let activityIndex = 0;
        const updateActivity = () => {
            client.user.setActivity(activities[activityIndex]);
            activityIndex = (activityIndex + 1) % activities.length;
        };

        // İlk aktiviteyi ayarla
        updateActivity();

        // Her 30 saniyede bir değiştir
        setInterval(updateActivity, 30000);

        // Bot durumu
        client.user.setStatus('online');

        // Shard bilgisi (sharding aktifse)
        if (client.shard) {
            logger.info(`🔷 Shard ID: ${client.shard.ids[0]}`);
        }

        // Sunucu bilgilerini logla
        client.guilds.cache.forEach(guild => {
            logger.info(`   📍 ${guild.name} (${guild.memberCount} üye)`);
        });
    },
};
