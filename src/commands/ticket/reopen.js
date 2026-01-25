import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { ticketDB, guildDB } from '../../utils/database.js';
import { sendDM } from '../../utils/notifications.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('reopen')
        .setDescription('Kapatılmış ticket\'ı yeniden açar')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

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

            // Ticket kapalı mı?
            if (ticket.status === 'open' || ticket.status === 'claimed') {
                return interaction.editReply({
                    content: '❌ Bu ticket zaten açık!',
                });
            }

            // Yetkili kontrolü
            const guildConfig = await guildDB.getOrCreate(interaction.guild.id, interaction.guild.name);
            const staffRoles = guildConfig.staffRoles 
                ? guildConfig.staffRoles.split(',').filter(r => r)
                : [];
            
            const isStaff = staffRoles.some(roleId => member.roles.cache.has(roleId));
            if (!isStaff && !member.permissions.has('Administrator')) {
                return interaction.editReply({
                    content: '❌ Bu komutu kullanmak için yetkili olmalısınız!',
                });
            }

            // Ticket'ı yeniden aç
            await ticketDB.reopen(channel.id);

            // Kanal izinlerini güncelle
            try {
                // Ticket sahibine yazma izni ver
                await channel.permissionOverwrites.edit(ticket.userId, {
                    SendMessages: true,
                    ViewChannel: true,
                });

                // Kanal adını güncelle (archived prefix'i kaldır)
                const newName = channel.name.replace(/^📦-/, '').replace(/^archived-/, '');
                await channel.setName(newName);
            } catch (error) {
                logger.warn('Kanal izinleri güncellenirken hata:', error.message);
            }

            // Bilgilendirme mesajı
            const embed = new EmbedBuilder()
                .setColor('#57F287')
                .setTitle('🔓 Ticket Yeniden Açıldı')
                .setDescription(`${interaction.user} bu ticketı yeniden açtı.`)
                .addFields(
                    { name: '📝 Ticket', value: `#${ticket.ticketNumber.toString().padStart(4, '0')}`, inline: true },
                    { name: '👤 Açan', value: `${interaction.user}`, inline: true },
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // Ticket sahibine bildir
            try {
                const ticketOwner = await interaction.client.users.fetch(ticket.userId);
                await sendDM(ticketOwner, {
                    title: '🔓 Ticket Yeniden Açıldı',
                    description: `Ticket'ınız yeniden açıldı.`,
                    fields: [
                        { name: 'Sunucu', value: interaction.guild.name, inline: true },
                        { name: 'Ticket', value: `#${ticket.ticketNumber.toString().padStart(4, '0')}`, inline: true },
                        { name: 'Açan', value: interaction.user.tag, inline: true },
                    ],
                    color: '#57F287',
                });
            } catch (error) {
                // DM gönderilemezse sessizce devam et
            }

            // Log
            if (guildConfig.logChannelId) {
                try {
                    const logChannel = await interaction.guild.channels.fetch(guildConfig.logChannelId);
                    const logEmbed = new EmbedBuilder()
                        .setColor('#57F287')
                        .setTitle('🔓 Ticket Yeniden Açıldı')
                        .addFields(
                            { name: 'Ticket', value: `#${ticket.ticketNumber.toString().padStart(4, '0')}`, inline: true },
                            { name: 'Açan', value: `${interaction.user}`, inline: true },
                            { name: 'Ticket Sahibi', value: `<@${ticket.userId}>`, inline: true },
                        )
                        .setTimestamp();
                    
                    await logChannel.send({ embeds: [logEmbed] });
                } catch (error) {
                    // Log hatası sessiz
                }
            }

            logger.info(`Ticket #${ticket.ticketNumber} reopened by ${interaction.user.tag}`);

        } catch (error) {
            logger.error('Reopen command hatası:', error);
            await interaction.editReply({
                content: '❌ Ticket yeniden açılırken bir hata oluştu!',
            });
        }
    },
};
