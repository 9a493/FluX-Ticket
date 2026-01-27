import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { ticketDB, guildDB } from '../../utils/database.js';
import { logAudit, AuditActions, TargetTypes } from '../../utils/auditLog.js';

export default {
    data: new SlashCommandBuilder()
        .setName('merge')
        .setDescription('İki ticketi birleştirir')
        .addStringOption(o => o.setName('hedef').setDescription('Hedef ticket kanal ID').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        const ticket = await ticketDB.get(interaction.channel.id);
        if (!ticket) return interaction.reply({ content: '❌ Bu komut sadece ticket kanallarında!', ephemeral: true });
        
        const targetChannelId = interaction.options.getString('hedef');
        const targetTicket = await ticketDB.get(targetChannelId);
        
        if (!targetTicket) return interaction.reply({ content: '❌ Hedef ticket bulunamadı!', ephemeral: true });
        if (targetTicket.status === 'closed') return interaction.reply({ content: '❌ Hedef ticket kapalı!', ephemeral: true });
        
        await ticketDB.merge(interaction.channel.id, targetChannelId);
        
        await logAudit({
            guildId: interaction.guild.id,
            action: AuditActions.TICKET_MERGE,
            targetType: TargetTypes.TICKET,
            targetId: ticket.id,
            userId: interaction.user.id,
            userName: interaction.user.tag,
            details: `Merged into ticket #${targetTicket.ticketNumber}`,
        });
        
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🔗 Ticket Birleştirildi')
            .setDescription(`Bu ticket **#${targetTicket.ticketNumber.toString().padStart(4, '0')}** ile birleştirildi.\nBu kanal 10 saniye içinde silinecek.`)
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
        
        const targetChannel = await interaction.guild.channels.fetch(targetChannelId).catch(() => null);
        if (targetChannel) {
            await targetChannel.send({
                embeds: [new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle('🔗 Ticket Birleştirildi')
                    .setDescription(`**#${ticket.ticketNumber.toString().padStart(4, '0')}** bu ticket ile birleştirildi.`)
                ],
            });
        }
        
        setTimeout(() => interaction.channel.delete().catch(() => {}), 10000);
    },
};
