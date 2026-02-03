import { Events, ActivityType } from 'discord.js';
import logger from '../utils/logger.js';

export default {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        logger.info(`✅ Bot ready! Logged in as ${client.user.tag}`);
        logger.info(`📊 Active in ${client.guilds.cache.size} servers`);
        
        // Log all guild names
        client.guilds.cache.forEach(guild => {
            logger.debug(`- ${guild.name} (${guild.id})`);
        });
    },
};
