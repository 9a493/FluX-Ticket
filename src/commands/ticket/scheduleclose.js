import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ticketDB, guildDB } from '../../utils/database.js';
import { isStaff } from '../../utils/ticketManager.js';
import { scheduleClose } from '../../utils/scheduler.js';
import { t } from '../../utils/i18n.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('scheduleclose')
        .setDescription('Ticketı zamanlanmış kapatmaya ayarla')
        .addStringOption(o => o.setName('süre').setDescription('Süre (örn: 1h, 30m, 2d)').setRequired(true))
        .addStringOption(o => o.setName('sebep').setDescription('Kapatma sebebi')),

    async execute(interaction) {
        await interaction.deferReply();
        const timeStr = interaction.options.getString('süre');
        const reason = interaction.options.getString('sebep');

        try {
            const ticket = await ticketDB.get(interaction.channel.id);
            if (!ticket) return interaction.editReply({ content: t(interaction.guild.id, 'ticketChannelOnly') });
            if (ticket.status === 'closed') return interaction.editReply({ content: '❌ Bu ticket zaten kapalı!' });

            const config = await guildDB.get(interaction.guild.id);
            if (!isStaff(interaction.member, config) && ticket.userId !== interaction.user.id) {
                return interaction.editReply({ content: t(interaction.guild.id, 'staffOnly') });
            }

            // Süreyi parse et
            const match = timeStr.match(/^(\d+)(m|h|d)$/i);
            if (!match) return interaction.editReply({ content: '❌ Geçersiz süre formatı! Örnek: 1h, 30m, 2d' });

            const amount = parseInt(match[1]);
            const unit = match[2].toLowerCase();

            let ms = 0;
            if (unit === 'm') ms = amount * 60 * 1000;
            else if (unit === 'h') ms = amount * 60 * 60 * 1000;
            else if (unit === 'd') ms = amount * 24 * 60 * 60 * 1000;

            if (ms < 60000) return interaction.editReply({ content: '❌ Minimum süre 1 dakikadır!' });
            if (ms > 7 * 24 * 60 * 60 * 1000) return interaction.editReply({ content: '❌ Maksimum süre 7 gündür!' });

            const closeTime = new Date(Date.now() + ms);

            // Database'e kaydet
            await ticketDB.update(interaction.channel.id, {
                scheduledCloseAt: closeTime,
                scheduledCloseBy: interaction.user.id,
                scheduledCloseReason: reason,
            });

            // Scheduler'a ekle
            scheduleClose(interaction.channel.id, closeTime, interaction.user.id, reason);

            const embed = new EmbedBuilder().setColor('#FEE75C').setTitle('⏰ Zamanlanmış Kapatma')
                .setDescription(`Bu ticket <t:${Math.floor(closeTime.getTime() / 1000)}:R> otomatik olarak kapatılacak.`)
                .addFields(
                    { name: '⏱️ Süre', value: timeStr, inline: true },
                    { name: '📅 Kapatılacak', value: `<t:${Math.floor(closeTime.getTime() / 1000)}:F>`, inline: true },
                )
                .setFooter({ text: `${interaction.user.tag} • /cancelclose ile iptal edebilirsiniz` }).setTimestamp();

            if (reason) embed.addFields({ name: '📋 Sebep', value: reason, inline: false });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            logger.error('Scheduleclose error:', error);
            await interaction.editReply({ content: '❌ Hata!' });
        }
    },
};
