import { REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const commands = [];

async function loadCommands() {
    const commandsPath = join(__dirname, 'commands');
    const commandFolders = readdirSync(commandsPath);

    for (const folder of commandFolders) {
        const folderPath = join(commandsPath, folder);
        const commandFiles = readdirSync(folderPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = join(folderPath, file);
            try {
                // Windows için pathToFileURL kullan
                const fileUrl = pathToFileURL(filePath).href;
                const command = await import(fileUrl);
                const cmd = command.default || command;
                
                if (cmd.data) {
                    commands.push(cmd.data.toJSON());
                    console.log(`✅ Loaded: ${cmd.data.name}`);
                }
            } catch (error) {
                console.error(`❌ Error loading ${file}:`, error.message);
            }
        }
    }
}

async function deploy() {
    await loadCommands();

    console.log(`\n📦 ${commands.length} komut yüklendi\n`);

    if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
        console.error('❌ DISCORD_TOKEN veya CLIENT_ID bulunamadı!');
        console.error('   .env dosyasını kontrol edin.');
        process.exit(1);
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        console.log('🚀 Komutlar deploy ediliyor...\n');

        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log(`✅ ${data.length} komut başarıyla deploy edildi!\n`);
    } catch (error) {
        console.error('Deploy hatası:', error);
    }
}

deploy();
