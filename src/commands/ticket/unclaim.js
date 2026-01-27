import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ticketDB } from '../../utils/database.js';
import { logAudit, AuditActions, TargetTypes } from '../../utils/auditLog.js';

export default {
    data: new SlashCommandBuilder()
        .setName('unclaim')
        .setDescription('Ticket sahipliğini bırak'),

    async execute(interaction) {
        const ticket = await ticketDB.get(interaction.channel.id);
        if (!ticket) return interaction.reply({ content: '❌ Bu bir ticket kanalı değil!', ephemeral: true });

        if (!ticket.claimedBy) return interaction.reply({ content: '❌ Bu ticket sahiplenilmemiş!', ephemeral: true });
        if (ticket.claimedBy !== interaction.user.id && !interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ content: '❌ Bu ticketı sadece sahibi bırakabilir!', ephemeral: true });
        }

        await ticketDB.unclaim(interaction.channel.id);
        await logAudit({
            guildId: interaction.guild.id,
            action: AuditActions.TICKET_UNCLAIM,
            targetType: TargetTypes.TICKET,
            targetId: ticket.id,
            userId: interaction.user.id,
            userName: interaction.user.tag,
        });

        const embed = new EmbedBuilder()
            .setColor('#FEE75C')
            .setDescription('✅ Ticket sahipliği bırakıldı. Artık herkes sahiplenebilir.');
        await interaction.reply({ embeds: [embed] });
    },
};
