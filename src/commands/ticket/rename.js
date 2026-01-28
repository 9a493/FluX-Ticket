import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ticketDB } from '../../utils/database.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('rename')
        .setDescription('Ticket kanalını yeniden adlandırır')
        .addStringOption(option =>
            option.setName('isim')
                .setDescription('Yeni kanal adı')
                .setRequired(true)
                .setMaxLength(100)
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const channel = interaction.channel;
        const newName = interaction.options.getString('isim');

        try {
            // Bu bir ticket kanalı mı?
            const ticket = await ticketDB.get(channel.id);
            if (!ticket) {
                return interaction.editReply({
                    content: '❌ Bu komut sadece ticket kanallarında kullanılabilir!',
                });
            }

            const oldName = channel.name;

            // Kanal adını değiştir
            await channel.setName(newName);

            // Bilgilendirme mesajı
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setDescription(`✅ Kanal adı değiştirildi: **${oldName}** → **${newName}**`)
                .setFooter({ text: `${interaction.user.tag} tarafından` })
                .setTimestamp();

            await interaction.editReply({
                embeds: [embed],
            });

            // Kanala bilgi mesajı
            await channel.send({ embeds: [embed] });

            logger.info(`Ticket #${ticket.ticketNumber} renamed to ${newName} by ${interaction.user.tag}`);

        } catch (error) {
            logger.error('Rename command hatası:', error);
            await interaction.editReply({
                content: '❌ Kanal adı değiştirilirken bir hata oluştu!',
            });
        }
    },
};
