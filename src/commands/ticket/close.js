import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ticketDB, guildDB, staffDB } from '../../utils/database.js';
import { addXP, XP_REWARDS } from '../../utils/gamification.js';
import { logAudit, AuditActions, TargetTypes } from '../../utils/auditLog.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('close')
        .setDescription('Ticketi kapatır')
        .addStringOption(o => o.setName('sebep').setDescription('Kapatma sebebi'))
        .addIntegerOption(o => o.setName('süre').setDescription('X dakika sonra kapat').setMinValue(1).setMaxValue(60)),

    async execute(interaction) {
        const ticket = await ticketDB.get(interaction.channel.id);
        if (!ticket) return interaction.reply({ content: '❌ Bu bir ticket kanalı değil!', ephemeral: true });

        const reason = interaction.options.getString('sebep');
        const delay = interaction.options.getInteger('süre');

        if (delay) {
            await ticketDB.update(interaction.channel.id, {
                scheduledCloseAt: new Date(Date.now() + delay * 60 * 1000),
                scheduledCloseBy: interaction.user.id,
                scheduledCloseReason: reason,
            });
            return interaction.reply({ content: `⏱️ Ticket ${delay} dakika sonra kapatılacak.` });
        }

        await interaction.deferReply();
        await ticketDB.close(interaction.channel.id, interaction.user.id, reason);

        if (ticket.claimedBy) {
            await addXP(interaction.guild.id, ticket.claimedBy, XP_REWARDS.CLOSE_TICKET, 'Ticket kapatma');
            await staffDB.incrementStats(interaction.guild.id, ticket.claimedBy, 'ticketsClosed');
        }

        await logAudit({
            guildId: interaction.guild.id,
            action: AuditActions.TICKET_CLOSE,
            targetType: TargetTypes.TICKET,
            targetId: ticket.id,
            userId: interaction.user.id,
            userName: interaction.user.tag,
            details: reason,
        });

        const embed = new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('🔒 Ticket Kapatıldı')
            .setDescription(reason ? `Sebep: ${reason}` : 'Ticket kapatıldı.')
            .addFields({ name: '👤 Kapatan', value: `${interaction.user}`, inline: true })
            .setFooter({ text: 'Kanal 30 saniye sonra silinecek' });

        await interaction.editReply({ embeds: [embed] });
        setTimeout(() => interaction.channel.delete().catch(() => {}), 30000);
    },
};
