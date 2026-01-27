import { Events, ActivityType } from 'discord.js';
import logger from '../utils/logger.js';

export default {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        logger.info(`🚀 Logged in as ${client.user.tag}`);
        logger.info(`📊 Serving ${client.guilds.cache.size} guilds`);

        // Set activity
        client.user.setActivity('🎫 Ticket yönetimi', { type: ActivityType.Watching });

        // Rotate activity every 30 seconds
        const activities = [
            { name: '🎫 Ticket yönetimi', type: ActivityType.Watching },
            { name: `${client.guilds.cache.size} sunucu`, type: ActivityType.Watching },
            { name: '/help | FluX Ticket', type: ActivityType.Playing },
            { name: 'v3.0 MEGA Edition', type: ActivityType.Playing },
        ];

        let i = 0;
        setInterval(() => {
            i = (i + 1) % activities.length;
            client.user.setActivity(activities[i].name, { type: activities[i].type });
        }, 30000);
    },
};
