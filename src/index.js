import { Client, GatewayIntentBits, Collection, Partials } from 'discord.js';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { testDatabaseConnection } from './utils/database.js';
import { startScheduler } from './utils/scheduler.js';
import { startServer } from './server.js';
import { startSLAMonitor } from './utils/sla.js';
import { initAI } from './utils/ai.js';
import logger from './utils/logger.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Discord Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel, Partials.Message],
});

// Global client reference
global.discordClient = client;

// Collections
client.commands = new Collection();
client.cooldowns = new Collection();

// Load Commands
async function loadCommands() {
    const commandsPath = join(__dirname, 'commands');
    const commandFolders = readdirSync(commandsPath);

    for (const folder of commandFolders) {
        const folderPath = join(commandsPath, folder);
        const commandFiles = readdirSync(folderPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = join(folderPath, file);
            try {
                const command = await import(filePath);
                const cmd = command.default || command;
                
                if (cmd.data && cmd.execute) {
                    client.commands.set(cmd.data.name, cmd);
                    logger.debug(`✅ Komut yüklendi: ${cmd.data.name}`);
                }
            } catch (error) {
                logger.error(`❌ Komut yüklenemedi: ${file}`, error);
            }
        }
    }
    
    logger.info(`📦 ${client.commands.size} komut yüklendi`);
}

// Load Events
async function loadEvents() {
    const eventsPath = join(__dirname, 'events');
    const eventFiles = readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        const filePath = join(eventsPath, file);
        try {
            const event = await import(filePath);
            const evt = event.default || event;
            
            if (evt.once) {
                client.once(evt.name, (...args) => evt.execute(...args));
            } else {
                client.on(evt.name, (...args) => evt.execute(...args));
            }
            
            logger.debug(`✅ Event yüklendi: ${evt.name}`);
        } catch (error) {
            logger.error(`❌ Event yüklenemedi: ${file}`, error);
        }
    }
    
    logger.info(`📦 ${eventFiles.length} event yüklendi`);
}

// Main
async function main() {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║         🎫 FluX Ticket Bot v3.0 - MEGA Edition 🎫          ║
║                   by FluX Digital                          ║
╠═══════════════════════════════════════════════════════════╣
║  43+ Features: AI, SLA, Gamification, Knowledge Base...    ║
╚═══════════════════════════════════════════════════════════╝
    `);

    // Database
    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
        logger.error('Database bağlantısı kurulamadı! Çıkılıyor...');
        process.exit(1);
    }

    // Load Commands & Events
    await loadCommands();
    await loadEvents();

    // Initialize AI
    const aiReady = initAI();
    if (aiReady) {
        logger.info('🤖 Claude AI initialized');
    }

    // Login
    await client.login(process.env.DISCORD_TOKEN);
}

// Ready Event - Start services after login
client.once('ready', () => {
    logger.info(`🚀 Bot hazır: ${client.user.tag}`);
    logger.info(`📊 ${client.guilds.cache.size} sunucuda aktif`);

    // Start Scheduler
    startScheduler(client);
    logger.info('⏰ Scheduler başlatıldı');

    // Start SLA Monitor
    startSLAMonitor(client);
    logger.info('📊 SLA Monitor başlatıldı');

    // Start REST API
    const apiPort = process.env.API_PORT || 3000;
    startServer(apiPort);
});

// Error Handling
client.on('error', error => logger.error('Client error:', error));
process.on('unhandledRejection', error => logger.error('Unhandled rejection:', error));
process.on('uncaughtException', error => {
    logger.error('Uncaught exception:', error);
    process.exit(1);
});

// Graceful Shutdown
process.on('SIGINT', async () => {
    logger.info('Kapatılıyor...');
    client.destroy();
    process.exit(0);
});

// Start
main().catch(error => {
    logger.error('Fatal error:', error);
    process.exit(1);
});
