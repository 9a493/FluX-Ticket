import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import dotenv from 'dotenv';
import logger from './utils/logger.js';
import { testDatabaseConnection, disconnectDatabase } from './utils/database.js';
import { startHealthServer } from './server.js';
import { startAutoClose } from './utils/autoClose.js';
import { loadScheduledCloses } from './utils/scheduler.js';

// ES modules için __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// .env dosyasını yükle
dotenv.config();

// Discord Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
    ],
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.User,
        Partials.GuildMember,
    ],
});

// Global client referansı (scheduler için)
global.discordClient = client;

// Collections
client.commands = new Collection();
client.cooldowns = new Collection();

// Komutları yükle
async function loadCommands() {
    const commandsPath = join(__dirname, 'commands');
    const commandFolders = readdirSync(commandsPath);

    for (const folder of commandFolders) {
        const folderPath = join(commandsPath, folder);
        const commandFiles = readdirSync(folderPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = join(folderPath, file);
            const fileURL = pathToFileURL(filePath).href;
            
            try {
                const command = await import(fileURL);
                
                if ('data' in command.default && 'execute' in command.default) {
                    client.commands.set(command.default.data.name, command.default);
                    logger.info(`✅ Komut yüklendi: ${command.default.data.name}`);
                } else {
                    logger.warn(`⚠️ ${file} dosyasında "data" veya "execute" eksik.`);
                }
            } catch (error) {
                logger.error(`❌ Komut yükleme hatası (${file}):`, error);
            }
        }
    }
}

// Eventleri yükle
async function loadEvents() {
    const eventsPath = join(__dirname, 'events');
    const eventFiles = readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        const filePath = join(eventsPath, file);
        const fileURL = pathToFileURL(filePath).href;
        
        try {
            const event = await import(fileURL);
            
            if (event.default.once) {
                client.once(event.default.name, (...args) => event.default.execute(...args));
            } else {
                client.on(event.default.name, (...args) => event.default.execute(...args));
            }
            
            logger.info(`✅ Event yüklendi: ${event.default.name}`);
        } catch (error) {
            logger.error(`❌ Event yükleme hatası (${file}):`, error);
        }
    }
}

// Ana başlatma fonksiyonu
async function main() {
    try {
        logger.info('🚀 Bot başlatılıyor...');
        logger.info(`📍 Node.js: ${process.version}`);
        logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);

        // Database bağlantısını test et
        const dbConnected = await testDatabaseConnection();
        if (!dbConnected) {
            throw new Error('Database bağlantısı kurulamadı!');
        }

        // Komutları yükle
        await loadCommands();
        logger.info(`📦 ${client.commands.size} komut yüklendi`);

        // Eventleri yükle
        await loadEvents();

        // Health check & API server başlat
        startHealthServer();

        // Discord'a bağlan
        await client.login(process.env.TOKEN);

        // Client hazır olduktan sonra
        client.once('ready', async () => {
            // Auto-close sistemini başlat
            startAutoClose(client);
            
            // Zamanlanmış kapatmaları yükle
            await loadScheduledCloses();
            
            logger.info('🎉 Tüm sistemler hazır!');
        });

    } catch (error) {
        logger.error('❌ Bot başlatma hatası:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    logger.info('🛑 SIGINT sinyali alındı, kapatılıyor...');
    await disconnectDatabase();
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('🛑 SIGTERM sinyali alındı, kapatılıyor...');
    await disconnectDatabase();
    client.destroy();
    process.exit(0);
});

// Unhandled promise rejection
process.on('unhandledRejection', (error) => {
    logger.error('❌ Unhandled promise rejection:', error);
});

// Uncaught exception
process.on('uncaughtException', (error) => {
    logger.error('❌ Uncaught exception:', error);
    process.exit(1);
});

// Başlat
main();
