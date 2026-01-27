import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { ticketDB } from '../../utils/database.js';
import { logAudit, AuditActions, TargetTypes } from '../../utils/auditLog.js';

export default {
    data: new SlashCommandBuilder()
        .setName('add')
        .setDescription('Tickete kullanıcı ekle')
        .addUserOption(o => o.setName('kullanıcı').setDescription('Eklenecek kullanıcı').setRequired(true)),

    async execute(interaction) {
        const ticket = await ticketDB.get(interaction.channel.id);
        if (!ticket) return interaction.reply({ content: '❌ Bu bir ticket kanalı değil!', ephemeral: true });

        const user = interaction.options.getUser('kullanıcı');
        await interaction.channel.permissionOverwrites.edit(user.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
        });

        await logAudit({
            guildId: interaction.guild.id,
            action: AuditActions.USER_ADD,
            targetType: TargetTypes.TICKET,
            targetId: ticket.id,
            userId: interaction.user.id,
            userName: interaction.user.tag,
            details: `Added ${user.tag}`,
        });

        const embed = new EmbedBuilder()
            .setColor('#57F287')
            .setDescription(`✅ ${user} tickete eklendi.`);
        await interaction.reply({ embeds: [embed] });
    },
};
