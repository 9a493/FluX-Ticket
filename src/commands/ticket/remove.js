import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ticketDB } from '../../utils/database.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Ticket\'tan kullanıcı çıkarır')
        .addUserOption(option =>
            option.setName('kullanıcı')
                .setDescription('Çıkarılacak kullanıcı')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const channel = interaction.channel;
        const userToRemove = interaction.options.getUser('kullanıcı');

        try {
            // Bu bir ticket kanalı mı?
            const ticket = await ticketDB.get(channel.id);
            if (!ticket) {
                return interaction.editReply({
                    content: '❌ Bu komut sadece ticket kanallarında kullanılabilir!',
                });
            }

            // Ticket sahibini çıkaramazsın
            if (userToRemove.id === ticket.userId) {
                return interaction.editReply({
                    content: '❌ Ticket sahibini çıkaramazsınız!',
                });
            }

            // Kullanıcıyı kanaldan çıkar
            await channel.permissionOverwrites.delete(userToRemove.id);

            // Bilgilendirme mesajı
            const embed = new EmbedBuilder()
                .setColor('#ED4245')
                .setDescription(`✅ ${userToRemove} ticket'tan çıkarıldı.`)
                .setTimestamp();

            await interaction.editReply({
                embeds: [embed],
            });

            // Kanala bilgi mesajı
            const notificationEmbed = new EmbedBuilder()
                .setColor('#5865F2')
                .setDescription(`${userToRemove} ticket'tan ${interaction.user} tarafından çıkarıldı.`)
                .setTimestamp();

            await channel.send({ embeds: [notificationEmbed] });

            logger.info(`${userToRemove.tag} ticket #${ticket.ticketNumber}'tan çıkarıldı by ${interaction.user.tag}`);

        } catch (error) {
            logger.error('Remove command hatası:', error);
            await interaction.editReply({
                content: '❌ Kullanıcı çıkarılırken bir hata oluştu!',
            });
        }
    },
};