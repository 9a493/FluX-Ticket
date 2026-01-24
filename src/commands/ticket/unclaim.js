import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ticketDB, guildDB } from '../../utils/database.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('unclaim')
        .setDescription('Ticket sahipliğinden vazgeçer'),

    async execute(interaction) {
        await interaction.deferReply();

        const channel = interaction.channel;
        const member = interaction.member;

        try {
            // Bu bir ticket kanalı mı?
            const ticket = await ticketDB.get(channel.id);
            if (!ticket) {
                return interaction.editReply({
                    content: '❌ Bu komut sadece ticket kanallarında kullanılabilir!',
                });
            }

            // Ticket claim edilmemiş mi?
            if (ticket.status !== 'claimed') {
                return interaction.editReply({
                    content: '❌ Bu ticket henüz sahiplenilmemiş!',
                });
            }

            // Sadece sahiplenen kişi veya admin unclaim yapabilir
            if (ticket.claimedBy !== member.id && !member.permissions.has('Administrator')) {
                return interaction.editReply({
                    content: `❌ Bu ticketı sadece <@${ticket.claimedBy}> veya yöneticiler bırakabilir!`,
                });
            }

            // Unclaim yap
            await ticketDB.unclaim(channel.id);

            // Kanal adını güncelle
            const ticketNumber = ticket.ticketNumber.toString().padStart(4, '0');
            await channel.setName(`ticket-${ticketNumber}`);

            // Bilgilendirme mesajı
            const embed = new EmbedBuilder()
                .setColor('#FEE75C')
                .setTitle('🔓 Ticket Serbest Bırakıldı')
                .setDescription(
                    `${interaction.user} bu ticketın sahipliğinden vazgeçti.\n\n` +
                    `Bu ticket artık herhangi bir yetkili tarafından sahiplenebilir.`
                )
                .addFields(
                    { name: '📝 Ticket', value: `#${ticketNumber}`, inline: true },
                    { name: '👤 Bırakan', value: `${interaction.user}`, inline: true },
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            logger.info(`Ticket #${ticket.ticketNumber} unclaimed by ${interaction.user.tag}`);

        } catch (error) {
            logger.error('Unclaim command hatası:', error);
            await interaction.editReply({
                content: '❌ Ticket sahipliği bırakılırken bir hata oluştu!',
            });
        }
    },
};
