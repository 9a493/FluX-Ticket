import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { guildDB } from '../../utils/database.js';
import { initAI } from '../../utils/ai.js';

export default {
    data: new SlashCommandBuilder()
        .setName('ai')
        .setDescription('Claude AI ayarları')
        .addSubcommand(s => s.setName('config').setDescription('AI ayarlarını yapılandır')
            .addBooleanOption(o => o.setName('aktif').setDescription('AI özelliği aktif mi?'))
            .addBooleanOption(o => o.setName('otomatik_yanıt').setDescription('Otomatik yanıt versin mi?')))
        .addSubcommand(s => s.setName('prompt').setDescription('AI system prompt ayarla')
            .addStringOption(o => o.setName('prompt').setDescription('System prompt').setMaxLength(1000)))
        .addSubcommand(s => s.setName('status').setDescription('AI durumunu göster'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        
        if (sub === 'config') {
            const data = {};
            const aktif = interaction.options.getBoolean('aktif');
            const auto = interaction.options.getBoolean('otomatik_yanıt');
            
            if (aktif !== null) data.aiEnabled = aktif;
            if (auto !== null) data.aiAutoResponse = auto;
            
            await guildDB.update(interaction.guild.id, data);
            
            const embed = new EmbedBuilder()
                .setColor('#57F287')
                .setTitle('🤖 AI Ayarları Güncellendi')
                .addFields(
                    { name: '📊 AI', value: aktif !== null ? (aktif ? '✅ Aktif' : '❌ Deaktif') : 'Değişmedi', inline: true },
                    { name: '💬 Oto-Yanıt', value: auto !== null ? (auto ? '✅ Aktif' : '❌ Deaktif') : 'Değişmedi', inline: true },
                );
            await interaction.reply({ embeds: [embed], ephemeral: true });
            
        } else if (sub === 'prompt') {
            const prompt = interaction.options.getString('prompt');
            await guildDB.update(interaction.guild.id, { aiPrompt: prompt });
            await interaction.reply({ content: prompt ? '✅ AI prompt güncellendi!' : '✅ AI prompt sıfırlandı.', ephemeral: true });
            
        } else {
            const config = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);
            const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
            
            const embed = new EmbedBuilder()
                .setColor(config.aiEnabled && hasApiKey ? '#57F287' : '#ED4245')
                .setTitle('🤖 Claude AI Durumu')
                .addFields(
                    { name: '🔑 API Key', value: hasApiKey ? '✅ Ayarlı' : '❌ Eksik', inline: true },
                    { name: '📊 AI', value: config.aiEnabled ? '✅ Aktif' : '❌ Deaktif', inline: true },
                    { name: '💬 Oto-Yanıt', value: config.aiAutoResponse ? '✅ Aktif' : '❌ Deaktif', inline: true },
                    { name: '📝 Model', value: 'Claude Sonnet', inline: true },
                );
            
            if (config.aiPrompt) {
                embed.addFields({ name: '💭 Prompt', value: config.aiPrompt.substring(0, 200) + '...', inline: false });
            }
            
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },
};
