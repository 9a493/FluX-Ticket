import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { ticketDB } from '../../utils/database.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('add')
        .setDescription('Ticket\'a kullanıcı ekler')
        .addUserOption(option =>
            option.setName('kullanıcı')
                .setDescription('Eklenecek kullanıcı')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const channel = interaction.channel;
        const userToAdd = interaction.options.getUser('kullanıcı');
        const member = await interaction.guild.members.fetch(userToAdd.id);

        try {
            // Bu bir ticket kanalı mı?
            const ticket = await ticketDB.get(channel.id);
            if (!ticket) {
                return interaction.editReply({
                    content: '❌ Bu komut sadece ticket kanallarında kullanılabilir!',
                });
            }

            // Kullanıcıyı kanala ekle
            await channel.permissionOverwrites.create(member, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                AttachFiles: true,
                EmbedLinks: true,
            });

            // Bilgilendirme mesajı
            const embed = new EmbedBuilder()
                .setColor('#57F287')
                .setDescription(`✅ ${member} ticket'a eklendi.`)
                .setTimestamp();

            await interaction.editReply({
                embeds: [embed],
            });

            // Kanala bilgi mesajı
            const notificationEmbed = new EmbedBuilder()
                .setColor('#5865F2')
                .setDescription(`${member} ticket'a ${interaction.user} tarafından eklendi.`)
                .setTimestamp();

            await channel.send({ embeds: [notificationEmbed] });

            logger.info(`${userToAdd.tag} ticket #${ticket.ticketNumber}'a eklendi by ${interaction.user.tag}`);

        } catch (error) {
            logger.error('Add command hatası:', error);
            await interaction.editReply({
                content: '❌ Kullanıcı eklenirken bir hata oluştu!',
            });
        }
    },
};