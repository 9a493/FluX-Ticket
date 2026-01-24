import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ticketDB, guildDB } from '../../utils/database.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('claim')
        .setDescription('Ticketı sahiplenirsiniz (sadece yetkili)'),

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

            // Guild ayarlarını kontrol et
            const guildConfig = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);
            
            // staffRoles string'den array'e çevir (SQLite için)
            const staffRoles = guildConfig.staffRoles 
                ? guildConfig.staffRoles.split(',').filter(r => r)
                : [];
            
            // Kullanıcı yetkili mi?
            const isStaff = staffRoles.some(roleId => member.roles.cache.has(roleId));
            if (!isStaff && !member.permissions.has('Administrator')) {
                return interaction.editReply({
                    content: '❌ Bu komutu kullanmak için yetkili olmalısınız!',
                });
            }

            // Zaten claim edilmiş mi?
            if (ticket.status === 'claimed') {
                return interaction.editReply({
                    content: `❌ Bu ticket zaten <@${ticket.claimedBy}> tarafından sahiplenilmiş!`,
                });
            }

            // Ticketı claim et
            await ticketDB.claim(channel.id, member.id);

            // Kanal adını güncelle
            await channel.setName(`ticket-${ticket.ticketNumber.toString().padStart(4, '0')}-${member.user.username}`);

            // Bilgilendirme mesajı
            const embed = new EmbedBuilder()
                .setColor('#57F287')
                .setTitle('✅ Ticket Sahiplenildi')
                .setDescription(`${member} bu ticketı sahiplendi ve size yardımcı olacaktır.`)
                .addFields(
                    { name: '📝 Ticket', value: `#${ticket.ticketNumber.toString().padStart(4, '0')}`, inline: true },
                    { name: '👮 Sahiplenen', value: `${member}`, inline: true },
                    { name: '⏰ Sahiplenme Zamanı', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            logger.info(`Ticket #${ticket.ticketNumber} claimed by ${member.user.tag}`);

        } catch (error) {
            logger.error('Claim command hatası:', error);
            await interaction.editReply({
                content: '❌ Ticket sahiplenirken bir hata oluştu!',
            });
        }
    },
};