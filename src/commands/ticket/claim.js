import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ticketDB, guildDB, staffDB } from '../../utils/database.js';
import { isStaffMember } from '../../utils/ticketManager.js';
import { recordFirstResponse } from '../../utils/sla.js';
import { addXP, XP_REWARDS } from '../../utils/gamification.js';
import { logAudit, AuditActions, TargetTypes } from '../../utils/auditLog.js';

export default {
    data: new SlashCommandBuilder()
        .setName('claim')
        .setDescription('Ticketi sahiplen'),

    async execute(interaction) {
        const ticket = await ticketDB.get(interaction.channel.id);
        if (!ticket) return interaction.reply({ content: '❌ Bu bir ticket kanalı değil!', ephemeral: true });

        const guildConfig = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);
        if (!isStaffMember(interaction.member, guildConfig)) {
            return interaction.reply({ content: '❌ Sadece yetkililer ticket sahiplenebilir!', ephemeral: true });
        }

        if (ticket.claimedBy) {
            return interaction.reply({ content: `❌ Bu ticket zaten <@${ticket.claimedBy}> tarafından sahiplenilmiş!`, ephemeral: true });
        }

        await ticketDB.claim(interaction.channel.id, interaction.user.id);
        await recordFirstResponse(interaction.channel.id);
        await addXP(interaction.guild.id, interaction.user.id, XP_REWARDS.CLAIM_TICKET, 'Ticket sahiplenme');
        await staffDB.incrementStats(interaction.guild.id, interaction.user.id, 'ticketsClaimed');

        await logAudit({
            guildId: interaction.guild.id,
            action: AuditActions.TICKET_CLAIM,
            targetType: TargetTypes.TICKET,
            targetId: ticket.id,
            userId: interaction.user.id,
            userName: interaction.user.tag,
        });

        const embed = new EmbedBuilder()
            .setColor('#57F287')
            .setDescription(`✅ Ticket ${interaction.user} tarafından sahiplenildi.`);
        await interaction.reply({ embeds: [embed] });
    },
};
