import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { categoryDB } from '../../utils/database.js';
import { logAudit, AuditActions, TargetTypes } from '../../utils/auditLog.js';
import { t } from '../../utils/i18n.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('category')
        .setDescription('Ticket kategorilerini yönet')
        .addSubcommand(s => s.setName('add').setDescription('Kategori ekle')
            .addStringOption(o => o.setName('isim').setDescription('İsim').setRequired(true))
            .addStringOption(o => o.setName('emoji').setDescription('Emoji'))
            .addStringOption(o => o.setName('açıklama').setDescription('Açıklama'))
            .addChannelOption(o => o.setName('discord-kategori').setDescription('Discord kategorisi').addChannelTypes(ChannelType.GuildCategory)))
        .addSubcommand(s => s.setName('remove').setDescription('Kategori sil')
            .addStringOption(o => o.setName('isim').setDescription('İsim').setRequired(true).setAutocomplete(true)))
        .addSubcommand(s => s.setName('list').setDescription('Kategorileri listele'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async autocomplete(interaction) {
        const categories = await categoryDB.getAll(interaction.guild.id, true);
        const focused = interaction.options.getFocused().toLowerCase();
        await interaction.respond(categories.filter(c => c.name.toLowerCase().includes(focused)).slice(0, 25).map(c => ({ name: `${c.emoji || '🎫'} ${c.name}`, value: c.name })));
    },

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        await interaction.deferReply({ ephemeral: true });

        try {
            if (sub === 'add') {
                const name = interaction.options.getString('isim');
                if (await categoryDB.getByName(interaction.guild.id, name)) return interaction.editReply({ content: '❌ Bu kategori zaten var!' });
                
                await categoryDB.create(interaction.guild.id, name, {
                    emoji: interaction.options.getString('emoji') || '🎫',
                    description: interaction.options.getString('açıklama'),
                    discordCategoryId: interaction.options.getChannel('discord-kategori')?.id,
                });
                await interaction.editReply({ content: `✅ Kategori oluşturuldu: ${name}` });
            }
            else if (sub === 'remove') {
                const name = interaction.options.getString('isim');
                const cat = await categoryDB.getByName(interaction.guild.id, name);
                if (!cat) return interaction.editReply({ content: '❌ Kategori bulunamadı!' });
                await categoryDB.delete(cat.id);
                await interaction.editReply({ content: `🗑️ Kategori silindi: ${name}` });
            }
            else if (sub === 'list') {
                const cats = await categoryDB.getAll(interaction.guild.id, true);
                if (!cats.length) return interaction.editReply({ content: '📁 Kategori yok.' });
                const embed = new EmbedBuilder().setColor('#5865F2').setTitle('📁 Kategoriler')
                    .setDescription(cats.map((c, i) => `${i + 1}. ${c.emoji || '🎫'} **${c.name}** ${c.enabled ? '🟢' : '🔴'}`).join('\n'));
                await interaction.editReply({ embeds: [embed] });
            }
        } catch (error) {
            logger.error('Category error:', error);
            await interaction.editReply({ content: '❌ Hata!' });
        }
    },
};
