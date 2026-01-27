import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { cannedDB } from '../../utils/database.js';

export default {
    data: new SlashCommandBuilder()
        .setName('canned')
        .setDescription('Hazır yanıt yönetimi')
        .addSubcommand(s => s.setName('add').setDescription('Hazır yanıt ekle')
            .addStringOption(o => o.setName('isim').setDescription('Yanıt adı').setRequired(true))
            .addStringOption(o => o.setName('içerik').setDescription('Yanıt içeriği').setRequired(true)))
        .addSubcommand(s => s.setName('remove').setDescription('Hazır yanıt sil')
            .addStringOption(o => o.setName('isim').setDescription('Yanıt adı').setRequired(true).setAutocomplete(true)))
        .addSubcommand(s => s.setName('list').setDescription('Hazır yanıtları listele'))
        .addSubcommand(s => s.setName('use').setDescription('Hazır yanıt kullan')
            .addStringOption(o => o.setName('isim').setDescription('Yanıt adı').setRequired(true).setAutocomplete(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async autocomplete(interaction) {
        const responses = await cannedDB.getAll(interaction.guild.id);
        const focused = interaction.options.getFocused().toLowerCase();
        const filtered = responses.filter(r => r.name.toLowerCase().includes(focused));
        await interaction.respond(filtered.slice(0, 25).map(r => ({ name: r.name, value: r.name })));
    },

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'add') {
            const name = interaction.options.getString('isim');
            const content = interaction.options.getString('içerik');
            await cannedDB.create(interaction.guild.id, name, content, interaction.user.id);
            await interaction.reply({ content: `✅ Hazır yanıt oluşturuldu: \`${name}\``, ephemeral: true });
        } else if (sub === 'remove') {
            const name = interaction.options.getString('isim');
            await cannedDB.delete(interaction.guild.id, name);
            await interaction.reply({ content: `✅ Hazır yanıt silindi: \`${name}\``, ephemeral: true });
        } else if (sub === 'list') {
            const responses = await cannedDB.getAll(interaction.guild.id);
            if (responses.length === 0) return interaction.reply({ content: '📋 Henüz hazır yanıt yok.', ephemeral: true });
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('💬 Hazır Yanıtlar')
                .setDescription(responses.map(r => `• **${r.name}** (${r.useCount} kullanım)`).join('\n'));
            await interaction.reply({ embeds: [embed], ephemeral: true });
        } else if (sub === 'use') {
            const name = interaction.options.getString('isim');
            const canned = await cannedDB.get(interaction.guild.id, name);
            if (!canned) return interaction.reply({ content: '❌ Yanıt bulunamadı!', ephemeral: true });
            await cannedDB.incrementUse(interaction.guild.id, name);
            await interaction.reply({ content: canned.content });
        }
    },
};
