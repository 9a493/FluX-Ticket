import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ticketDB, guildDB } from '../../utils/database.js';
import { isStaff } from '../../utils/ticketManager.js';
import { t } from '../../utils/i18n.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('tag')
        .setDescription('Ticket etiketlerini yönet')
        .addSubcommand(s => s.setName('add').setDescription('Etiket ekle')
            .addStringOption(o => o.setName('etiket').setDescription('Etiket adı').setRequired(true)))
        .addSubcommand(s => s.setName('remove').setDescription('Etiket kaldır')
            .addStringOption(o => o.setName('etiket').setDescription('Etiket adı').setRequired(true).setAutocomplete(true)))
        .addSubcommand(s => s.setName('list').setDescription('Etiketleri listele')),

    async autocomplete(interaction) {
        const ticket = await ticketDB.get(interaction.channel.id);
        if (!ticket?.tags) return interaction.respond([]);
        const tags = ticket.tags.split(',').filter(t => t);
        const focused = interaction.options.getFocused().toLowerCase();
        await interaction.respond(tags.filter(t => t.toLowerCase().includes(focused)).slice(0, 25).map(t => ({ name: t, value: t })));
    },

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        await interaction.deferReply({ ephemeral: true });

        try {
            const ticket = await ticketDB.get(interaction.channel.id);
            if (!ticket) return interaction.editReply({ content: t(interaction.guild.id, 'ticketChannelOnly') });

            const config = await guildDB.get(interaction.guild.id);
            if (!isStaff(interaction.member, config)) return interaction.editReply({ content: t(interaction.guild.id, 'staffOnly') });

            const currentTags = ticket.tags ? ticket.tags.split(',').filter(t => t) : [];

            if (sub === 'add') {
                const tag = interaction.options.getString('etiket').toLowerCase();
                if (currentTags.length >= 10) return interaction.editReply({ content: '❌ Maksimum 10 etiket eklenebilir!' });
                if (currentTags.includes(tag)) return interaction.editReply({ content: '❌ Bu etiket zaten var!' });
                await ticketDB.addTag(interaction.channel.id, tag);
                await interaction.editReply({ content: `✅ Etiket eklendi: \`${tag}\`` });
            }
            else if (sub === 'remove') {
                const tag = interaction.options.getString('etiket');
                if (!currentTags.includes(tag)) return interaction.editReply({ content: '❌ Bu etiket yok!' });
                await ticketDB.removeTag(interaction.channel.id, tag);
                await interaction.editReply({ content: `🗑️ Etiket kaldırıldı: \`${tag}\`` });
            }
            else if (sub === 'list') {
                if (!currentTags.length) return interaction.editReply({ content: '🏷️ Etiket yok.' });
                await interaction.editReply({ content: `🏷️ Etiketler: ${currentTags.map(t => `\`${t}\``).join(', ')}` });
            }
        } catch (error) {
            logger.error('Tag error:', error);
            await interaction.editReply({ content: '❌ Hata!' });
        }
    },
};
