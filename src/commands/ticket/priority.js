import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ticketDB } from '../../utils/database.js';
import { logAudit, AuditActions, TargetTypes } from '../../utils/auditLog.js';

export default {
    data: new SlashCommandBuilder()
        .setName('priority')
        .setDescription('Ticket önceliğini değiştir')
        .addIntegerOption(o => o.setName('seviye').setDescription('Öncelik seviyesi').setRequired(true)
            .addChoices(
                { name: '🔴 Acil', value: 4 },
                { name: '🟠 Yüksek', value: 3 },
                { name: '🟡 Normal', value: 2 },
                { name: '🟢 Düşük', value: 1 },
            )),

    async execute(interaction) {
        const ticket = await ticketDB.get(interaction.channel.id);
        if (!ticket) return interaction.reply({ content: '❌ Bu bir ticket kanalı değil!', ephemeral: true });

        const priority = interaction.options.getInteger('seviye');
        const oldPriority = ticket.priority;
        await ticketDB.setPriority(interaction.channel.id, priority);

        const names = { 1: '🟢 Düşük', 2: '🟡 Normal', 3: '🟠 Yüksek', 4: '🔴 Acil' };

        await logAudit({
            guildId: interaction.guild.id,
            action: AuditActions.TICKET_PRIORITY,
            targetType: TargetTypes.TICKET,
            targetId: ticket.id,
            userId: interaction.user.id,
            userName: interaction.user.tag,
            oldValue: { priority: oldPriority },
            newValue: { priority },
        });

        // Kanal adını güncelle (acil ise)
        if (priority === 4) {
            const num = ticket.ticketNumber.toString().padStart(4, '0');
            await interaction.channel.setName(`🔴-urgent-${num}`).catch(() => {});
        }

        const embed = new EmbedBuilder()
            .setColor(priority === 4 ? '#ED4245' : '#5865F2')
            .setDescription(`✅ Öncelik **${names[priority]}** olarak değiştirildi.`);
        await interaction.reply({ embeds: [embed] });
    },
};
