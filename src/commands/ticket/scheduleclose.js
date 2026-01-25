import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ticketDB, guildDB } from '../../utils/database.js';
import { scheduleClose, cancelScheduledClose } from '../../utils/scheduler.js';
import logger from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('scheduleclose')
        .setDescription('Ticket\'ı belirli bir süre sonra otomatik kapatır')
        .addStringOption(option =>
            option.setName('süre')
                .setDescription('Ne kadar sonra kapatılsın? (örn: 1h, 30m, 2d)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('sebep')
                .setDescription('Kapatma sebebi')
                .setRequired(false)
                .setMaxLength(200)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const channel = interaction.channel;
        const member = interaction.member;
        const timeStr = interaction.options.getString('süre');
        const reason = interaction.options.getString('sebep');

        try {
            // Bu bir ticket kanalı mı?
            const ticket = await ticketDB.get(channel.id);
            if (!ticket) {
                return interaction.editReply({
                    content: '❌ Bu komut sadece ticket kanallarında kullanılabilir!',
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

            // Süreyi parse et
            const ms = parseTime(timeStr);
            if (!ms || ms < 60000) { // Min 1 dakika
                return interaction.editReply({
                    content: '❌ Geçersiz süre! Örnekler: `30m`, `1h`, `2h30m`, `1d`\nMinimum: 1 dakika',
                });
            }

            if (ms > 7 * 24 * 60 * 60 * 1000) { // Max 7 gün
                return interaction.editReply({
                    content: '❌ Maksimum 7 gün sonrasına zamanlayabilirsiniz!',
                });
            }

            // Zamanla
            const closeTime = new Date(Date.now() + ms);
            await scheduleClose(channel.id, closeTime, interaction.user.id, reason);

            // Database'e kaydet
            await ticketDB.update(channel.id, {
                scheduledCloseAt: closeTime,
                scheduledCloseBy: interaction.user.id,
                scheduledCloseReason: reason,
            });

            // Bilgilendirme
            const embed = new EmbedBuilder()
                .setColor('#FEE75C')
                .setTitle('⏰ Zamanlanmış Kapatma')
                .setDescription(
                    `Bu ticket otomatik olarak kapatılacak:\n\n` +
                    `📅 **<t:${Math.floor(closeTime.getTime() / 1000)}:F>**\n` +
                    `⏱️ **<t:${Math.floor(closeTime.getTime() / 1000)}:R>**`
                )
                .addFields(
                    { name: '📝 Ticket', value: `#${ticket.ticketNumber.toString().padStart(4, '0')}`, inline: true },
                    { name: '👤 Zamanlayan', value: `${interaction.user}`, inline: true },
                )
                .setFooter({ text: 'İptal etmek için /cancelclose kullanın' })
                .setTimestamp();

            if (reason) {
                embed.addFields({ name: '📋 Sebep', value: reason, inline: false });
            }

            await interaction.editReply({ embeds: [embed] });

            // Ticket sahibine bildir
            await channel.send({
                content: `<@${ticket.userId}>`,
                embeds: [
                    new EmbedBuilder()
                        .setColor('#FEE75C')
                        .setDescription(`⏰ Bu ticket **<t:${Math.floor(closeTime.getTime() / 1000)}:R>** otomatik olarak kapatılacak.`)
                ],
            });

            logger.info(`Ticket #${ticket.ticketNumber} scheduled to close at ${closeTime.toISOString()} by ${interaction.user.tag}`);

        } catch (error) {
            logger.error('Scheduleclose command hatası:', error);
            await interaction.editReply({
                content: '❌ Zamanlama ayarlanırken bir hata oluştu!',
            });
        }
    },
};

/**
 * Süre stringini milisaniyeye çevirir
 * Örnekler: "1h", "30m", "2d", "1h30m"
 */
function parseTime(str) {
    const regex = /(\d+)\s*(d|h|m|s)/gi;
    let totalMs = 0;
    let match;

    while ((match = regex.exec(str)) !== null) {
        const value = parseInt(match[1]);
        const unit = match[2].toLowerCase();

        switch (unit) {
            case 'd':
                totalMs += value * 24 * 60 * 60 * 1000;
                break;
            case 'h':
                totalMs += value * 60 * 60 * 1000;
                break;
            case 'm':
                totalMs += value * 60 * 1000;
                break;
            case 's':
                totalMs += value * 1000;
                break;
        }
    }

    return totalMs;
}
