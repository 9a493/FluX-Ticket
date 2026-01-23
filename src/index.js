import { Client, GatewayIntentBits, Collection, Partials } from 'discord.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync } from 'fs';
import { pathToFileURL } from 'url';
import logger from './utils/logger.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Client oluştur
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});

// Collections
client.commands = new Collection();
client.cooldowns = new Collection();

// Command Handler
const commandFolders = readdirSync(join(__dirname, 'commands'));
for (const folder of commandFolders) {
    const commandFiles = readdirSync(join(__dirname, 'commands', folder)).filter(
        file => file.endsWith('.js')
    );
    
    for (const file of commandFiles) {
        const filePath = join(__dirname, 'commands', folder, file);
        const fileURL = pathToFileURL(filePath).href;
        import(fileURL).then(command => {
            if ('data' in command.default && 'execute' in command.default) {
                client.commands.set(command.default.data.name, command.default);
                logger.info(`✅ Loaded command: ${command.default.data.name}`);
            } else {
                logger.warn(`⚠️  Command at ${filePath} is missing required "data" or "execute" property.`);
            }
        });
    }
}

// Event Handler
const eventFiles = readdirSync(join(__dirname, 'events')).filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
    const filePath = join(__dirname, 'events', file);
    const fileURL = pathToFileURL(filePath).href;
    import(fileURL).then(event => {
        if (event.default.once) {
            client.once(event.default.name, (...args) => event.default.execute(...args));
        } else {
            client.on(event.default.name, (...args) => event.default.execute(...args));
        }
        logger.info(`✅ Loaded event: ${event.default.name}`);
    });
}

// Error Handling
process.on('unhandledRejection', error => {
    logger.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    logger.error('Uncaught exception:', error);
    process.exit(1);
});

// Login
client.login(process.env.TOKEN).catch(error => {
    logger.error('Failed to login:', error);
    process.exit(1);
});