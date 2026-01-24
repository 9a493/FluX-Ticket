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
async function loadCommands() {
    const commandFolders = readdirSync(join(__dirname, 'commands'));
    
    for (const folder of commandFolders) {
        const commandFiles = readdirSync(join(__dirname, 'commands', folder)).filter(
            file => file.endsWith('.js')
        );
        
        for (const file of commandFiles) {
            const filePath = join(__dirname, 'commands', folder, file);
            const fileURL = pathToFileURL(filePath).href;
            
            try {
                const command = await import(fileURL);
                if ('data' in command.default && 'execute' in command.default) {
                    commands.push(command.default.data.toJSON());
                    console.log(`✅ Yüklendi: ${command.default.data.name}`);
                } else {
                    console.log(`⚠️ Atlandı: ${file} (data veya execute eksik)`);
                }
            } catch (error) {
                console.error(`❌ Hata (${file}):`, error.message);
            }
        }
    }
}

// Komutları deploy et
async function deployCommands() {
    await loadCommands();

    if (commands.length === 0) {
        console.error('❌ Yüklenecek komut bulunamadı!');
        process.exit(1);
    }

    const rest = new REST().setToken(process.env.TOKEN);

    try {
        console.log(`\n🔄 ${commands.length} slash komutu kaydediliyor...`);

        // Development modunda sadece belirli bir sunucuya kaydet (anında aktif)
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

        console.log('\n📋 Kaydedilen komutlar:');
        commands.forEach(cmd => {
            console.log(`   • /${cmd.name} - ${cmd.description}`);
        });

    } catch (error) {
        console.error('❌ Komutlar kaydedilirken hata:', error);
        process.exit(1);
    }
}

deployCommands();
