import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const commands = [];
const commandFolders = ['admin', 'ticket', 'utility'];

// Komutları yükle
for (const folder of commandFolders) {
    const folderPath = join(__dirname, 'commands', folder);
    
    try {
        const commandFiles = readdirSync(folderPath).filter(file => file.endsWith('.js'));
        
        for (const file of commandFiles) {
            const filePath = join(folderPath, file);
            try {
                const { default: command } = await import(`file://${filePath}`);
                
                if ('data' in command) {
                    commands.push(command.data.toJSON());
                    console.log(`✅ Loaded: ${command.data.name}`);
                }
            } catch (error) {
                console.error(`❌ Error loading ${file}:`, error.message);
            }
        }
    } catch (error) {
        console.warn(`⚠️ Folder not found: ${folder}`);
    }
}

console.log(`\n📦 Total commands: ${commands.length}`);

// REST client
const rest = new REST().setToken(process.env.DISCORD_TOKEN || process.env.TOKEN);

// Deploy
(async () => {
    try {
        const clientId = process.env.CLIENT_ID;
        const guildId = process.env.GUILD_ID;
        const deployGlobal = process.env.DEPLOY_GLOBAL === 'true';

        if (!clientId) {
            console.error('❌ CLIENT_ID not found in environment!');
            process.exit(1);
        }

        if (deployGlobal) {
            // Global deploy
            console.log('\n🌍 Deploying commands globally...');
            
            const data = await rest.put(
                Routes.applicationCommands(clientId),
                { body: commands }
            );
            
            console.log(`✅ Successfully deployed ${data.length} commands globally!`);
            console.log('⚠️ Global commands may take up to 1 hour to update.');
        } else if (guildId) {
            // Guild deploy (instant)
            console.log(`\n🏠 Deploying commands to guild ${guildId}...`);
            
            const data = await rest.put(
                Routes.applicationGuildCommands(clientId, guildId),
                { body: commands }
            );
            
            console.log(`✅ Successfully deployed ${data.length} commands to guild!`);
        } else {
            console.log('\n📋 No deployment target specified.');
            console.log('Set GUILD_ID for guild deploy or DEPLOY_GLOBAL=true for global deploy.');
            console.log('\nUsage:');
            console.log('  npm run deploy        - Deploy to GUILD_ID');
            console.log('  npm run deploy:global - Deploy globally');
        }
    } catch (error) {
        console.error('❌ Deployment error:', error);
    }
})();
