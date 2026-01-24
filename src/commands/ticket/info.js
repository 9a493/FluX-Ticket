import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ticketDB } from '../../utils/database.js';
import { formatDuration } from '../../utils/ticketManager.js';
import logger from '../../utils/logger.js';

const PRIORITY_NAMES = {
    1: '🟢 Düşük',
    2: '🟡 Orta',
    3: '🟠 Yüksek',
    4: '🔴 Acil',
};

const STATUS_NAMES = {
    'open': '🟢 Açık',
    'claimed': '🟡 Sahiplenildi',
    'closed': '🔴 Kapalı',
};

export default {
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('Ticket bilgilerini gösterir'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const channel = interaction.channel;

        try {
            // Bu bir ticket kanalı mı?
            const ticket = await ticketDB.get(channel.id);
            if (!ticket) {
                return interaction.editReply({
                    content: '❌ Bu komut sadece ticket kanallarında kullanılabilir!',
                });
            }

            const ticketNumber = ticket.ticketNumber.toString().padStart(4, '0');
            const createdAt = new Date(ticket.createdAt);
            const duration = formatDuration(Date.now() - createdAt.getTime());

            // Ana embed
            const embed = new EmbedBuilder()
                .setColor(ticket.priority >= 3 ? '#ED4245' : '#5865F2')
                .setTitle(`📋 Ticket #${ticketNumber} Bilgileri`)
                .addFields(
                    { name: '👤 Açan', value: `<@${ticket.userId}>`, inline: true },
                    { name: '📊 Durum', value: STATUS_NAMES[ticket.status] || ticket.status, inline: true },
                    { name: '🎯 Öncelik', value: PRIORITY_NAMES[ticket.priority] || PRIORITY_NAMES[1], inline: true },
                    { name: '📅 Açılış Tarihi', value: `<t:${Math.floor(createdAt.getTime() / 1000)}:F>`, inline: true },
                    { name: '⏱️ Açık Kalma Süresi', value: duration, inline: true },
                    { name: '💬 Mesaj Sayısı', value: `${ticket.messageCount}`, inline: true },
                )
                .setTimestamp();

            // Kategori
            if (ticket.category) {
                embed.addFields({
                    name: '📁 Kategori',
                    value: `${ticket.category.emoji || '🎫'} ${ticket.category.name}`,
                    inline: true,
                });
            }

            // Sahiplenen
            if (ticket.claimedBy) {
                embed.addFields({
                    name: '👮 Sahiplenen',
                    value: `<@${ticket.claimedBy}>`,
                    inline: true,
                });
            }

            if (ticket.claimedAt) {
                embed.addFields({
                    name: '🕐 Sahiplenme Zamanı',
                    value: `<t:${Math.floor(new Date(ticket.claimedAt).getTime() / 1000)}:R>`,
                    inline: true,
                });
            }

            // Etiketler
            if (ticket.tags) {
                const tags = ticket.tags.split(',').filter(t => t);
                if (tags.length > 0) {
                    embed.addFields({
                        name: '🏷️ Etiketler',
                        value: tags.map(t => `\`${t}\``).join(' '),
                        inline: false,
                    });
                }
            }

            // Son aktivite
            if (ticket.lastActivity) {
                embed.addFields({
                    name: '🕐 Son Aktivite',
                    value: `<t:${Math.floor(new Date(ticket.lastActivity).getTime() / 1000)}:R>`,
                    inline: true,
                });
            }

            // Rating (kapalı ticketlar için)
            if (ticket.status === 'closed' && ticket.rating) {
                const stars = '⭐'.repeat(ticket.rating) + '☆'.repeat(5 - ticket.rating);
                embed.addFields({
                    name: '⭐ Değerlendirme',
                    value: `${ticket.rating}/5 ${stars}`,
                    inline: true,
                });
            }

            // Transcript
            if (ticket.transcriptUrl) {
                embed.addFields({
                    name: '📄 Transcript',
                    value: `[Görüntüle](${ticket.transcriptUrl})`,
                    inline: true,
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error('Info command hatası:', error);
            await interaction.editReply({
                content: '❌ Ticket bilgileri alınırken bir hata oluştu!',
            });
        }
    },
};
