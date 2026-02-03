import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Komut listesini gösterir'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('📚 FluX Ticket Bot - Yardım')
            .setDescription('Aşağıda tüm komutların listesi bulunmaktadır.')
            .addFields(
                { 
                    name: '🎫 Ticket Komutları', 
                    value: '`/close` - Ticketı kapat\n`/claim` - Ticketı sahiplen\n`/unclaim` - Sahipliği bırak\n`/add` - Kullanıcı ekle\n`/remove` - Kullanıcı çıkar\n`/rename` - Adını değiştir\n`/transfer` - Devret\n`/priority` - Öncelik belirle\n`/tag` - Etiket ekle/kaldır\n`/info` - Bilgileri göster\n`/reopen` - Yeniden aç\n`/archive` - Arşivle\n`/scheduleclose` - Zamanla\n`/cancelclose` - İptal et\n`/canned` - Hazır yanıtlar',
                    inline: false 
                },
                { 
                    name: '👑 Yönetici Komutları', 
                    value: '`/setup` - Bot kurulumu\n`/panel` - Ticket paneli\n`/category` - Kategoriler\n`/stats` - İstatistikler\n`/settings` - Ayarlar\n`/blacklist` - Engelle\n`/unblacklist` - Engeli kaldır\n`/apikey` - API anahtarları\n`/language` - Dil değiştir',
                    inline: false 
                },
                { 
                    name: '🔧 Genel Komutlar', 
                    value: '`/ping` - Bot gecikmesi\n`/help` - Bu menü',
                    inline: false 
                },
                {
                    name: '🌐 Web Dashboard',
                    value: '[fluxdigital.com.tr](https://fluxdigital.com.tr)\nAPI anahtarı ile sunucunuzu yönetin.',
                    inline: false
                },
            )
            .setFooter({ text: 'FluX Ticket v2.1 • FluX Digital' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
