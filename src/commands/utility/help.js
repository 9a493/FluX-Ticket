import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Tüm komutları ve kullanımlarını gösterir'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('📚 FluX Ticket Bot - Yardım')
            .setDescription('Aşağıda tüm komutların listesi bulunmaktadır.')
            .addFields(
                {
                    name: '🎫 Ticket Komutları',
                    value: 
                        '`/close [sebep]` - Ticketı kapatır\n' +
                        '`/claim` - Ticketı sahiplenir\n' +
                        '`/unclaim` - Ticket sahipliğini bırakır\n' +
                        '`/add @kullanıcı` - Ticket\'a kullanıcı ekler\n' +
                        '`/remove @kullanıcı` - Ticket\'tan kullanıcı çıkarır\n' +
                        '`/rename <isim>` - Ticket kanalını yeniden adlandırır\n' +
                        '`/transfer @yetkili [not]` - Ticketı başka yetkiliye devreder\n' +
                        '`/move <kategori>` - Ticketı başka kategoriye taşır\n' +
                        '`/priority <seviye>` - Ticket önceliğini belirler\n' +
                        '`/tag add/remove/list` - Ticket etiketlerini yönetir\n' +
                        '`/info` - Ticket bilgilerini gösterir',
                    inline: false,
                },
                {
                    name: '👮 Yetkili Komutları',
                    value: 
                        '`/canned add/remove/list/use/edit` - Hazır yanıt yönetimi\n' +
                        '`/mystats [@kullanıcı]` - Yetkili istatistikleri',
                    inline: false,
                },
                {
                    name: '⚙️ Yönetici Komutları',
                    value: 
                        '`/setup` - Bot kurulumu\n' +
                        '`/panel [kanal]` - Ticket paneli gönderir\n' +
                        '`/category add/remove/list/edit` - Kategori yönetimi\n' +
                        '`/blacklist @kullanıcı [sebep]` - Kullanıcıyı engeller\n' +
                        '`/unblacklist @kullanıcı` - Engeli kaldırır\n' +
                        '`/stats` - Sunucu istatistikleri',
                    inline: false,
                },
                {
                    name: '🔧 Genel Komutlar',
                    value: 
                        '`/ping` - Bot gecikmesini gösterir\n' +
                        '`/help` - Bu yardım mesajını gösterir',
                    inline: false,
                },
                {
                    name: '📖 Kullanım İpuçları',
                    value: 
                        '• Ticket açmak için paneldeki butona tıklayın\n' +
                        '• Yetkililer `/claim` ile ticket sahiplenebilir\n' +
                        '• `/priority` ile acil ticketları önceliklendirebilirsiniz\n' +
                        '• `/canned use` ile hazır yanıtları hızlıca kullanın\n' +
                        '• Kapatılan ticketlar otomatik olarak transcript oluşturur',
                    inline: false,
                },
            )
            .setFooter({ text: 'FluX Ticket Bot • Destek Sistemi' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
