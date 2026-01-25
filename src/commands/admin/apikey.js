import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { apiKeyDB } from '../../utils/database.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('apikey')
        .setDescription('API anahtarı yönetimi')
        .addSubcommand(sub =>
            sub.setName('create')
                .setDescription('Yeni API anahtarı oluşturur')
                .addStringOption(opt =>
                    opt.setName('isim')
                        .setDescription('Anahtar ismi')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('yetki')
                        .setDescription('Yetki seviyesi')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Sadece Okuma', value: 'read' },
                            { name: 'Okuma + Yazma', value: 'read,write' },
                            { name: 'Tam Yetki', value: 'admin' },
                        )
                )
        )
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('API anahtarlarını listeler')
        )
        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('API anahtarını siler')
                .addStringOption(opt =>
                    opt.setName('id')
                        .setDescription('Silinecek anahtarın ID\'si')
                        .setRequired(true)
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        switch (sub) {
            case 'create':
                await createKey(interaction);
                break;
            case 'list':
                await listKeys(interaction);
                break;
            case 'delete':
                await deleteKey(interaction);
                break;
        }
    },
};

async function createKey(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const name = interaction.options.getString('isim');
    const permissions = interaction.options.getString('yetki') || 'read';

    try {
        const apiKey = await apiKeyDB.create(interaction.guild.id, name, permissions);

        const embed = new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('🔑 API Anahtarı Oluşturuldu')
            .setDescription('Aşağıdaki anahtarı güvenli bir yerde saklayın. Bu anahtar bir daha gösterilmeyecek!')
            .addFields(
                { name: '📝 İsim', value: name, inline: true },
                { name: '🔒 Yetkiler', value: permissions, inline: true },
                { name: '🔑 Anahtar', value: `\`\`\`${apiKey.key}\`\`\`` },
            )
            .setFooter({ text: 'Bu anahtar ile Dashboard\'a giriş yapabilirsiniz' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        logger.info(`API key created: ${name} for guild ${interaction.guild.name}`);

    } catch (error) {
        logger.error('API key create error:', error);
        await interaction.editReply({ content: '❌ Bir hata oluştu!' });
    }
}

async function listKeys(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const keys = await apiKeyDB.getAll(interaction.guild.id);

        if (keys.length === 0) {
            return interaction.editReply({ content: '📋 Henüz API anahtarı oluşturulmamış.' });
        }

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🔑 API Anahtarları')
            .setDescription(
                keys.map((k, i) => {
                    const status = k.enabled ? '🟢' : '🔴';
                    const lastUsed = k.lastUsed 
                        ? `<t:${Math.floor(new Date(k.lastUsed).getTime() / 1000)}:R>`
                        : 'Hiç';
                    return `${status} **${k.name}** (\`${k.id.slice(0, 8)}...\`)\n` +
                           `   Yetkiler: \`${k.permissions}\` | Kullanım: ${k.usageCount} | Son: ${lastUsed}`;
                }).join('\n\n')
            )
            .setFooter({ text: `Toplam ${keys.length} anahtar` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        logger.error('API key list error:', error);
        await interaction.editReply({ content: '❌ Bir hata oluştu!' });
    }
}

async function deleteKey(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const id = interaction.options.getString('id');

    try {
        await apiKeyDB.delete(id);

        const embed = new EmbedBuilder()
            .setColor('#ED4245')
            .setDescription('🗑️ API anahtarı silindi.')
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        logger.info(`API key deleted: ${id}`);

    } catch (error) {
        logger.error('API key delete error:', error);
        await interaction.editReply({ content: '❌ Anahtar bulunamadı veya silinemedi!' });
    }
}
