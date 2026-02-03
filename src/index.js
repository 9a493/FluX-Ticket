import 'dotenv/config';
import { Client, Collection, GatewayIntentBits, Partials, ActivityType } from 'discord.js';
import { readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import logger from './utils/logger.js';
import { testDatabaseConnection, disconnectDatabase, guildDB } from './utils/database.js';
import { loadLang } from './utils/i18n.js';
import { startAutoClose } from './utils/autoClose.js';
import { loadScheduledCloses } from './utils/scheduler.js';
import { startServer } from './server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Discord Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
    ],
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.User,
    ],
});

// Collections
client.commands = new Collection();
client.cooldowns = new Collection();

// ==================== COMMAND LOADER ====================
async function loadCommands() {
    const commandFolders = ['admin', 'ticket', 'utility'];
    let loadedCount = 0;

    for (const folder of commandFolders) {
        const folderPath = join(__dirname, 'commands', folder);
        
        try {
            const commandFiles = readdirSync(folderPath).filter(file => file.endsWith('.js'));
            
            for (const file of commandFiles) {
                const filePath = join(folderPath, file);
                try {
                    const { default: command } = await import(`file://${filePath}`);
                    
                    if ('data' in command && 'execute' in command) {
                        client.commands.set(command.data.name, command);
                        loadedCount++;
                        logger.debug(`Loaded command: ${command.data.name}`);
                    } else {
                        logger.warn(`Invalid command structure: ${file}`);
                    }
                } catch (error) {
                    logger.error(`Error loading command ${file}:`, error);
                }
            }
        } catch (error) {
            logger.warn(`Command folder not found: ${folder}`);
        }
    }

    logger.info(`✅ ${loadedCount} komut yüklendi`);
}

// ==================== EVENT LOADER ====================
async function loadEvents() {
    const eventsPath = join(__dirname, 'events');
    let loadedCount = 0;

    try {
        const eventFiles = readdirSync(eventsPath).filter(file => file.endsWith('.js'));

        for (const file of eventFiles) {
            const filePath = join(eventsPath, file);
            try {
                const { default: event } = await import(`file://${filePath}`);
                
                if (event.once) {
                    client.once(event.name, (...args) => event.execute(...args));
                } else {
                    client.on(event.name, (...args) => event.execute(...args));
                }
                loadedCount++;
                logger.debug(`Loaded event: ${event.name}`);
            } catch (error) {
                logger.error(`Error loading event ${file}:`, error);
            }
        }
    } catch (error) {
        logger.warn('Events folder not found');
    }

    logger.info(`✅ ${loadedCount} event yüklendi`);
}

// ==================== GUILD SETUP ====================
async function setupGuilds() {
    try {
        const guilds = await guildDB.getAll();
        
        for (const guild of guilds) {
            // Dil ayarlarını yükle
            if (guild.locale) {
                loadLang(guild.id, guild.locale);
            }
        }

        logger.info(`✅ ${guilds.length} sunucu ayarları yüklendi`);
    } catch (error) {
        logger.error('Guild setup error:', error);
    }
}

// ==================== STARTUP ====================
async function main() {
    logger.info('🚀 FluX Ticket Bot v2.1 başlatılıyor...');

    // Database bağlantısını test et
    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
        logger.error('❌ Database bağlantısı kurulamadı! Bot kapatılıyor.');
        process.exit(1);
    }

    // Komutları yükle
    await loadCommands();

    // Event'leri yükle
    await loadEvents();

    // Bot'u başlat
    try {
        await client.login(process.env.DISCORD_TOKEN || process.env.TOKEN);
        logger.info(`✅ Bot olarak giriş yapıldı: ${client.user.tag}`);
    } catch (error) {
        logger.error('❌ Bot giriş hatası:', error);
        process.exit(1);
    }

    // Bot hazır olduğunda
    client.once('ready', async () => {
        logger.info(`✅ Bot hazır! ${client.user.tag} olarak giriş yapıldı`);
        logger.info(`📊 ${client.guilds.cache.size} sunucuda aktif`);

        // Global client'ı ayarla
        global.discordClient = client;

        // Guild ayarlarını yükle
        await setupGuilds();

        // Auto-close sistemini başlat
        startAutoClose(client);

        // Zamanlanmış kapatmaları yükle
        await loadScheduledCloses();

        // Web server'ı başlat
        startServer(client);

        // Bot durumunu ayarla
        setActivity();

        // Her 30 saniyede bir durumu değiştir
        setInterval(setActivity, 30000);
    });

    // Activity ayarlama
    let activityIndex = 0;
    function setActivity() {
        const activities = [
            { name: '/help | FluX Ticket', type: ActivityType.Playing },
            { name: `${client.guilds.cache.size} sunucuda`, type: ActivityType.Watching },
            { name: 'fluxdigital.com.tr', type: ActivityType.Watching },
            { name: 'Ticket sistemini yönetiyor', type: ActivityType.Playing },
        ];

        const activity = activities[activityIndex % activities.length];
        client.user.setActivity(activity.name, { type: activity.type });
        activityIndex++;
    }
}

// ==================== ERROR HANDLING ====================
process.on('unhandledRejection', (error) => {
    logger.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    logger.info('Shutting down...');
    await disconnectDatabase();
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('Shutting down...');
    await disconnectDatabase();
    client.destroy();
    process.exit(0);
});

// Start
main().catch(error => {
    logger.error('Startup error:', error);
    process.exit(1);
});

export default client;
