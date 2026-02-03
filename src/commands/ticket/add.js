import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { ticketDB, guildDB } from '../../utils/database.js';
import { isStaff } from '../../utils/ticketManager.js';
import { t } from '../../utils/i18n.js';
import { notifyUserAdded } from '../../utils/notifications.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('add')
        .setDescription('Kullanıcıyı ticketa ekle')
        .addUserOption(o => o.setName('kullanıcı').setDescription('Eklenecek kullanıcı').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();
        const user = interaction.options.getUser('kullanıcı');

        try {
            const ticket = await ticketDB.get(interaction.channel.id);
            if (!ticket) return interaction.editReply({ content: t(interaction.guild.id, 'ticketChannelOnly') });

            const config = await guildDB.get(interaction.guild.id);
            if (!isStaff(interaction.member, config) && ticket.userId !== interaction.user.id) {
                return interaction.editReply({ content: t(interaction.guild.id, 'staffOnly') });
            }

            await interaction.channel.permissionOverwrites.edit(user.id, {
                ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true,
            });

            await notifyUserAdded(interaction.client, ticket, interaction.guild, user, interaction.user);

            const embed = new EmbedBuilder().setColor('#57F287')
                .setDescription(t(interaction.guild.id, 'userAdded', { user: user.toString() })).setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            logger.error('Add error:', error);
            await interaction.editReply({ content: '❌ Hata!' });
        }
    },
};
