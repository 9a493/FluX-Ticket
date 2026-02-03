import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { ticketDB, guildDB } from '../../utils/database.js';
import { isStaff } from '../../utils/ticketManager.js';
import { t } from '../../utils/i18n.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('unclaim')
        .setDescription('Ticket sahipliğinden vazgeç'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const ticket = await ticketDB.get(interaction.channel.id);
            if (!ticket) return interaction.editReply({ content: t(interaction.guild.id, 'ticketChannelOnly') });
            if (ticket.status !== 'claimed') return interaction.editReply({ content: t(interaction.guild.id, 'notClaimed') });

            const config = await guildDB.get(interaction.guild.id);
            if (ticket.claimedBy !== interaction.user.id && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.editReply({ content: '❌ Bu ticketı sadece sahiplenen kişi veya admin bırakabilir!' });
            }

            await ticketDB.unclaim(interaction.channel.id);

            const num = ticket.ticketNumber.toString().padStart(4, '0');
            await interaction.channel.setName(`ticket-${num}`).catch(() => {});

            const embed = new EmbedBuilder().setColor('#FEE75C').setTitle(t(interaction.guild.id, 'unclaimSuccess'))
                .setDescription(t(interaction.guild.id, 'unclaimSuccessDesc', { user: interaction.user.toString() })).setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            logger.error('Unclaim error:', error);
            await interaction.editReply({ content: '❌ Hata!' });
        }
    },
};
