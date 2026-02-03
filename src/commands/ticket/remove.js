import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ticketDB, guildDB } from '../../utils/database.js';
import { isStaff } from '../../utils/ticketManager.js';
import { t } from '../../utils/i18n.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Kullanıcıyı tickettan çıkar')
        .addUserOption(o => o.setName('kullanıcı').setDescription('Çıkarılacak kullanıcı').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();
        const user = interaction.options.getUser('kullanıcı');

        try {
            const ticket = await ticketDB.get(interaction.channel.id);
            if (!ticket) return interaction.editReply({ content: t(interaction.guild.id, 'ticketChannelOnly') });
            if (user.id === ticket.userId) return interaction.editReply({ content: t(interaction.guild.id, 'cannotRemoveOwner') });

            const config = await guildDB.get(interaction.guild.id);
            if (!isStaff(interaction.member, config)) return interaction.editReply({ content: t(interaction.guild.id, 'staffOnly') });

            await interaction.channel.permissionOverwrites.delete(user.id);

            const embed = new EmbedBuilder().setColor('#ED4245')
                .setDescription(t(interaction.guild.id, 'userRemoved', { user: user.toString() })).setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            logger.error('Remove error:', error);
            await interaction.editReply({ content: '❌ Hata!' });
        }
    },
};
