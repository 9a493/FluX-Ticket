import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { templateDB } from '../../utils/database.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('template')
        .setDescription('Ticket şablonları yönetimi')
        .addSubcommand(sub => sub.setName('create').setDescription('Yeni şablon oluştur')
            .addStringOption(o => o.setName('isim').setDescription('Şablon adı').setRequired(true).setMaxLength(50))
            .addStringOption(o => o.setName('açıklama').setDescription('Şablon açıklaması').setMaxLength(100))
            .addStringOption(o => o.setName('emoji').setDescription('Emoji'))
            .addIntegerOption(o => o.setName('öncelik').setDescription('Varsayılan öncelik')
                .addChoices({ name: '🔴 Acil', value: 4 }, { name: '🟠 Yüksek', value: 3 }, { name: '🟡 Normal', value: 2 }, { name: '🟢 Düşük', value: 1 })))
        .addSubcommand(sub => sub.setName('list').setDescription('Şablonları listele'))
        .addSubcommand(sub => sub.setName('delete').setDescription('Şablon sil')
            .addStringOption(o => o.setName('şablon').setDescription('Silinecek şablon').setRequired(true).setAutocomplete(true)))
        .addSubcommand(sub => sub.setName('addfield').setDescription('Şablona alan ekle')
            .addStringOption(o => o.setName('şablon').setDescription('Şablon').setRequired(true).setAutocomplete(true))
            .addStringOption(o => o.setName('alan_adı').setDescription('Alan adı').setRequired(true).setMaxLength(45))
            .addStringOption(o => o.setName('placeholder').setDescription('Placeholder').setMaxLength(100))
            .addBooleanOption(o => o.setName('zorunlu').setDescription('Zorunlu mu?'))
            .addBooleanOption(o => o.setName('uzun').setDescription('Uzun metin mi?')))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async autocomplete(interaction) {
        const focused = interaction.options.getFocused(true);
        if (focused.name === 'şablon') {
            const templates = await templateDB.getAll(interaction.guild.id);
            const filtered = templates.filter(t => t.name.toLowerCase().includes(focused.value.toLowerCase()));
            await interaction.respond(filtered.slice(0, 25).map(t => ({ name: `${t.emoji || '📋'} ${t.name}`, value: t.id })));
        }
    },

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        await interaction.deferReply({ ephemeral: true });

        try {
            if (sub === 'create') {
                const name = interaction.options.getString('isim');
                const template = await templateDB.create(interaction.guild.id, {
                    name,
                    description: interaction.options.getString('açıklama'),
                    emoji: interaction.options.getString('emoji') || '📋',
                    defaultPriority: interaction.options.getInteger('öncelik') || 2,
                    fields: [],
                });
                await interaction.editReply({ content: `✅ **${name}** şablonu oluşturuldu! Alan eklemek için \`/template addfield\` kullanın.` });
            } else if (sub === 'list') {
                const templates = await templateDB.getAll(interaction.guild.id);
                if (templates.length === 0) return interaction.editReply({ content: '📋 Henüz şablon yok.' });
                const embed = new EmbedBuilder().setColor('#5865F2').setTitle('📋 Şablonlar')
                    .setDescription(templates.map((t, i) => `**${i + 1}. ${t.emoji} ${t.name}** - ${t.fields?.length || 0} alan, ${t.useCount} kullanım`).join('\n'));
                await interaction.editReply({ embeds: [embed] });
            } else if (sub === 'delete') {
                await templateDB.delete(interaction.options.getString('şablon'));
                await interaction.editReply({ content: '✅ Şablon silindi.' });
            } else if (sub === 'addfield') {
                const template = await templateDB.get(interaction.options.getString('şablon'));
                if (!template) return interaction.editReply({ content: '❌ Şablon bulunamadı!' });
                if (template.fields.length >= 5) return interaction.editReply({ content: '❌ Max 5 alan!' });
                template.fields.push({
                    id: `field_${Date.now()}`,
                    label: interaction.options.getString('alan_adı'),
                    placeholder: interaction.options.getString('placeholder') || '',
                    required: interaction.options.getBoolean('zorunlu') ?? true,
                    style: interaction.options.getBoolean('uzun') ? 'paragraph' : 'short',
                });
                await templateDB.update(template.id, { fields: JSON.stringify(template.fields) });
                await interaction.editReply({ content: `✅ Alan eklendi! Toplam: ${template.fields.length}/5` });
            }
        } catch (error) {
            logger.error('Template hatası:', error);
            await interaction.editReply({ content: '❌ Bir hata oluştu!' });
        }
    },
};
