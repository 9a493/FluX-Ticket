import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { categoryDB } from '../../utils/database.js';

export default {
    data: new SlashCommandBuilder()
        .setName('category')
        .setDescription('Ticket kategorisi yönetimi')
        .addSubcommand(s => s.setName('add').setDescription('Kategori ekle')
            .addStringOption(o => o.setName('isim').setDescription('Kategori adı').setRequired(true))
            .addStringOption(o => o.setName('açıklama').setDescription('Açıklama'))
            .addStringOption(o => o.setName('emoji').setDescription('Emoji'))
            .addChannelOption(o => o.setName('discord_kategori').setDescription('Discord kategorisi').addChannelTypes(ChannelType.GuildCategory)))
        .addSubcommand(s => s.setName('remove').setDescription('Kategori sil')
            .addStringOption(o => o.setName('isim').setDescription('Kategori adı').setRequired(true).setAutocomplete(true)))
        .addSubcommand(s => s.setName('list').setDescription('Kategorileri listele'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async autocomplete(interaction) {
        const categories = await categoryDB.getAll(interaction.guild.id);
        const focused = interaction.options.getFocused().toLowerCase();
        const filtered = categories.filter(c => c.name.toLowerCase().includes(focused));
        await interaction.respond(filtered.slice(0, 25).map(c => ({ name: c.name, value: c.id })));
    },

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'add') {
            const name = interaction.options.getString('isim');
            const description = interaction.options.getString('açıklama');
            const emoji = interaction.options.getString('emoji') || '📁';
            const discordCategory = interaction.options.getChannel('discord_kategori');

            await categoryDB.create(interaction.guild.id, name, { description, emoji, discordCategoryId: discordCategory?.id });
            await interaction.reply({ content: `✅ Kategori oluşturuldu: ${emoji} ${name}`, ephemeral: true });
        } else if (sub === 'remove') {
            const categoryId = interaction.options.getString('isim');
            await categoryDB.delete(categoryId);
            await interaction.reply({ content: '✅ Kategori silindi.', ephemeral: true });
        } else if (sub === 'list') {
            const categories = await categoryDB.getAll(interaction.guild.id);
            if (categories.length === 0) return interaction.reply({ content: '📋 Henüz kategori yok.', ephemeral: true });
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('📁 Kategoriler')
                .setDescription(categories.map(c => `${c.emoji || '📁'} **${c.name}**\n   └ ${c.description || 'Açıklama yok'}`).join('\n\n'));
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },
};
