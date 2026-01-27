import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { ticketDB } from '../../utils/database.js';
import { logAudit, AuditActions, TargetTypes } from '../../utils/auditLog.js';

export default {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Ticketten kullanıcı çıkar')
        .addUserOption(o => o.setName('kullanıcı').setDescription('Çıkarılacak kullanıcı').setRequired(true)),

    async execute(interaction) {
        const ticket = await ticketDB.get(interaction.channel.id);
        if (!ticket) return interaction.reply({ content: '❌ Bu bir ticket kanalı değil!', ephemeral: true });

        const user = interaction.options.getUser('kullanıcı');
        if (user.id === ticket.userId) return interaction.reply({ content: '❌ Ticket sahibini çıkaramazsınız!', ephemeral: true });

        await interaction.channel.permissionOverwrites.delete(user.id);

        await logAudit({
            guildId: interaction.guild.id,
            action: AuditActions.USER_REMOVE,
            targetType: TargetTypes.TICKET,
            targetId: ticket.id,
            userId: interaction.user.id,
            userName: interaction.user.tag,
            details: `Removed ${user.tag}`,
        });

        const embed = new EmbedBuilder()
            .setColor('#ED4245')
            .setDescription(`✅ ${user} ticketten çıkarıldı.`);
        await interaction.reply({ embeds: [embed] });
    },
};
