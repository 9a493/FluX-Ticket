import { Events, EmbedBuilder } from 'discord.js';
import logger from '../utils/logger.js';

export default {
    name: Events.GuildCreate,
    async execute(guild) {
        logger.info(`✅ Yeni sunucuya eklendi: ${guild.name} (${guild.id}) - ${guild.memberCount} üye`);

        // Sunucu sahibine hoş geldin mesajı gönder
        try {
            const owner = await guild.fetchOwner();
            
            const welcomeEmbed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('🎉 Ticket Botunu Eklediğiniz İçin Teşekkürler!')
                .setDescription(
                    `Merhaba **${guild.name}** sunucusu!\n\n` +
                    'Ticket sistemini kullanmaya başlamak için aşağıdaki adımları izleyin:'
                )
                .addFields(
                    {
                        name: '1️⃣ Setup Komutu',
                        value: '`/setup` komutunu kullanarak ticket sistemini kurun. Bu komut ile:\n' +
                               '• Ticket panelini göndereceğiniz kanalı seçin\n' +
                               '• Ticketların oluşturulacağı kategoriyi belirleyin\n' +
                               '• Yetkili rolünü atayın\n' +
                               '• (Opsiyonel) Log kanalını seçin',
                    },
                    {
                        name: '2️⃣ İzinleri Kontrol Edin',
                        value: 'Botun şu izinlere sahip olduğundan emin olun:\n' +
                               '• Kanalları Yönet\n' +
                               '• Rolleri Yönet\n' +
                               '• Mesaj Gönder\n' +
                               '• Mesaj Geçmişini Görüntüle\n' +
                               '• Embedler Gönder',
                    },
                    {
                        name: '3️⃣ Kullanıma Başlayın',
                        value: 'Setup tamamlandıktan sonra kullanıcılarınız ticket panelinden ticket oluşturabilir!',
                    },
                    {
                        name: '📚 Yardım',
                        value: 'Daha fazla bilgi için `/help` komutunu kullanabilirsiniz.',
                    }
                )
                .setThumbnail(guild.iconURL())
                .setFooter({ 
                    text: 'Profesyonel Ticket Bot', 
                    iconURL: guild.client.user.displayAvatarURL() 
                })
                .setTimestamp();

            await owner.send({ embeds: [welcomeEmbed] }).catch(() => {
                logger.warn(`DM gönderilemedi: ${owner.user.tag} (${guild.name})`);
            });

        } catch (error) {
            logger.error(`Guild create event hatası (${guild.name}):`, error);
        }

        // Eğer bir log kanalı varsa oraya da bildirim gönder
        // (Gelecekte webhook ile merkezi log sistemi)
    },
};