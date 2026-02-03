import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ticketDB, guildDB } from '../../utils/database.js';
import { isStaff } from '../../utils/ticketManager.js';
import { t } from '../../utils/i18n.js';
import logger from '../../utils/logger.js';

const priorities = {
    1: { name: 'Düşük', emoji: '🟢' },
    2: { name: 'Orta', emoji: '🟡' },
    3: { name: 'Yüksek', emoji: '🟠' },
    4: { name: 'Acil', emoji: '🔴' },
};

export default {
    data: new SlashCommandBuilder()
        .setName('priority')
        .setDescription('Ticket önceliğini belirle')
        .addIntegerOption(o => o.setName('seviye').setDescription('Öncelik seviyesi').setRequired(true).addChoices(
            { name: '🟢 Düşük', value: 1 },
            { name: '🟡 Orta', value: 2 },
            { name: '🟠 Yüksek', value: 3 },
            { name: '🔴 Acil', value: 4 },
        )),

    async execute(interaction) {
        await interaction.deferReply();
        const level = interaction.options.getInteger('seviye');

        try {
            const ticket = await ticketDB.get(interaction.channel.id);
            if (!ticket) return interaction.editReply({ content: t(interaction.guild.id, 'ticketChannelOnly') });

            const config = await guildDB.get(interaction.guild.id);
            if (!isStaff(interaction.member, config)) return interaction.editReply({ content: t(interaction.guild.id, 'staffOnly') });

            const oldPriority = priorities[ticket.priority];
            const newPriority = priorities[level];

            await ticketDB.setPriority(interaction.channel.id, level);

            // Öncelik yüksekse kanal adını güncelle
            const num = ticket.ticketNumber.toString().padStart(4, '0');
            if (level >= 3) {
                await interaction.channel.setName(`${newPriority.emoji}-ticket-${num}`).catch(() => {});
            }

            await interaction.channel.setTopic(`Ticket #${num} | Öncelik: ${newPriority.emoji} ${newPriority.name}`).catch(() => {});

            const embed = new EmbedBuilder().setColor(level >= 3 ? '#ED4245' : '#5865F2')
                .setDescription(`Öncelik değiştirildi: ${oldPriority.emoji} ${oldPriority.name} → ${newPriority.emoji} ${newPriority.name}`)
                .setFooter({ text: `${interaction.user.tag}` }).setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            logger.error('Priority error:', error);
            await interaction.editReply({ content: '❌ Hata!' });
        }
    },
};
