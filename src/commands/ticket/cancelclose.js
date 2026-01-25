import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ticketDB, guildDB } from '../../utils/database.js';
import { cancelScheduledClose } from '../../utils/scheduler.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('cancelclose')
        .setDescription('Zamanlanmış ticket kapatmayı iptal eder'),

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

            // Zamanlanmış kapatma var mı?
            if (!ticket.scheduledCloseAt) {
                return interaction.editReply({
                    content: '❌ Bu ticket için zamanlanmış kapatma bulunmuyor!',
                });
            }

            // Yetkili kontrolü
            const guildConfig = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);
            const staffRoles = guildConfig.staffRoles 
                ? guildConfig.staffRoles.split(',').filter(r => r)
                : [];
            
            const isStaff = staffRoles.some(roleId => member.roles.cache.has(roleId));
            const isOwner = ticket.userId === interaction.user.id;
            
            if (!isStaff && !isOwner && !member.permissions.has('Administrator')) {
                return interaction.editReply({
                    content: '❌ Bu komutu kullanmak için yetkili veya ticket sahibi olmalısınız!',
                });
            }

            // İptal et
            cancelScheduledClose(channel.id);

            // Database'den kaldır
            await ticketDB.update(channel.id, {
                scheduledCloseAt: null,
                scheduledCloseBy: null,
                scheduledCloseReason: null,
            });

            // Bilgilendirme
            const embed = new EmbedBuilder()
                .setColor('#57F287')
                .setTitle('✅ Zamanlanmış Kapatma İptal Edildi')
                .setDescription('Bu ticket için zamanlanmış kapatma iptal edildi.')
                .addFields(
                    { name: '📝 Ticket', value: `#${ticket.ticketNumber.toString().padStart(4, '0')}`, inline: true },
                    { name: '👤 İptal Eden', value: `${interaction.user}`, inline: true },
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            logger.info(`Scheduled close cancelled for ticket #${ticket.ticketNumber} by ${interaction.user.tag}`);

        } catch (error) {
            logger.error('Cancelclose command hatası:', error);
            await interaction.editReply({
                content: '❌ Zamanlama iptal edilirken bir hata oluştu!',
            });
        }
    },
};
