import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Yardım menüsü'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🎫 FluX Ticket v3.0 - Yardım')
            .setDescription('Gelişmiş ticket yönetim botu')
            .addFields(
                { name: '📌 Ticket Komutları', value: '`/close` `/claim` `/unclaim` `/add` `/remove` `/priority` `/rename` `/note` `/search` `/merge` `/watch` `/remind`', inline: false },
                { name: '⚙️ Admin Komutları', value: '`/setup` `/panel` `/category` `/canned` `/template` `/trigger` `/blacklist` `/kb` `/sla` `/ai` `/autoassign` `/businesshours` `/backup` `/report` `/auditlog`', inline: false },
                { name: '📊 Utility Komutları', value: '`/stats` `/leaderboard` `/profile` `/help`', inline: false },
                { name: '🤖 AI Özellikleri', value: 'Claude AI entegrasyonu ile otomatik yanıtlar, sentiment analizi ve akıllı kategori önerileri.', inline: false },
                { name: '🎮 Gamification', value: 'XP, level, rozetler ve seri sistemi ile staff motivasyonu.', inline: false },
            )
            .setFooter({ text: 'FluX Ticket • by FluX Digital' });

        await interaction.reply({ embeds: [embed] });
    },
};
