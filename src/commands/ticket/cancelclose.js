import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ticketDB, guildDB } from '../../utils/database.js';
import { isStaff } from '../../utils/ticketManager.js';
import { cancelScheduledClose } from '../../utils/scheduler.js';
import { t } from '../../utils/i18n.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('cancelclose')
        .setDescription('Zamanlanmış kapatmayı iptal et'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const ticket = await ticketDB.get(interaction.channel.id);
            if (!ticket) return interaction.editReply({ content: t(interaction.guild.id, 'ticketChannelOnly') });
            if (!ticket.scheduledCloseAt) return interaction.editReply({ content: '❌ Bu ticket için zamanlanmış kapatma yok!' });

            const config = await guildDB.get(interaction.guild.id);
            if (!isStaff(interaction.member, config) && ticket.userId !== interaction.user.id) {
                return interaction.editReply({ content: t(interaction.guild.id, 'staffOnly') });
            }

            // Scheduler'dan kaldır
            cancelScheduledClose(interaction.channel.id);

            // Database'den temizle
            await ticketDB.update(interaction.channel.id, {
                scheduledCloseAt: null,
                scheduledCloseBy: null,
                scheduledCloseReason: null,
            });

            const embed = new EmbedBuilder().setColor('#57F287')
                .setDescription(t(interaction.guild.id, 'scheduleCancelled'))
                .setFooter({ text: `${interaction.user.tag}` }).setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            logger.error('Cancelclose error:', error);
            await interaction.editReply({ content: '❌ Hata!' });
        }
    },
};
