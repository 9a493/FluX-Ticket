import { Client, GatewayIntentBits, Collection, Partials } from 'discord.js';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
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

global.discordClient = client;
client.commands = new Collection();
client.cooldowns = new Collection();

// Windows uyumlu dinamik import - pathToFileURL kullanarak
async function loadCommands() {
    const commandsPath = join(__dirname, 'commands');
    const commandFolders = readdirSync(commandsPath);

    for (const folder of commandFolders) {
        const folderPath = join(commandsPath, folder);
        const commandFiles = readdirSync(folderPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = join(folderPath, file);
            try {
                // Windows için pathToFileURL kullan - bu kritik!
                const fileUrl = pathToFileURL(filePath).href;
                const command = await import(fileUrl);
                const cmd = command.default || command;
                
                if (cmd.data && cmd.execute) {
                    client.commands.set(cmd.data.name, cmd);
                    logger.debug(`✅ Komut: ${cmd.data.name}`);
                }
            } catch (error) {
                logger.error(`❌ Komut yüklenemedi: ${file}`, error);
            }
        }
    }
    logger.info(`📦 ${client.commands.size} komut yüklendi`);
}

async function loadEvents() {
    const eventsPath = join(__dirname, 'events');
    const eventFiles = readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        const filePath = join(eventsPath, file);
        try {
            // Windows için pathToFileURL kullan
            const fileUrl = pathToFileURL(filePath).href;
            const event = await import(fileUrl);
            const evt = event.default || event;
            
            if (evt.once) {
                client.once(evt.name, (...args) => evt.execute(...args));
            } else {
                client.on(evt.name, (...args) => evt.execute(...args));
            }
            logger.debug(`✅ Event: ${evt.name}`);
        } catch (error) {
            logger.error(`❌ Event yüklenemedi: ${file}`, error);
        }
    }
    logger.info(`📦 ${eventFiles.length} event yüklendi`);
}

async function main() {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║         🎫 FluX Ticket Bot v3.0 - MEGA Edition 🎫          ║
║                   by FluX Digital                          ║
╠═══════════════════════════════════════════════════════════╣
║  43+ Features: AI, SLA, Gamification, Knowledge Base...    ║
╚═══════════════════════════════════════════════════════════╝
    `);

    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
        logger.error('Database bağlantısı kurulamadı!');
        process.exit(1);
    }

    await loadCommands();
    await loadEvents();

    const aiReady = initAI();
    if (aiReady) {
        logger.info('🤖 Claude AI initialized');
    }

    if (!process.env.DISCORD_TOKEN) {
        logger.error('❌ DISCORD_TOKEN bulunamadı! .env dosyasını kontrol edin.');
        process.exit(1);
    }

    await client.login(process.env.DISCORD_TOKEN);
}

client.once('ready', () => {
    logger.info(`🚀 Bot hazır: ${client.user.tag}`);
    logger.info(`📊 ${client.guilds.cache.size} sunucuda aktif`);
    
    startScheduler(client);
    startSLAMonitor(client);
    
    const apiPort = process.env.API_PORT || 3000;
    startServer(apiPort);
});

client.on('error', error => logger.error('Client error:', error));
process.on('unhandledRejection', error => logger.error('Unhandled rejection:', error));
process.on('SIGINT', () => { client.destroy(); process.exit(0); });

main().catch(error => {
    logger.error('Fatal error:', error);
    process.exit(1);
});
