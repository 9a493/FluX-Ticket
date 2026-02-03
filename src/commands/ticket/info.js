import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ticketDB } from '../../utils/database.js';
import { formatDuration } from '../../utils/ticketManager.js';
import { t } from '../../utils/i18n.js';
import logger from '../../utils/logger.js';

const BASE_URL = process.env.BASE_URL || 'https://fluxdigital.com.tr';

const priorities = { 1: '🟢 Düşük', 2: '🟡 Orta', 3: '🟠 Yüksek', 4: '🔴 Acil' };
const statuses = { open: '🟢 Açık', claimed: '🟡 Sahiplenildi', closed: '🔴 Kapalı', archived: '📦 Arşivlenmiş' };

export default {
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('Ticket bilgilerini görüntüle'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const ticket = await ticketDB.get(interaction.channel.id);
            if (!ticket) return interaction.editReply({ content: t(interaction.guild.id, 'ticketChannelOnly') });

            const num = ticket.ticketNumber.toString().padStart(4, '0');
            const duration = formatDuration(Date.now() - new Date(ticket.createdAt).getTime());

            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle(`📋 Ticket #${num}`)
                .addFields(
                    { name: '👤 Açan', value: `<@${ticket.userId}>`, inline: true },
                    { name: '📊 Durum', value: statuses[ticket.status] || ticket.status, inline: true },
                    { name: '⚡ Öncelik', value: priorities[ticket.priority] || 'Belirsiz', inline: true },
                    { name: '📅 Açılış', value: `<t:${Math.floor(new Date(ticket.createdAt).getTime() / 1000)}:F>`, inline: true },
                    { name: '⏱️ Süre', value: duration, inline: true },
                    { name: '💬 Mesaj', value: `${ticket.messageCount}`, inline: true },
                )
                .setTimestamp();

            if (ticket.category) {
                embed.addFields({ name: '📁 Kategori', value: `${ticket.category.emoji || '🎫'} ${ticket.category.name}`, inline: true });
            }

            if (ticket.claimedBy) {
                embed.addFields(
                    { name: '👮 Sahiplenen', value: `<@${ticket.claimedBy}>`, inline: true },
                    { name: '📅 Sahiplenme', value: ticket.claimedAt ? `<t:${Math.floor(new Date(ticket.claimedAt).getTime() / 1000)}:R>` : 'Bilinmiyor', inline: true },
                );
            }

            if (ticket.tags) {
                embed.addFields({ name: '🏷️ Etiketler', value: ticket.tags.split(',').filter(t => t).map(t => `\`${t}\``).join(', ') || 'Yok', inline: false });
            }

            if (ticket.subject) {
                embed.addFields({ name: '📝 Konu', value: ticket.subject, inline: false });
            }

            if (ticket.rating) {
                embed.addFields({ name: '⭐ Değerlendirme', value: `${'⭐'.repeat(ticket.rating)}☆ (${ticket.rating}/5)`, inline: true });
            }

            if (ticket.scheduledCloseAt) {
                embed.addFields({ name: '⏰ Zamanlanmış Kapatma', value: `<t:${Math.floor(new Date(ticket.scheduledCloseAt).getTime() / 1000)}:R>`, inline: true });
            }

            embed.setFooter({ text: `ID: ${ticket.id}` });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            logger.error('Info error:', error);
            await interaction.editReply({ content: '❌ Hata!' });
        }
    },
};
