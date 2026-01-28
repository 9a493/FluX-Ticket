import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { ticketDB, guildDB } from '../../utils/database.js';
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
        const member = interaction.member;

        try {
            // Bu bir ticket kanalı mı?
            const ticket = await ticketDB.get(channel.id);
            if (!ticket) {
                return interaction.editReply({
                    content: '❌ Bu komut sadece ticket kanallarında kullanılabilir!',
                });
            }

            // Yetki kontrolü: Ticket sahibi veya yetkili
            const guildConfig = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);
            const staffRoles = guildConfig.staffRoles 
                ? guildConfig.staffRoles.split(',').filter(r => r)
                : [];
            
            const isStaff = staffRoles.some(roleId => member.roles.cache.has(roleId));
            const isOwner = ticket.userId === interaction.user.id;
            
            if (!isStaff && !isOwner && !member.permissions.has('Administrator')) {
                return interaction.editReply({
                    content: '❌ Bu komutu kullanmak için ticket sahibi veya yetkili olmalısınız!',
                });
            }

            // Ticket sahibini çıkaramazsın
            if (userToRemove.id === ticket.userId) {
                return interaction.editReply({
                    content: '❌ Ticket sahibini çıkaramazsınız!',
                });
            }

            // Kendini çıkarmaya çalışıyor mu?
            if (userToRemove.id === interaction.user.id) {
                return interaction.editReply({
                    content: '❌ Kendinizi ticket\'tan çıkaramazsınız!',
                });
            }

            // Kullanıcı ticket'ta mı?
            const permissions = channel.permissionOverwrites.cache.get(userToRemove.id);
            if (!permissions) {
                return interaction.editReply({
                    content: `❌ ${userToRemove} bu ticket'ta değil!`,
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
                .setColor('#ED4245')
                .setTitle('👤 Kullanıcı Çıkarıldı')
                .setDescription(`${userToRemove} ticket'tan ${interaction.user} tarafından çıkarıldı.`)
                .setTimestamp();

            await channel.send({ embeds: [notificationEmbed] });

            logger.info(`${userToRemove.tag} removed from ticket #${ticket.ticketNumber} by ${interaction.user.tag}`);

        } catch (error) {
            logger.error('Remove command hatası:', error);
            await interaction.editReply({
                content: '❌ Kullanıcı çıkarılırken bir hata oluştu!',
            });
        }
    },
};
