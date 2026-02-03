import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { cannedDB, guildDB } from '../../utils/database.js';
import { isStaff } from '../../utils/ticketManager.js';
import { t } from '../../utils/i18n.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('canned')
        .setDescription('Hazır yanıtları yönet ve kullan')
        .addSubcommand(s => s.setName('use').setDescription('Hazır yanıt kullan')
            .addStringOption(o => o.setName('isim').setDescription('Yanıt ismi').setRequired(true).setAutocomplete(true)))
        .addSubcommand(s => s.setName('create').setDescription('Yeni hazır yanıt oluştur')
            .addStringOption(o => o.setName('isim').setDescription('Yanıt ismi').setRequired(true))
            .addStringOption(o => o.setName('içerik').setDescription('Yanıt içeriği').setRequired(true)))
        .addSubcommand(s => s.setName('delete').setDescription('Hazır yanıt sil')
            .addStringOption(o => o.setName('isim').setDescription('Yanıt ismi').setRequired(true).setAutocomplete(true)))
        .addSubcommand(s => s.setName('list').setDescription('Hazır yanıtları listele')),

    async autocomplete(interaction) {
        const responses = await cannedDB.getAll(interaction.guild.id);
        const focused = interaction.options.getFocused().toLowerCase();
        await interaction.respond(responses.filter(r => r.name.toLowerCase().includes(focused)).slice(0, 25).map(r => ({ name: r.name, value: r.name })));
    },

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        try {
            const config = await guildDB.get(interaction.guild.id);
            if (!isStaff(interaction.member, config)) {
                return interaction.reply({ content: t(interaction.guild.id, 'staffOnly'), ephemeral: true });
            }

            if (sub === 'use') {
                const name = interaction.options.getString('isim');
                const response = await cannedDB.get(interaction.guild.id, name);
                if (!response) return interaction.reply({ content: t(interaction.guild.id, 'cannedNotFound', { name }), ephemeral: true });

                await cannedDB.incrementUse(response.id);
                await interaction.reply({ content: response.content });
            }
            else if (sub === 'create') {
                await interaction.deferReply({ ephemeral: true });
                const name = interaction.options.getString('isim').toLowerCase();
                const content = interaction.options.getString('içerik');

                const existing = await cannedDB.get(interaction.guild.id, name);
                if (existing) return interaction.editReply({ content: '❌ Bu isimde bir yanıt zaten var!' });

                await cannedDB.create(interaction.guild.id, name, content, interaction.user.id, interaction.user.tag);
                await interaction.editReply({ content: t(interaction.guild.id, 'cannedCreated', { name }) });
            }
            else if (sub === 'delete') {
                await interaction.deferReply({ ephemeral: true });
                const name = interaction.options.getString('isim');
                const response = await cannedDB.get(interaction.guild.id, name);
                if (!response) return interaction.editReply({ content: t(interaction.guild.id, 'cannedNotFound', { name }) });

                await cannedDB.delete(response.id);
                await interaction.editReply({ content: t(interaction.guild.id, 'cannedDeleted', { name }) });
            }
            else if (sub === 'list') {
                await interaction.deferReply({ ephemeral: true });
                const responses = await cannedDB.getAll(interaction.guild.id);
                if (!responses.length) return interaction.editReply({ content: '📝 Hazır yanıt yok.' });

                const embed = new EmbedBuilder().setColor('#5865F2').setTitle('📝 Hazır Yanıtlar')
                    .setDescription(responses.map(r => `**${r.name}** - ${r.useCount} kullanım`).join('\n'))
                    .setFooter({ text: `/canned use <isim> ile kullanın` });
                await interaction.editReply({ embeds: [embed] });
            }
        } catch (error) {
            logger.error('Canned error:', error);
            if (interaction.deferred) await interaction.editReply({ content: '❌ Hata!' });
            else await interaction.reply({ content: '❌ Hata!', ephemeral: true });
        }
    },
};
