import { Events, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import logger from '../utils/logger.js';
import { guildDB } from '../utils/database.js';

export default {
    name: Events.GuildCreate,
    async execute(guild) {
        logger.info(`📥 Bot yeni bir sunucuya eklendi: ${guild.name} (${guild.id})`);

        try {
            // Guild'i database'e ekle
            await guildDB.getOrCreate(guild.id, guild.name);
            logger.info(`✅ Guild database'e eklendi: ${guild.name}`);

            // Hoş geldin mesajı gönder (eğer izin varsa)
            const systemChannel = guild.systemChannel;
            const firstTextChannel = guild.channels.cache.find(
                ch => ch.isTextBased() && ch.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages)
            );

            const targetChannel = systemChannel || firstTextChannel;

            if (targetChannel) {
                const embed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle('🎫 FluX Ticket Bot')
                    .setDescription(
                        'Merhaba! FluX Ticket Bot sunucunuza eklendi.\n\n' +
                        '**Kurulum:**\n' +
                        '1. `/setup` - Bot ayarlarını yapılandırın\n' +
                        '2. `/panel` - Ticket panelini gönderin\n' +
                        '3. `/category add` - Ticket kategorileri ekleyin\n\n' +
                        '**Yardım:**\n' +
                        '`/help` - Tüm komutları görün\n\n' +
                        '**Dashboard:**\n' +
                        '[fluxdigital.com.tr](https://fluxdigital.com.tr) adresinden sunucunuzu yönetin.'
                    )
                    .setThumbnail(guild.client.user.displayAvatarURL())
                    .setFooter({ text: 'FluX Digital', iconURL: guild.client.user.displayAvatarURL() })
                    .setTimestamp();

                await targetChannel.send({ embeds: [embed] });
            }
        } catch (error) {
            logger.error('GuildCreate error:', error);
        }
    },
};
