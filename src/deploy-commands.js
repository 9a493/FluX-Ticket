import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync } from 'fs';
import { pathToFileURL } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const commands = [];

// Tüm komutları topla
const commandFolders = readdirSync(join(__dirname, 'commands'));
for (const folder of commandFolders) {
    const commandFiles = readdirSync(join(__dirname, 'commands', folder)).filter(
        file => file.endsWith('.js')
    );
    
    for (const file of commandFiles) {
        const filePath = join(__dirname, 'commands', folder, file);
        const fileURL = pathToFileURL(filePath).href;
        const command = await import(fileURL);
        if ('data' in command.default && 'execute' in command.default) {
            commands.push(command.default.data.toJSON());
            console.log(`✅ Loaded: ${command.default.data.name}`);
        }
    }
}

// REST instance oluştur
const rest = new REST().setToken(process.env.TOKEN);

// Komutları deploy et
(async () => {
    try {
        console.log(`\n🔄 ${commands.length} slash komutu kaydediliyor...`);

        // Development modunda sadece belirli bir sunucuya kaydet (hızlı)
        if (process.env.GUILD_ID) {
            const data = await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: commands }
            );
            console.log(`✅ ${data.length} komut test sunucusuna kaydedildi!`);
        } 
        // Production modunda global olarak kaydet (1 saat sürebilir)
        else {
            const data = await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands }
            );
            console.log(`✅ ${data.length} komut global olarak kaydedildi!`);
            console.log(`⚠️  Global komutlar Discord'da görünmesi 1 saat sürebilir.`);
        }

    } catch (error) {
        console.error('❌ Komutlar kaydedilirken hata:', error);
    }
})();